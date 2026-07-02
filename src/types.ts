export type Outcome =
    | "Passed"
    | "Failed"
    | "Blocked"
    | "NotRun";

export interface BugInfo {
    id: number;
    title: string;
    state: string;
    url?: string;
    creator?: string;
    assignee?: {
        displayName: string;
        uniqueName: string;
    };
}

export type MyWorkItemsMode = "assigned" | "mentioned" | "following";

export interface WorkItemSummary {
    id: number;
    title: string;
    type: string;
    state: string;
    priority?: number;
    changedDate?: string;
    url?: string;
    assignee?: {
        displayName: string;
        uniqueName: string;
    };
    mentions?: string[];
}

export interface TestCaseRow {
    planName: string;
    areaPath: string;
    iteration?: string;
    suiteName: string;
    testCaseId: number;
    testCaseTitle: string;
    testCaseUrl?: string;
    priority: number;
    hasOpenBugs: boolean;
    outcome: Outcome;
    bugs: BugInfo[];
    lastRunId?: number;
    lastRunUrl?: string;
}

export interface SuiteStat {
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    notRun: number;
    openBugs: number;
}

export interface TestPlanSummary {
    id: number;
    name: string;
    url?: string;
    areaPath?: string;
    iteration?: string;
    state?: string;
    owner?: string;
}

export interface TestCaseSummary {
    id: number;
    title: string;
}

export interface TestSuiteSummary {
    id: number;
    name: string;
    testCases: TestCaseSummary[];
    children: TestSuiteSummary[];
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

export interface AutomationTestCaseRow {
    testCaseId: number;
    testCaseTitle: string;
    planId: number;
    planName: string;
    areaPath: string;
    suiteName: string;
    isAutomated: boolean;
}

export interface AutomationResultOccurrence {
    testCaseId: number;
    outcome: Outcome;
    completedDate?: string;
}

export interface AutomationKpis {
    automatedTests: number;
    manualTests: number;
    automationCoveragePct: number;
    flakyTestsCount: number;
    automationSuccessRatePct: number;
}

export interface CiCdMetrics {
    pipelineSuccessRatePct: number;
    pipelineFailureRatePct: number;
    avgPipelineDurationMinutes: number;
    testExecutionTimeMinutes: number;
}

export interface CoverageByModule {
    module: string;
    automated: number;
    manual: number;
    coveragePct: number;
}

export interface FlakyTestRankItem {
    testCaseId: number;
    testName: string;
    flakeCount: number;
    lastFailedDate?: string;
}

export interface PipelineSuccessTrendPoint {
    date: string;
    successRatePct: number;
}

export interface AutomationCharts {
    coverageByModule: CoverageByModule[];
    flakyTestRanking: FlakyTestRankItem[];
    pipelineSuccessTrend: PipelineSuccessTrendPoint[];
}

export interface AutomationDashboardResponse {
    kpis: AutomationKpis;
    ciCd: CiCdMetrics;
    charts: AutomationCharts;
    cacheTimestamp: number;
    planId: number | null;
    automatedPlanIds: number[];
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
    executedCount: number;
    passRate: number;
    groupedByPriority: Record<string, TestCaseRow[]>;
}

export interface TrendPoint {
    date: string;
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    notRun: number;
    passRate: number;
    cumulativeExecuted: number;
}

export interface ExecutionTrendResponse {
    trend: TrendPoint[];
    totalTestCases: number;
}

export interface AffectedTestCase {
    id: number;
    title: string;
}

export interface ErrorSummary {
    signature: string;
    sampleMessage: string;
    count: number;
    affectedTestCases: AffectedTestCase[];
    lastOccurred?: string;
}

export interface CommonErrorsResponse {
    errors: ErrorSummary[];
    totalFailedResults: number;
    cacheTimestamp: number;
}

export interface DefectRecord {
    id: number;
    title: string;
    state: string;
    reason?: string;
    severity?: string;
    priority?: number;
    areaPath: string;
    iterationPath?: string;
    environment?: string;
    createdDate: string;
    closedDate?: string;
    changedDate: string;
    reopenedCount: number;
    hasLinkedTestCase: boolean;
    url?: string;
    creator?: string;
}

export interface DefectSummary {
    id: number;
    title: string;
    state: string;
    priority?: number;
    severity?: string;
    ageDays?: number;
    url?: string;
    creator?: string;
}

export type DefectWithoutTestCase = DefectSummary;

export interface DefectTrendPoint {
    weekStart: string;
    opened: number;
    closed: number;
    openTotal: number;
}

export interface BacklogTrendPoint extends DefectTrendPoint {
    delta: number;
}

export interface AgingBucket {
    bucket: string;
    count: number;
}

export type BacklogDirection = "growing" | "stable" | "shrinking";

export interface DefectFilterOptions {
    iterations: string[];
    areas: string[];
    environments: string[];
    targetVersions: string[];
}

export interface DefectFilterParams {
    iteration?: string;
    area?: string;
    environment?: string;
    targetVersion?: string;
}

export interface DefectStats {
    totalOpen: number;
    totalClosed: number;
    bySeverity: Record<string, number>;
    byPriority: Record<string, number>;
    byComponent: Record<string, number>;
    byTeam: Record<string, number>;
    trend: DefectTrendPoint[];
    mttrDays: number | null;
    agingBuckets: AgingBucket[];
    reopenedBugCount: number;
    duplicateRate: number;
    bugsPerStory: number | null;
    defectsWithoutLinkedTestCase: DefectWithoutTestCase[];
    defectLeakageRate: number | null;
    defectRejectionRate: number;
    rejectionReasons: Record<string, number>;
    firstTimeFixRate: number | null;
    densityByComponent: Record<string, number | null>;
    backlogTrend: BacklogTrendPoint[];
    backlogDirection: BacklogDirection;
    slaBreaches: DefectSummary[];
    availableFilters: DefectFilterOptions;
}

export interface DefectDashboardResponse {
    stats: DefectStats;
    cacheTimestamp: number;
}

export interface PlanOverviewBugState {
    name: string;
    color: string;
    category: string;
}

export interface PlanOverviewBugStateCount {
    state: string;
    count: number;
    color?: string;
    category?: string;
}

export interface PlanOverviewSuiteCount {
    suiteName: string;
    count: number;
}

export interface PlanOverviewSuiteDetail {
    suiteName: string;
    totalTestCases: number;
    outcomeCounts: Record<Outcome, number>;
    bugs: BugInfo[];
}

export interface PlanOverviewResponse {
    planId: number;
    planName: string;
    totalTestCases: number;
    totalBugs: number;
    testsBySuite: PlanOverviewSuiteCount[];
    outcomeCounts: Record<Outcome, number>;
    bugStates: PlanOverviewBugState[];
    bugsByState: PlanOverviewBugStateCount[];
    bugs: BugInfo[];
    suites: PlanOverviewSuiteDetail[];
}

// Sourced from the Analytics OData feed (TestPointHistorySnapshot), which
// has a `NotApplicable` bucket the REST-based `Outcome` union above doesn't,
// so this is intentionally its own shape rather than reusing `Outcome`.
export interface TestPlanProgressCounts {
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    notApplicable: number;
    notExecuted: number;
}

export interface TestPlanProgressNode {
    id: number;
    title: string;
    counts: TestPlanProgressCounts;
    children: TestPlanProgressNode[];
}

export interface TestPlanProgressResponse {
    planId: number;
    planTitle: string;
    nodes: TestPlanProgressNode[];
}

export interface DeleteTestCasesResult {
    deleted: number[];
    failed: { id: number; message: string }[];
}
