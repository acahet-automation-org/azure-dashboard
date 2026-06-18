import {
    getTestPlans,
    getSuites,
    getTestCases,
    getTestPoints,
    getTestRuns,
    getTestRunStatistics,
    getWorkItem,
    getWorkItems,
    extractWorkItemIds,
} from "./azdo.js";
import type {
    TestCaseRow,
    Outcome,
    SuiteStat,
    RunCard,
    DashboardStats,
} from "./types.js";

let dashboardCache: TestCaseRow[] | null = null;
let cacheTimestamp = 0;

const CACHE_DURATION_MS = 5 * 60 * 1000;

export function getCacheTimestamp(): number {
    return cacheTimestamp;
}

export function resolveOutcome(
    outcomes: string[]
): Outcome {
    const normalized = outcomes.map((o) =>
        o.toLowerCase()
    );

    if (normalized.length === 0) {
        return "NotRun";
    }

    if (normalized.includes("failed")) {
        return "Failed";
    }

    if (normalized.includes("blocked")) {
        return "Blocked";
    }

    if (normalized.every((o) => o === "passed")) {
        return "Passed";
    }

    return "NotRun";
}

async function buildTestCaseRow(
    tc: any,
    suiteName: string,
    outcomesByTestCase: Record<number, string[]>
): Promise<TestCaseRow> {
    const workItem = await getWorkItem(
        tc.workItem.id
    );

    const linkedIds = extractWorkItemIds(
        workItem.relations
    );

    const linkedItems = await getWorkItems(
        linkedIds
    );

    const bugs = linkedItems.filter(
        (item: any) =>
            item.fields[
            "System.WorkItemType"
            ] === "Bug"
    );

    const openBugs = bugs.filter(
        (b: any) =>
            b.fields["System.State"] !==
            "Closed"
    );

    return {
        areaPath:
            workItem.fields[
            "System.AreaPath"
            ],
        suiteName,
        testCaseId: tc.workItem.id,
        testCaseTitle: tc.workItem.name,
        testCaseUrl:
            workItem._links?.html?.href,
        priority:
            workItem.fields[
            "Microsoft.VSTS.Common.Priority"
            ] ?? 4,
        hasOpenBugs: openBugs.length > 0,
        outcome: resolveOutcome(
            outcomesByTestCase[
            tc.workItem.id
            ] ?? []
        ),
        bugs: bugs.map((b: any) => ({
            id: b.id,
            title: b.fields["System.Title"],
            state: b.fields["System.State"],
        })),
    };
}

export async function buildDashboard(): Promise<
    TestCaseRow[]
> {
    const plans = await getTestPlans();

    const allTestCases: TestCaseRow[] = [];

    for (const plan of plans) {
        const suites = await getSuites(plan.id);

        for (const suite of suites) {
            const testCases = await getTestCases(
                plan.id,
                suite.id
            );

            const testPoints = await getTestPoints(
                plan.id,
                suite.id
            );

            const outcomesByTestCase: Record<
                number,
                string[]
            > = {};

            for (const point of testPoints) {
                const tcId =
                    point.testCaseReference?.id;

                if (tcId == null) {
                    continue;
                }

                if (!outcomesByTestCase[tcId]) {
                    outcomesByTestCase[tcId] = [];
                }

                outcomesByTestCase[tcId].push(
                    point.results?.outcome ?? "none"
                );
            }

            const rows = await Promise.all(
                testCases.map((tc: any) =>
                    buildTestCaseRow(
                        tc,
                        suite.name,
                        outcomesByTestCase
                    )
                )
            );

            allTestCases.push(...rows);
        }
    }

    return allTestCases;
}

export async function getDashboardData(): Promise<
    TestCaseRow[]
> {
    const now = Date.now();

    if (
        dashboardCache &&
        now - cacheTimestamp <
        CACHE_DURATION_MS
    ) {
        console.log("CACHE HIT");
        return dashboardCache;
    }

    console.log("CACHE MISS");

    dashboardCache = await buildDashboard();
    cacheTimestamp = now;

    return dashboardCache;
}

export function clearDashboardCache(): void {
    dashboardCache = null;
    cacheTimestamp = 0;
}

export function computeDashboardStats(
    allTestCases: TestCaseRow[]
): DashboardStats {
    const grouped: Record<
        string,
        TestCaseRow[]
    > = {};

    for (const tc of allTestCases) {
        const key = String(tc.priority);

        if (!grouped[key]) {
            grouped[key] = [];
        }

        grouped[key].push(tc);
    }

    Object.keys(grouped).forEach(
        (priority) => {
            grouped[priority].sort((a, b) => {
                if (
                    a.hasOpenBugs &&
                    !b.hasOpenBugs
                ) {
                    return -1;
                }

                if (
                    !a.hasOpenBugs &&
                    b.hasOpenBugs
                ) {
                    return 1;
                }

                return a.testCaseTitle.localeCompare(
                    b.testCaseTitle
                );
            });
        }
    );

    const areaPaths = [
        ...new Set(
            allTestCases
                .map((tc) => tc.areaPath)
                .filter(Boolean)
        ),
    ].sort();

    const suites = [
        ...new Set(
            allTestCases.map(
                (tc) => tc.suiteName
            )
        ),
    ].sort();

    const priorities = [
        ...new Set(
            allTestCases.map(
                (tc) => tc.priority
            )
        ),
    ].sort((a, b) => b - a);

    const totalTestCases = allTestCases.length;

    const withOpenBugs = allTestCases.filter(
        (tc) => tc.hasOpenBugs
    ).length;

    const withoutOpenBugs =
        totalTestCases - withOpenBugs;

    const passedCount = allTestCases.filter(
        (tc) => tc.outcome === "Passed"
    ).length;

    const failedCount = allTestCases.filter(
        (tc) => tc.outcome === "Failed"
    ).length;

    const blockedCount = allTestCases.filter(
        (tc) => tc.outcome === "Blocked"
    ).length;

    const notRunCount = allTestCases.filter(
        (tc) => tc.outcome === "NotRun"
    ).length;

    const passRate = totalTestCases
        ? Math.round(
            (passedCount / totalTestCases) * 1000
        ) / 10
        : 0;

    return {
        areaPaths,
        suites,
        priorities,
        totalTestCases,
        withOpenBugs,
        withoutOpenBugs,
        passedCount,
        failedCount,
        blockedCount,
        notRunCount,
        passRate,
        groupedByPriority: grouped,
    };
}

export function computeSuiteStats(
    allTestCases: TestCaseRow[]
): Record<string, SuiteStat> {
    const suiteStats: Record<
        string,
        SuiteStat
    > = {};

    for (const tc of allTestCases) {
        if (!suiteStats[tc.suiteName]) {
            suiteStats[tc.suiteName] = {
                total: 0,
                passed: 0,
                failed: 0,
                blocked: 0,
                notRun: 0,
                openBugs: 0,
            };
        }

        const stat = suiteStats[tc.suiteName];

        stat.total++;

        if (tc.outcome === "Passed") {
            stat.passed++;
        } else if (tc.outcome === "Failed") {
            stat.failed++;
        } else if (tc.outcome === "Blocked") {
            stat.blocked++;
        } else {
            stat.notRun++;
        }

        if (tc.hasOpenBugs) {
            stat.openBugs++;
        }
    }

    return suiteStats;
}

export async function computeRunCards(): Promise<
    RunCard[]
> {
    const runs = await getTestRuns();

    const last10 = [...runs]
        .sort((a: any, b: any) => {
            const aDate = new Date(
                a.completedDate ??
                a.startedDate
            ).getTime();

            const bDate = new Date(
                b.completedDate ??
                b.startedDate
            ).getTime();

            return bDate - aDate;
        })
        .slice(0, 10);

    return Promise.all(
        last10.map(
            async (run: any): Promise<RunCard> => {
                const stats =
                    await getTestRunStatistics(
                        run.id
                    );

                const counts: Record<
                    Outcome,
                    number
                > = {
                    Passed: 0,
                    Failed: 0,
                    Blocked: 0,
                    NotRun: 0,
                };

                for (const s of stats) {
                    const outcome = (
                        s.outcome ?? ""
                    ).toLowerCase();

                    if (outcome === "passed") {
                        counts.Passed += s.count;
                    } else if (
                        outcome === "failed"
                    ) {
                        counts.Failed += s.count;
                    } else if (
                        outcome === "blocked"
                    ) {
                        counts.Blocked += s.count;
                    } else {
                        counts.NotRun += s.count;
                    }
                }

                const total =
                    counts.Passed +
                    counts.Failed +
                    counts.Blocked +
                    counts.NotRun;

                const passRate = total
                    ? Math.round(
                        (counts.Passed /
                            total) *
                        1000
                    ) / 10
                    : 0;

                return {
                    id: run.id,
                    name: run.name,
                    state: run.state,
                    startedDate:
                        run.startedDate,
                    completedDate:
                        run.completedDate,
                    url: run.webAccessUrl,
                    counts,
                    total,
                    passRate,
                };
            }
        )
    );
}
