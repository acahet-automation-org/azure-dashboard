import {
    getTestSuiteHierarchy,
    getTestSuiteCurrentCounts,
} from "./azdo.js";
import type {
    TestPlanProgressCounts,
    TestPlanProgressNode,
    TestPlanProgressResponse,
} from "./types.js";

const cache = new Map<
    number,
    { data: TestPlanProgressResponse; timestamp: number }
>();

const CACHE_DURATION_MS = 5 * 60 * 1000;

export function clearTestPlanProgressCache(): void {
    cache.clear();
}

function zeroCounts(): TestPlanProgressCounts {
    return {
        total: 0,
        passed: 0,
        failed: 0,
        blocked: 0,
        notApplicable: 0,
        notExecuted: 0,
    };
}

function addCounts(
    a: TestPlanProgressCounts,
    b: TestPlanProgressCounts
): TestPlanProgressCounts {
    return {
        total: a.total + b.total,
        passed: a.passed + b.passed,
        failed: a.failed + b.failed,
        blocked: a.blocked + b.blocked,
        notApplicable: a.notApplicable + b.notApplicable,
        notExecuted: a.notExecuted + b.notExecuted,
    };
}

// DateSK is the Analytics OData service's date surrogate key: today's date
// as a plain YYYYMMDD integer, not a timestamp.
function todayDateSK(): number {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return Number(`${year}${month}${day}`);
}

export async function computeTestPlanProgress(
    planId: number
): Promise<TestPlanProgressResponse> {
    const cached = cache.get(planId);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
        return cached.data;
    }

    const [hierarchyRows, countRows] = await Promise.all([
        getTestSuiteHierarchy(planId),
        getTestSuiteCurrentCounts(planId, todayDateSK()),
    ]);

    const countsByLevel3 = new Map<number, TestPlanProgressCounts>();

    for (const row of countRows) {
        countsByLevel3.set(row.TestSuite.IdLevel3, {
            total: row.TotalCount,
            passed: row.Passed,
            failed: row.Failed,
            blocked: row.Blocked,
            notApplicable: row.NotApplicable,
            notExecuted: row.NotExecuted,
        });
    }

    const level1ById = new Map<number, TestPlanProgressNode>();
    const level2ById = new Map<number, TestPlanProgressNode>();

    let planTitle = String(planId);

    for (const row of hierarchyRows) {
        planTitle = row.TestPlanTitle ?? planTitle;

        if (!level1ById.has(row.IdLevel1)) {
            level1ById.set(row.IdLevel1, {
                id: row.IdLevel1,
                title: row.TestPlanTitle,
                counts: zeroCounts(),
                children: [],
            });
        }

        const level1 = level1ById.get(row.IdLevel1)!;

        if (!level2ById.has(row.IdLevel2)) {
            const level2: TestPlanProgressNode = {
                id: row.IdLevel2,
                title: row.TitleLevel2,
                counts: zeroCounts(),
                children: [],
            };

            level2ById.set(row.IdLevel2, level2);
            level1.children.push(level2);
        }

        const level2 = level2ById.get(row.IdLevel2)!;
        const level3Counts = countsByLevel3.get(row.IdLevel3) ?? zeroCounts();

        const level3: TestPlanProgressNode = {
            id: row.IdLevel3,
            title: row.TitleLevel3,
            counts: level3Counts,
            children: [],
        };

        level2.children.push(level3);
        level2.counts = addCounts(level2.counts, level3Counts);
        level1.counts = addCounts(level1.counts, level3Counts);
    }

    const data: TestPlanProgressResponse = {
        planId,
        planTitle,
        nodes: [...level1ById.values()],
    };

    cache.set(planId, { data, timestamp: now });

    return data;
}
