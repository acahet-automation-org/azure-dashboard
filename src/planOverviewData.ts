import {
    getTestPlans,
    getSuites,
    getTestCases,
    getTestPoints,
    getBugWorkItemTypeStates,
} from "./azdo.js";
import { buildTestCaseRow } from "./dashboardData.js";
import type {
    BugInfo,
    Outcome,
    PlanOverviewResponse,
    TestCaseRow,
} from "./types.js";

const cache = new Map<
    number,
    { data: PlanOverviewResponse; timestamp: number }
>();

const CACHE_DURATION_MS = 5 * 60 * 1000;

export function clearPlanOverviewCache(): void {
    cache.clear();
}

async function buildPlanRows(
    planId: number,
    planName: string
): Promise<TestCaseRow[]> {
    const suites = await getSuites(planId);

    const rowsBySuite = await Promise.all(
        suites.map(async (suite: any) => {
            const testCases = await getTestCases(
                planId,
                suite.id
            );

            const testPoints = await getTestPoints(
                planId,
                suite.id
            );

            const outcomesByTestCase: Record<
                number,
                string[]
            > = {};

            const lastRunByTestCase: Record<
                number,
                number
            > = {};

            const lastRunDateByTestCase: Record<
                number,
                number
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

                const runId =
                    point.results?.lastTestRunId;

                if (runId == null) {
                    continue;
                }

                const completedDate = new Date(
                    point.results?.lastResultDetails
                        ?.dateCompleted ?? 0
                ).getTime();

                if (
                    completedDate >=
                    (lastRunDateByTestCase[tcId] ?? -1)
                ) {
                    lastRunDateByTestCase[tcId] =
                        completedDate;
                    lastRunByTestCase[tcId] = runId;
                }
            }

            return Promise.all(
                testCases.map((tc: any) =>
                    buildTestCaseRow(
                        tc,
                        planName,
                        suite.name,
                        outcomesByTestCase,
                        lastRunByTestCase
                    )
                )
            );
        })
    );

    return rowsBySuite.flat();
}

export async function computePlanOverview(
    planId: number
): Promise<PlanOverviewResponse> {
    const cached = cache.get(planId);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
        return cached.data;
    }

    const plans = await getTestPlans();
    const plan = plans.find((p: any) => p.id === planId);
    const planName = plan?.name ?? String(planId);

    const rows = await buildPlanRows(planId, planName);

    const testsBySuiteMap = new Map<string, number>();
    const outcomeCounts: Record<Outcome, number> = {
        Passed: 0,
        Failed: 0,
        Blocked: 0,
        NotRun: 0,
    };
    const bugsById = new Map<number, BugInfo>();

    for (const row of rows) {
        testsBySuiteMap.set(
            row.suiteName,
            (testsBySuiteMap.get(row.suiteName) ?? 0) + 1
        );

        outcomeCounts[row.outcome]++;

        for (const bug of row.bugs) {
            bugsById.set(bug.id, bug);
        }
    }

    const bugStates = await getBugWorkItemTypeStates();
    const stateOrder = new Map<string, number>(
        bugStates.map((s, index) => [s.name, index])
    );
    const stateMeta = new Map(
        bugStates.map((s) => [s.name, s])
    );

    const orderOf = (state: string) =>
        stateOrder.get(state) ?? bugStates.length;

    const bugs = [...bugsById.values()].sort(
        (a, b) => orderOf(a.state) - orderOf(b.state)
    );

    const bugsByStateMap = new Map<string, number>();

    for (const bug of bugs) {
        bugsByStateMap.set(
            bug.state,
            (bugsByStateMap.get(bug.state) ?? 0) + 1
        );
    }

    const bugsByState = [...bugsByStateMap.entries()]
        .map(([state, count]) => ({
            state,
            count,
            color: stateMeta.get(state)?.color,
            category: stateMeta.get(state)?.category,
        }))
        .sort((a, b) => orderOf(a.state) - orderOf(b.state));

    const data: PlanOverviewResponse = {
        planId,
        planName,
        totalTestCases: rows.length,
        totalBugs: bugs.length,
        testsBySuite: [...testsBySuiteMap.entries()].map(
            ([suiteName, count]) => ({ suiteName, count })
        ),
        outcomeCounts,
        bugStates,
        bugsByState,
        bugs,
    };

    cache.set(planId, { data, timestamp: now });

    return data;
}
