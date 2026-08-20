import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSuiteStats } from "../src/dashboardData.ts";
import type { TestCaseRow } from "../src/types.ts";

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

test("computeSuiteStats: same suiteName from different planIds produces two separate entries", () => {
    const rows: TestCaseRow[] = [
        makeRow({ planId: 1, suiteId: 10, suiteName: "Regression", outcome: "Passed", testCaseId: 1 }),
        makeRow({ planId: 2, suiteId: 20, suiteName: "Regression", outcome: "Failed", testCaseId: 2 }),
    ];

    const stats = computeSuiteStats(rows);
    const entries = Object.values(stats);

    assert.equal(entries.length, 2, "expected two separate suite entries, not one merged entry");

    const plan1Entry = entries.find((s) => s.planId === 1);
    const plan2Entry = entries.find((s) => s.planId === 2);

    assert.ok(plan1Entry, "entry for planId=1 should exist");
    assert.ok(plan2Entry, "entry for planId=2 should exist");

    assert.equal(plan1Entry!.passed, 1);
    assert.equal(plan1Entry!.failed, 0);
    assert.equal(plan2Entry!.passed, 0);
    assert.equal(plan2Entry!.failed, 1);
});

test("computeSuiteStats: same planId and suiteId merges into one entry", () => {
    const rows: TestCaseRow[] = [
        makeRow({ planId: 1, suiteId: 10, outcome: "Passed", testCaseId: 1 }),
        makeRow({ planId: 1, suiteId: 10, outcome: "Failed", testCaseId: 2 }),
    ];

    const stats = computeSuiteStats(rows);
    const entries = Object.values(stats);

    assert.equal(entries.length, 1, "expected one merged entry for same plan+suite");
    assert.equal(entries[0].total, 2);
    assert.equal(entries[0].passed, 1);
    assert.equal(entries[0].failed, 1);
});

test("computeSuiteStats: SuiteStat carries suiteName and planId", () => {
    const rows: TestCaseRow[] = [
        makeRow({ planId: 5, suiteId: 99, suiteName: "Smoke", testCaseId: 1 }),
    ];

    const stats = computeSuiteStats(rows);
    const entry = Object.values(stats)[0];

    assert.equal(entry.suiteName, "Smoke");
    assert.equal(entry.planId, 5);
});
