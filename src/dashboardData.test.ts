import { describe, it, expect } from "vitest";
import { computeSuiteStats } from "./dashboardData.js";
import type { TestCaseRow } from "./types.js";

function makeRow(overrides: Partial<TestCaseRow>): TestCaseRow {
    return {
        planId: 1,
        planName: "Plan A",
        areaPath: "Area",
        suiteName: "Regression",
        suiteId: 10,
        testCaseId: 100,
        testCaseTitle: "Test",
        priority: 2,
        hasOpenBugs: false,
        outcome: "Passed",
        bugs: [],
        ...overrides,
    };
}

describe("computeSuiteStats", () => {
    it("keeps two suites with the same name but different planId as separate entries", () => {
        const rows: TestCaseRow[] = [
            makeRow({ planId: 1, suiteId: 10, suiteName: "Regression", outcome: "Passed" }),
            makeRow({ planId: 2, suiteId: 20, suiteName: "Regression", outcome: "Failed" }),
        ];

        const stats = computeSuiteStats(rows);
        const entries = Object.values(stats);

        expect(entries).toHaveLength(2);

        const plan1Stat = entries.find((s) => s.planId === 1);
        const plan2Stat = entries.find((s) => s.planId === 2);

        expect(plan1Stat).toBeDefined();
        expect(plan1Stat!.passed).toBe(1);
        expect(plan1Stat!.failed).toBe(0);
        expect(plan1Stat!.suiteName).toBe("Regression");

        expect(plan2Stat).toBeDefined();
        expect(plan2Stat!.passed).toBe(0);
        expect(plan2Stat!.failed).toBe(1);
        expect(plan2Stat!.suiteName).toBe("Regression");
    });
});
