import {
    getTestPlans,
    getSuites,
    getTestCases,
    getTestRuns,
    getTestRunResults,
    getWorkItems,
} from "./azdo.js";
import { resolveOutcome } from "./dashboardData.js";
import { areaPathInScope, iterationInScope } from "./scopeFilter.js";
import { createPerProjectCache } from "./perProjectCache.js";
import type {
    AutomationTestCaseRow,
    AutomationResultOccurrence,
    AutomationKpis,
    CiCdMetrics,
    CoverageByModule,
    FlakyTestRankItem,
    AutomationCharts,
    AutomationDashboardResponse,
    AutomationPlanSummary,
    AutomationSummary,
    ExecutionTrendPoint,
    ExecutionStatusBreakdown,
    DailyVelocityPoint,
    DefectsBySeverity,
    ModuleRiskItem,
    RootCauseItem,
    TopFailingTestItem,
    ReleaseReadinessStatus,
} from "./types.js";

const AUTOMATION_STATUS_FIELD = "Microsoft.VSTS.TCM.AutomationStatus";
const AREA_PATH_FIELD = "System.AreaPath";
const FLAKY_TOP_N = 10;

interface AutomationCacheEntry {
    rows: AutomationTestCaseRow[];
    occurrences: AutomationResultOccurrence[];
}

const CACHE_DURATION_MS = 5 * 60 * 1000;

// Keyed per project - see the matching comment on dashboardCache in
// dashboardData.ts.
const automationCache =
    createPerProjectCache<AutomationCacheEntry>(CACHE_DURATION_MS);

export function getAutomationCacheTimestamp(project: string): number {
    return automationCache.getTimestamp(project);
}

async function buildAutomationRows(
    project: string
): Promise<
    AutomationTestCaseRow[]
> {
    const plans = await getTestPlans(project);

    const rows: AutomationTestCaseRow[] = [];

    for (const plan of plans) {
        const suites = await getSuites(plan.id, project);

        for (const suite of suites) {
            const testCases = await getTestCases(
                plan.id,
                suite.id,
                project
            );

            const ids = testCases.map(
                (tc: any) => tc.workItem.id
            );

            const workItems = await getWorkItems(
                ids,
                [AUTOMATION_STATUS_FIELD, AREA_PATH_FIELD],
                project
            );

            const fieldsById = new Map<number, any>(
                workItems.map((wi: any) => [
                    wi.id,
                    wi.fields,
                ])
            );

            for (const tc of testCases) {
                const fields =
                    fieldsById.get(tc.workItem.id) ?? {};

                rows.push({
                    testCaseId: tc.workItem.id,
                    testCaseTitle: tc.workItem.name,
                    planId: plan.id,
                    planName: plan.name,
                    areaPath:
                        fields[AREA_PATH_FIELD] ?? "",
                    iteration: plan.iteration,
                    suiteName: suite.name,
                    isAutomated:
                        fields[AUTOMATION_STATUS_FIELD] ===
                        "Automated",
                });
            }
        }
    }

    return rows;
}

async function buildOccurrences(
    project: string
): Promise<
    AutomationResultOccurrence[]
> {
    const runs = await getTestRuns(project);

    const resultsByRun = await Promise.all(
        runs.map((run: any) =>
            getTestRunResults(run.id, project)
        )
    );

    const occurrences: AutomationResultOccurrence[] = [];

    for (const result of resultsByRun.flat()) {
        const testCaseId = result.testCase?.id;

        if (testCaseId == null) {
            continue;
        }

        occurrences.push({
            testCaseId,
            outcome: resolveOutcome([
                result.outcome ?? "none",
            ]),
            completedDate: result.completedDate,
        });
    }

    return occurrences;
}

async function buildAutomationData(project: string): Promise<{
    rows: AutomationTestCaseRow[];
    occurrences: AutomationResultOccurrence[];
}> {
    const [rows, occurrences] = await Promise.all([
        buildAutomationRows(project),
        buildOccurrences(project),
    ]);

    return { rows, occurrences };
}

async function getAutomationData(project: string): Promise<{
    rows: AutomationTestCaseRow[];
    occurrences: AutomationResultOccurrence[];
}> {
    const cached = automationCache.get(project);

    if (cached) {
        console.log("CACHE HIT");

        return cached;
    }

    console.log("CACHE MISS");

    const entry = await buildAutomationData(project);

    automationCache.set(project, entry);

    return entry;
}

export function clearAutomationCache(project?: string): void {
    automationCache.clear(project);
}

// Azure DevOps doesn't have automation status populated yet, so the
// automation dashboard renders this representative dataset instead of
// hitting the API. Flip to false once real automation data exists.
const USE_MOCK_AUTOMATION_DATA = true;

const MOCK_PLANS: {
    id: number;
    name: string;
    modules: string[];
}[] = [
    {
        id: 9001,
        name: "Regressione Automatica",
        modules: ["Autenticazione", "Pagamenti", "Checkout"],
    },
    {
        id: 9002,
        name: "Smoke Suite CI",
        modules: ["Ricerca", "Notifiche"],
    },
    {
        id: 9003,
        name: "API Test Suite",
        modules: ["Reportistica", "Gestione Utenti"],
    },
];

const MOCK_MODULE_COUNTS: Record<
    string,
    { automated: number; manual: number }
> = {
    Autenticazione: { automated: 11, manual: 3 },
    Pagamenti: { automated: 14, manual: 4 },
    Checkout: { automated: 9, manual: 7 },
    Ricerca: { automated: 8, manual: 4 },
    Notifiche: { automated: 3, manual: 6 },
    Reportistica: { automated: 4, manual: 6 },
    "Gestione Utenti": { automated: 7, manual: 4 },
};

const MOCK_ITERATIONS = ["Sprint 23", "Sprint 24"];

// Deterministic PRNG so the mock dataset (flaky counts, run history) stays
// stable across requests and server restarts instead of reshuffling.
function mulberry32(seed: number): () => number {
    let state = seed;

    return function next() {
        state |= 0;
        state = (state + 0x6d2b79f5) | 0;

        let t = Math.imul(state ^ (state >>> 15), 1 | state);

        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Most automated tests are perfectly stable; roughly one in eleven is
// flaky with an elevated failure rate. Stable tests get zero background
// failure noise so they don't get miscounted as flaky by chance.
function buildMockOccurrences(
    testCaseId: number,
    random: () => number
): AutomationResultOccurrence[] {
    const runCount = 8 + Math.floor(random() * 5);
    const isFlaky = random() > 0.91;
    const failureRate = isFlaky ? 0.25 + random() * 0.25 : 0;

    const occurrences: AutomationResultOccurrence[] = [];

    for (let run = 0; run < runCount; run++) {
        const daysAgo = runCount - run;
        const completedDate = new Date(
            Date.UTC(2026, 6, 30 - daysAgo)
        ).toISOString();

        occurrences.push({
            testCaseId,
            outcome: random() < failureRate ? "Failed" : "Passed",
            completedDate,
        });
    }

    return occurrences;
}

function buildMockAutomationDataset(): {
    rows: AutomationTestCaseRow[];
    occurrences: AutomationResultOccurrence[];
} {
    const random = mulberry32(20260731);
    const rows: AutomationTestCaseRow[] = [];
    const occurrences: AutomationResultOccurrence[] = [];

    let nextTestCaseId = 100000;

    for (const plan of MOCK_PLANS) {
        for (const module of plan.modules) {
            const counts = MOCK_MODULE_COUNTS[module];
            const suiteName = `${module} - Suite`;
            const totalCases = counts.automated + counts.manual;

            for (let i = 0; i < totalCases; i++) {
                const isAutomated = i < counts.automated;
                const testCaseId = nextTestCaseId++;
                const iteration =
                    MOCK_ITERATIONS[
                        Math.floor(random() * MOCK_ITERATIONS.length)
                    ];

                rows.push({
                    testCaseId,
                    testCaseTitle: `${module} - Test ${i + 1}`,
                    planId: plan.id,
                    planName: plan.name,
                    areaPath: `Nuova Frontiera\\${module}`,
                    iteration,
                    suiteName,
                    isAutomated,
                });

                if (isAutomated) {
                    occurrences.push(
                        ...buildMockOccurrences(testCaseId, random)
                    );
                }
            }
        }
    }

    return { rows, occurrences };
}

const MOCK_AUTOMATION_DATASET = buildMockAutomationDataset();

function areaPathLeaf(areaPath: string): string {
    const segments = areaPath.split("\\").filter(Boolean);

    return segments[segments.length - 1] ?? areaPath;
}

export function getCiCdMetrics(): CiCdMetrics {
    return {
        pipelineSuccessRatePct: 91.3,
        pipelineFailureRatePct: 8.7,
        avgPipelineDurationMinutes: 17.4,
        testExecutionTimeMinutes: 9.8,
    };
}

function getPipelineSuccessTrend() {
    return [
        { date: "2026-07-17", successRatePct: 88 },
        { date: "2026-07-18", successRatePct: 90 },
        { date: "2026-07-19", successRatePct: 86 },
        { date: "2026-07-20", successRatePct: 92 },
        { date: "2026-07-21", successRatePct: 89 },
        { date: "2026-07-22", successRatePct: 93 },
        { date: "2026-07-23", successRatePct: 91 },
        { date: "2026-07-24", successRatePct: 95 },
        { date: "2026-07-25", successRatePct: 90 },
        { date: "2026-07-26", successRatePct: 94 },
        { date: "2026-07-27", successRatePct: 87 },
        { date: "2026-07-28", successRatePct: 92 },
        { date: "2026-07-29", successRatePct: 96 },
        { date: "2026-07-30", successRatePct: 91 },
    ];
}

function getDefectsBySeverity(): DefectsBySeverity {
    return { critical: 2, high: 7, medium: 11, low: 5 };
}

function getRootCauses(): RootCauseItem[] {
    return [
        { label: "Product Bug", pct: 45 },
        { label: "Test Script", pct: 25 },
        { label: "Environment", pct: 18 },
        { label: "Data / Infra", pct: 12 },
    ];
}

const FAILING_TEST_OWNERS = ["Team QA-A", "Team QA-B", "Team QA-C", "Team QA-D"];

function statusForFailingTestRank(rank: number): TopFailingTestItem["status"] {
    if (rank === 0) return "critical";

    return rank < 3 ? "warning" : "ok";
}

function buildTopFailingTests(
    flakyTestRanking: FlakyTestRankItem[]
): TopFailingTestItem[] {
    return flakyTestRanking.slice(0, 4).map((item, index) => ({
        testCaseId: item.testCaseId,
        testName: item.testName,
        module: item.testName.split(" - ")[0] ?? item.testName,
        failures: item.flakeCount,
        lastFailedDate: item.lastFailedDate,
        owner: FAILING_TEST_OWNERS[index % FAILING_TEST_OWNERS.length],
        status: statusForFailingTestRank(index),
    }));
}

function riskForCoveragePct(coveragePct: number): ModuleRiskItem["risk"] {
    if (coveragePct < 50) return "high";

    return coveragePct < 75 ? "medium" : "low";
}

function buildModuleRisk(
    coverageByModule: CoverageByModule[]
): ModuleRiskItem[] {
    return coverageByModule.map((m) => ({
        module: m.module,
        risk: riskForCoveragePct(m.coveragePct),
    }));
}

function buildExecutionTrend(
    occurrences: AutomationResultOccurrence[]
): ExecutionTrendPoint[] {
    const byDate = new Map<string, { passed: number; failed: number }>();

    for (const occurrence of occurrences) {
        if (!occurrence.completedDate) {
            continue;
        }

        const date = occurrence.completedDate.slice(0, 10);
        const bucket = byDate.get(date) ?? { passed: 0, failed: 0 };

        if (occurrence.outcome === "Passed") {
            bucket.passed++;
        } else if (occurrence.outcome === "Failed") {
            bucket.failed++;
        }

        byDate.set(date, bucket);
    }

    return [...byDate.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, counts]) => ({ date, ...counts }));
}

function buildDailyVelocity(
    executionTrend: ExecutionTrendPoint[]
): DailyVelocityPoint[] {
    return executionTrend
        .slice(-7)
        .map((point) => ({
            date: point.date,
            executions: point.passed + point.failed,
        }));
}

// Blocked/Not Run are reserved slack around the real pass/fail split so the
// status donut still reads as a 4-state breakdown even though the mock
// dataset only tracks Passed/Failed occurrences.
const BLOCKED_SHARE_PCT = 3;
const NOT_RUN_SHARE_PCT = 5;

function buildExecutionStatusBreakdown(
    totalPassed: number,
    totalFailed: number
): ExecutionStatusBreakdown {
    const totalRun = totalPassed + totalFailed;
    const remainingPct = 100 - BLOCKED_SHARE_PCT - NOT_RUN_SHARE_PCT;
    const passedPct = totalRun
        ? Math.round(((totalPassed / totalRun) * remainingPct) * 10) / 10
        : 0;

    return {
        passedPct,
        failedPct:
            Math.round((remainingPct - passedPct) * 10) / 10,
        blockedPct: BLOCKED_SHARE_PCT,
        notRunPct: NOT_RUN_SHARE_PCT,
    };
}

function deriveReleaseReadiness(
    qualityScorePct: number,
    criticalBugsCount: number
): ReleaseReadinessStatus {
    if (criticalBugsCount === 0 && qualityScorePct >= 90) {
        return "ready";
    }

    return criticalBugsCount <= 3 && qualityScorePct >= 70
        ? "atRisk"
        : "blocked";
}

function buildAutomationSummary(
    automationSuccessRatePct: number,
    automationCoveragePct: number,
    pipelineSuccessRatePct: number,
    regressionCompletionPct: number,
    defectsBySeverity: DefectsBySeverity
): AutomationSummary {
    const qualityScorePct =
        Math.round(
            (automationSuccessRatePct * 0.5 +
                pipelineSuccessRatePct * 0.3 +
                automationCoveragePct * 0.2) *
                10
        ) / 10;

    return {
        qualityScorePct,
        qualityScoreDeltaPct: 1.2,
        releaseReadiness: deriveReleaseReadiness(
            qualityScorePct,
            defectsBySeverity.critical
        ),
        criticalBugsCount: defectsBySeverity.critical,
        regressionCompletionPct,
        escapedDefectsCount: 1,
    };
}

export function computeAutomationDashboard(
    rows: AutomationTestCaseRow[],
    occurrences: AutomationResultOccurrence[],
    planId?: number,
    iteration?: string
): Omit<AutomationDashboardResponse, "cacheTimestamp"> {
    // `iteration` narrows which plans are even eligible (so the plan
    // dropdown itself shrinks to the selected sprint); `planId` then picks
    // one of those, so it's applied on top rather than combined into the
    // same predicate.
    const rowsInIteration = iteration
        ? rows.filter((r) => r.iteration === iteration)
        : rows;

    const filteredRows =
        planId == null
            ? rowsInIteration
            : rowsInIteration.filter((r) => r.planId === planId);

    const automatedPlanIds = [
        ...new Set(
            rowsInIteration
                .filter((r) => r.isAutomated)
                .map((r) => r.planId)
        ),
    ].sort((a, b) => a - b);

    const planNameById = new Map<number, string>(
        rowsInIteration.map((r) => [r.planId, r.planName])
    );

    const automatedPlans: AutomationPlanSummary[] = automatedPlanIds.map(
        (id) => ({
            id,
            name: planNameById.get(id) ?? `Plan #${id}`,
        })
    );

    const automatedRows = filteredRows.filter(
        (r) => r.isAutomated
    );

    const automatedIds = new Set(
        automatedRows.map((r) => r.testCaseId)
    );

    const automatedOccurrences = occurrences.filter(
        (o) => automatedIds.has(o.testCaseId)
    );

    const automatedTests = automatedRows.length;
    const manualTests =
        filteredRows.length - automatedTests;

    const automationCoveragePct = filteredRows.length
        ? Math.round(
            (automatedTests / filteredRows.length) *
                1000
        ) / 10
        : 0;

    const occurrencesByTestCase = new Map<
        number,
        AutomationResultOccurrence[]
    >();

    for (const occurrence of automatedOccurrences) {
        const bucket =
            occurrencesByTestCase.get(
                occurrence.testCaseId
            ) ?? [];

        bucket.push(occurrence);
        occurrencesByTestCase.set(
            occurrence.testCaseId,
            bucket
        );
    }

    const testCaseTitleById = new Map(
        automatedRows.map((r) => [
            r.testCaseId,
            r.testCaseTitle,
        ])
    );

    let totalPassed = 0;
    let totalFailed = 0;

    const flakyTestRanking: FlakyTestRankItem[] = [];

    for (const [
        testCaseId,
        testOccurrences,
    ] of occurrencesByTestCase) {
        const passed = testOccurrences.filter(
            (o) => o.outcome === "Passed"
        ).length;

        const failed = testOccurrences.filter(
            (o) => o.outcome === "Failed"
        ).length;

        totalPassed += passed;
        totalFailed += failed;

        if (passed > 0 && failed > 0) {
            const lastFailedDate = testOccurrences
                .filter((o) => o.outcome === "Failed")
                .map((o) => o.completedDate)
                .filter(
                    (d): d is string => Boolean(d)
                )
                .sort((a, b) => a.localeCompare(b))
                .pop();

            flakyTestRanking.push({
                testCaseId,
                testName:
                    testCaseTitleById.get(testCaseId) ??
                    `Test #${testCaseId}`,
                flakeCount: failed,
                lastFailedDate,
            });
        }
    }

    flakyTestRanking.sort(
        (a, b) => b.flakeCount - a.flakeCount
    );

    const automationSuccessRatePct =
        totalPassed + totalFailed > 0
            ? Math.round(
                (totalPassed /
                    (totalPassed + totalFailed)) *
                    1000
            ) / 10
            : 0;

    const moduleStats = new Map<
        string,
        { automated: number; manual: number }
    >();

    for (const row of filteredRows) {
        const module = areaPathLeaf(row.areaPath);

        const stat =
            moduleStats.get(module) ?? {
                automated: 0,
                manual: 0,
            };

        if (row.isAutomated) {
            stat.automated++;
        } else {
            stat.manual++;
        }

        moduleStats.set(module, stat);
    }

    const coverageByModule: CoverageByModule[] = [
        ...moduleStats.entries(),
    ].map(([module, stat]) => {
        const total = stat.automated + stat.manual;

        return {
            module,
            automated: stat.automated,
            manual: stat.manual,
            coveragePct: total
                ? Math.round(
                    (stat.automated / total) * 1000
                ) / 10
                : 0,
        };
    });

    const kpis: AutomationKpis = {
        automatedTests,
        manualTests,
        automationCoveragePct,
        flakyTestsCount: flakyTestRanking.length,
        automationSuccessRatePct,
    };

    const ciCd = getCiCdMetrics();
    const executionTrend = buildExecutionTrend(automatedOccurrences);
    const defectsBySeverity = getDefectsBySeverity();
    const regressionCompletionPct = automatedTests
        ? Math.round(
            (occurrencesByTestCase.size / automatedTests) * 1000
        ) / 10
        : 0;

    const charts: AutomationCharts = {
        coverageByModule,
        flakyTestRanking: flakyTestRanking.slice(
            0,
            FLAKY_TOP_N
        ),
        pipelineSuccessTrend: getPipelineSuccessTrend(),
        executionTrend,
        executionStatusBreakdown: buildExecutionStatusBreakdown(
            totalPassed,
            totalFailed
        ),
        dailyVelocity: buildDailyVelocity(executionTrend),
        defectsBySeverity,
        moduleRisk: buildModuleRisk(coverageByModule),
        rootCauses: getRootCauses(),
        topFailingTests: buildTopFailingTests(flakyTestRanking),
    };

    const summary = buildAutomationSummary(
        automationSuccessRatePct,
        automationCoveragePct,
        ciCd.pipelineSuccessRatePct,
        regressionCompletionPct,
        defectsBySeverity
    );

    return {
        kpis,
        ciCd,
        summary,
        charts,
        planId: planId ?? null,
        automatedPlanIds,
        automatedPlans,
    };
}

export async function getAutomationDashboard(
    project: string,
    planId?: number,
    iteration?: string,
    scopeAreaPaths: string[] = [],
    scopeIterations: string[] = []
): Promise<AutomationDashboardResponse> {
    if (USE_MOCK_AUTOMATION_DATA) {
        return {
            ...computeAutomationDashboard(
                MOCK_AUTOMATION_DATASET.rows,
                MOCK_AUTOMATION_DATASET.occurrences,
                planId,
                iteration
            ),
            cacheTimestamp: Date.now(),
        };
    }

    const { rows, occurrences } =
        await getAutomationData(project);

    const scopedRows =
        scopeAreaPaths.length === 0 && scopeIterations.length === 0
            ? rows
            : rows.filter(
                  (r) =>
                      areaPathInScope(r.areaPath, scopeAreaPaths) &&
                      iterationInScope(r.iteration, scopeIterations)
              );

    return {
        ...computeAutomationDashboard(
            scopedRows,
            occurrences,
            planId,
            iteration
        ),
        cacheTimestamp: getAutomationCacheTimestamp(project),
    };
}
