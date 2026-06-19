import type { TestCaseRow } from "../types";

export interface GroupStats {
    total: number;
    withOpenBugs: number;
    withoutOpenBugs: number;
    activeBugs: number;
    closedBugs: number;
    passed: number;
    failed: number;
    blocked: number;
    notRun: number;
    passRate: number;
}

export function computeGroupStats(
    rows: TestCaseRow[]
): GroupStats {
    let withOpenBugs = 0;
    let activeBugs = 0;
    let closedBugs = 0;
    let passed = 0;
    let failed = 0;
    let blocked = 0;
    let notRun = 0;

    for (const tc of rows) {
        const active = tc.bugs.filter((b) => b.state !== "Closed").length;

        activeBugs += active;
        closedBugs += tc.bugs.length - active;

        if (tc.hasOpenBugs) {
            withOpenBugs++;
        }

        if (tc.outcome === "Passed") {
            passed++;
        } else if (tc.outcome === "Failed") {
            failed++;
        } else if (tc.outcome === "Blocked") {
            blocked++;
        } else {
            notRun++;
        }
    }

    const total = rows.length;
    const passRate = total
        ? Math.round((passed / total) * 1000) / 10
        : 0;

    return {
        total,
        withOpenBugs,
        withoutOpenBugs: total - withOpenBugs,
        activeBugs,
        closedBugs,
        passed,
        failed,
        blocked,
        notRun,
        passRate,
    };
}
