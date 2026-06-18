export type Outcome =
    | "Passed"
    | "Failed"
    | "Blocked"
    | "NotRun";

export interface BugInfo {
    id: number;
    title: string;
    state: string;
}

export interface TestCaseRow {
    areaPath: string;
    suiteName: string;
    testCaseId: number;
    testCaseTitle: string;
    testCaseUrl?: string;
    priority: number;
    hasOpenBugs: boolean;
    outcome: Outcome;
    bugs: BugInfo[];
}

export interface SuiteStat {
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    notRun: number;
    openBugs: number;
}

export interface RunCard {
    id: number;
    name: string;
    state: string;
    startedDate?: string;
    completedDate?: string;
    url?: string;
    counts: Record<Outcome, number>;
    total: number;
    passRate: number;
}

export interface DashboardStats {
    areaPaths: string[];
    suites: string[];
    priorities: number[];
    totalTestCases: number;
    withOpenBugs: number;
    withoutOpenBugs: number;
    passedCount: number;
    failedCount: number;
    blockedCount: number;
    notRunCount: number;
    passRate: number;
    groupedByPriority: Record<string, TestCaseRow[]>;
}

export interface DashboardResponse {
    stats: DashboardStats;
    cacheTimestamp: number;
}
