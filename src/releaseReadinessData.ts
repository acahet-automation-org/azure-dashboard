import {
    getDashboardData,
    computeDashboardStats,
    computeExecutionTrend,
} from "./dashboardData.js";
import { getDefectData } from "./defectData.js";
import { getCurrentSprint, getPreviousSprint } from "./sprints.js";
import type {
    TrendPoint,
    DefectRecord,
    ReleaseReadinessResponse,
    ReleaseGateSummary,
    ReleaseGateCriterion,
    SprintCompletion,
    PassRateDelta,
    BlockingDefectsSummary,
    SprintInfo,
} from "./types.js";

const CACHE_DURATION_MS = 5 * 60 * 1000;

let cache: { data: ReleaseReadinessResponse; timestamp: number } | null =
    null;

export function clearReleaseReadinessCache(): void {
    cache = null;
}

// Which test plans feed the release gate's completion/pass-rate criteria -
// matches "Test Funzionali" and "UAT" plans (e.g. "Front Office Auto -
// Sprint 1 - Test Funzionali" / "... - UAT"). Excludes other plans such as
// "Test DSI", which is owned by a different team and out of scope for this
// gate (code_coverage.md: "Owner esecuzione: Test Factory Esterna"). Defect
// counts are intentionally left unscoped - bugs aren't reliably linked to a
// single test plan the way test cases are.
const FUNCTIONAL_PLAN_NAME_PATTERN = /\b(test funzionali|uat)\b/i;

function isFunctionalTestPlan(planName: string): boolean {
    return FUNCTIONAL_PLAN_NAME_PATTERN.test(planName);
}

function envNumber(name: string, fallback: number): number {
    const parsed = Number(process.env[name]);

    return Number.isFinite(parsed) ? parsed : fallback;
}

// Reproduces the org's formal exit-criteria checklist (code_coverage.md,
// "Criteri di Accettazione - Test Funzionali Manuali"). The doc gates
// defects by Priority (P1-P4), but this project's Azure DevOps data barely
// populates Priority (almost every bug is "Priority 2") while Severity
// ("1 - Critical" .. "4 - Low") is the field the team actually maintains -
// so the P1/P2 BLOCK / P3/P4 WARN rows are mapped onto Severity instead.
function buildGateCriteria(
    completion: SprintCompletion,
    testsPassedPct: number | null,
    testCaseRelevancePct: number | null,
    severityOpenCounts: Record<"1 - Critical" | "2 - High" | "3 - Medium" | "4 - Low", number>
): ReleaseGateCriterion[] {
    const testsExecutedTarget = envNumber(
        "RELEASE_GATE_TESTS_EXECUTED_TARGET_PCT",
        100
    );
    const testsPassedTarget = envNumber(
        "RELEASE_GATE_TESTS_PASSED_TARGET_PCT",
        95
    );
    const requirementsCoverageTarget = envNumber(
        "RELEASE_GATE_REQUIREMENTS_COVERAGE_TARGET_PCT",
        95
    );
    const testCaseRelevanceTarget = envNumber(
        "RELEASE_GATE_TEST_CASE_RELEVANCE_TARGET_PCT",
        0
    );

    return [
        {
            id: "testsExecuted",
            action: "block",
            target: `${testsExecutedTarget}%`,
            actual: `${completion.completionRatePct}%`,
            tracked: true,
            passed: completion.completionRatePct >= testsExecutedTarget,
        },
        {
            id: "testsPassed",
            action: "block",
            target: `${testsPassedTarget}%`,
            actual: testsPassedPct != null ? `${testsPassedPct}%` : null,
            tracked: testsPassedPct != null,
            passed: testsPassedPct != null && testsPassedPct >= testsPassedTarget,
        },
        {
            id: "requirementsCoverage",
            action: "block",
            target: `${requirementsCoverageTarget}%`,
            actual: null,
            tracked: false,
            passed: false,
        },
        {
            id: "testCaseRelevance",
            action: "block",
            target: `${testCaseRelevanceTarget}%`,
            actual: testCaseRelevancePct != null ? `${testCaseRelevancePct}%` : null,
            tracked: testCaseRelevancePct != null,
            passed:
                testCaseRelevancePct != null &&
                testCaseRelevancePct <= testCaseRelevanceTarget,
        },
        {
            id: "criticalDefectsOpen",
            action: "block",
            target: "0",
            actual: String(severityOpenCounts["1 - Critical"]),
            tracked: true,
            passed: severityOpenCounts["1 - Critical"] === 0,
        },
        {
            id: "highDefectsOpen",
            action: "block",
            target: "0",
            actual: String(severityOpenCounts["2 - High"]),
            tracked: true,
            passed: severityOpenCounts["2 - High"] === 0,
        },
        {
            id: "mediumDefectsOpen",
            action: "warn",
            target: "tracked",
            actual: String(severityOpenCounts["3 - Medium"]),
            tracked: true,
            passed: severityOpenCounts["3 - Medium"] === 0,
        },
        {
            id: "lowDefectsOpen",
            action: "warn",
            target: "tracked",
            actual: String(severityOpenCounts["4 - Low"]),
            tracked: true,
            passed: severityOpenCounts["4 - Low"] === 0,
        },
    ];
}

function computeReleaseGate(criteria: ReleaseGateCriterion[]): ReleaseGateSummary {
    const trackedCriteria = criteria.filter((c) => c.tracked);

    const hasBlockFailure = trackedCriteria.some(
        (c) => c.action === "block" && !c.passed
    );
    const hasWarnFailure = trackedCriteria.some(
        (c) => c.action === "warn" && !c.passed
    );

    return {
        ragStatus: hasBlockFailure ? "red" : hasWarnFailure ? "amber" : "green",
        criteria,
        trackedCount: trackedCriteria.length,
        passingCount: trackedCriteria.filter((c) => c.passed).length,
    };
}

// Aggregates the daily execution trend into a single pass rate for the given
// [startDate, endDate] window, used as the per-sprint pass rate since there's
// no separate sprint-scoped execution dataset.
function sprintPassRateFromTrend(
    trend: TrendPoint[],
    startDate: string,
    endDate: string
): number | null {
    const inRange = trend.filter(
        (p) => p.date >= startDate && p.date <= endDate
    );

    const totalExecuted = inRange.reduce(
        (sum, p) => sum + p.passed + p.failed + p.blocked,
        0
    );
    const totalPassed = inRange.reduce((sum, p) => sum + p.passed, 0);

    if (totalExecuted === 0) {
        return null;
    }

    return Math.round((totalPassed / totalExecuted) * 1000) / 10;
}

function computePassRateDelta(
    trend: TrendPoint[],
    sprint: SprintInfo,
    previousSprint: SprintInfo | null
): PassRateDelta {
    const currentSprintPassRate = sprintPassRateFromTrend(
        trend,
        sprint.startDate,
        sprint.endDate
    );
    const previousSprintPassRate = previousSprint
        ? sprintPassRateFromTrend(
              trend,
              previousSprint.startDate,
              previousSprint.endDate
          )
        : null;

    return {
        currentSprintPassRate,
        previousSprintPassRate,
        deltaPct:
            currentSprintPassRate != null && previousSprintPassRate != null
                ? Math.round(
                      (currentSprintPassRate - previousSprintPassRate) * 10
                  ) / 10
                : null,
        previousSprintName: previousSprint?.name ?? null,
    };
}

export function countOpenBySeverity(
    defects: DefectRecord[]
): Record<"1 - Critical" | "2 - High" | "3 - Medium" | "4 - Low", number> {
    const open = defects.filter((d) => d.state !== "Closed");

    return {
        "1 - Critical": open.filter((d) => d.severity === "1 - Critical").length,
        "2 - High": open.filter((d) => d.severity === "2 - High").length,
        "3 - Medium": open.filter((d) => d.severity === "3 - Medium").length,
        "4 - Low": open.filter((d) => d.severity === "4 - Low").length,
    };
}

export async function computeReleaseReadiness(): Promise<ReleaseReadinessResponse> {
    const now = Date.now();

    if (cache && now - cache.timestamp < CACHE_DURATION_MS) {
        return cache.data;
    }

    const [allTestCases, defects, trend] = await Promise.all([
        getDashboardData(),
        getDefectData(),
        computeExecutionTrend(),
    ]);

    const functionalTestCases = allTestCases.filter((tc) =>
        isFunctionalTestPlan(tc.planName)
    );
    const dashboardStats = computeDashboardStats(functionalTestCases);

    const sprint = getCurrentSprint();
    const previousSprint = getPreviousSprint(sprint);

    const completion: SprintCompletion = {
        plannedCount: dashboardStats.totalTestCases,
        executedCount: dashboardStats.executedCount,
        notExecutedCount: dashboardStats.notRunCount,
        completionRatePct: dashboardStats.totalTestCases
            ? Math.round(
                  (dashboardStats.executedCount /
                      dashboardStats.totalTestCases) *
                      1000
              ) / 10
            : 0,
        // Only counts as "carried over" once the sprint window has actually
        // closed - before that it's just work still in flight.
        carryOverCount: sprint.hasEnded ? dashboardStats.notRunCount : 0,
    };

    // "Test superati" is the pass rate among *executed* test cases, not
    // among all planned ones - distinct from completion.completionRatePct.
    const testsPassedPct = dashboardStats.executedCount
        ? Math.round(
              (dashboardStats.passedCount / dashboardStats.executedCount) *
                  1000
          ) / 10
        : null;

    // "Not Applicable" test cases are ones marked out-of-scope for the
    // current release (code_coverage.md's "Pertinenza casi test") - the
    // target is 0%, i.e. the plan shouldn't contain out-of-scope test cases
    // without documented justification.
    const testCaseRelevancePct = dashboardStats.totalTestCases
        ? Math.round(
              (dashboardStats.notApplicableCount /
                  dashboardStats.totalTestCases) *
                  1000
          ) / 10
        : 0;

    const severityOpenCounts = countOpenBySeverity(defects);

    const criteria = buildGateCriteria(
        completion,
        testsPassedPct,
        testCaseRelevancePct,
        severityOpenCounts
    );
    const releaseGate = computeReleaseGate(criteria);

    const passRateDelta = computePassRateDelta(trend, sprint, previousSprint);

    const blockingRecords = defects.filter(
        (d) =>
            d.state !== "Closed" &&
            (d.severity === "1 - Critical" || d.severity === "2 - High")
    );

    const blockingDefects: BlockingDefectsSummary = {
        criticalCount: severityOpenCounts["1 - Critical"],
        highCount: severityOpenCounts["2 - High"],
        totalCount: blockingRecords.length,
        items: blockingRecords
            .sort((a, b) => (a.severity ?? "").localeCompare(b.severity ?? ""))
            .map((d) => ({
                id: d.id,
                title: d.title,
                severity: d.severity,
                priority: d.priority,
                state: d.state,
                url: d.url,
                creator: d.creator,
            })),
    };

    const data: ReleaseReadinessResponse = {
        sprint,
        releaseGate,
        completion,
        passRateDelta,
        blockingDefects,
        cacheTimestamp: now,
    };

    cache = { data, timestamp: now };

    return data;
}
