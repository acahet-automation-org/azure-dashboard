export type Outcome =
    | "Passed"
    | "Failed"
    | "Blocked"
    | "NotApplicable"
    | "Paused"
    | "InProgress"
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

export type MyWorkItemsMode = "assigned" | "mentioned" | "following" | "created";

export interface WorkItemSummary {
    id: number;
    title: string;
    type: string;
    state: string;
    priority?: number;
    changedDate?: string;
    createdDate?: string;
    closedDate?: string;
    url?: string;
    assignee?: {
        displayName: string;
        uniqueName: string;
    };
    creator?: {
        displayName: string;
        uniqueName: string;
    };
    mentions?: string[];
    tags?: string[];
}

export interface TestCaseRow {
    planName: string;
    areaPath: string;
    iteration?: string;
    suiteName: string;
    suiteId: number;
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
    notApplicable: number;
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
    suiteId: number;
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
    notApplicableCount: number;
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
    notApplicable: number;
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

export type ClosureReason =
    | "Valid Defect"
    | "OutOfScope"
    | "Duplicate"
    | "Not Reproducible";

export interface DefectRecord {
    id: number;
    title: string;
    state: string;
    reason?: string;
    severity?: string;
    priority?: number;
    areaPath: string;
    iterationPath?: string;
    suiteName?: string;
    // Only set for bugs whose own suite doesn't map to a real Test Factory
    // suite (currently Test Agenti/Business) - the suite resolved by
    // matching the linked test case's title against its equivalently-titled
    // original in a genuine Test Factory suite. See getTestCaseLookups in
    // defectData.ts.
    resolvedSuiteName?: string;
    environment?: string;
    createdDate: string;
    closedDate?: string;
    changedDate: string;
    reopenedCount: number;
    hasLinkedTestCase: boolean;
    tags: string[];
    closureReason?: ClosureReason;
    url?: string;
    creator?: string;
    assignedTo?: { displayName: string; uniqueName: string };
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
    assignee?: { displayName: string; uniqueName: string };
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

export interface SprintDefectReport {
    total: number;
    effectiveCount: number;
    outOfScopeCount: number;
    byOrigin: Record<string, number>;
    // Like byOrigin, but counting every detected bug (including out-of-scope
    // ones) rather than just the effective/in-scope subset.
    byOriginDetected: Record<string, number>;
    byStatus: Record<string, number>;
    byStatusAll: Record<string, number>;
    bySeverity: Record<string, number>;
    // Effective (in-scope) bug count per suite, Test Factory suites only
    // (DSI and Test Agenti excluded) - zero-seeded so a suite with no bugs
    // still shows 0.
    testFactoryBySuite: Record<string, number>;
    // Same shape, but for Test Agenti/Business-origin bugs, bucketed by
    // their *resolved* suite (see DefectRecord.resolvedSuiteName) rather
    // than their own Custom.Suite value.
    testAgentiBySuite: Record<string, number>;
    testBusinessBySuite: Record<string, number>;
    effectiveDefects: DefectSummary[];
    // Both scoped to ALL detected bugs (like byStatusAll/total), not just
    // the effective subset - reopened/unresolved-time tracking applies to
    // out-of-scope bugs too.
    reopenedCount: number;
    mttrDays: number | null;
}

export interface DefectFilterOptions {
    iterations: string[];
    areas: string[];
    environments: string[];
    targetVersions: string[];
    suites: string[];
}

export interface DefectFilterParams {
    iteration?: string;
    area?: string;
    environment?: string;
    targetVersion?: string;
    suites?: string[];
}

export interface DefectStats {
    totalOpen: number;
    totalClosed: number;
    bySeverity: Record<string, number>;
    byPriority: Record<string, number>;
    byComponent: Record<string, number>;
    byTeam: Record<string, number>;
    byTestSuite: Record<string, number>;
    byAssignee: Record<string, number>;
    trend: DefectTrendPoint[];
    mttrDays: number | null;
    agingBuckets: AgingBucket[];
    reopenDistribution: AgingBucket[];
    reopenedBugCount: number;
    reopenRate: number;
    duplicateRate: number;
    bugsPerStory: number | null;
    defectsWithoutLinkedTestCase: DefectWithoutTestCase[];
    defectsWithoutSuite: DefectSummary[];
    defectLeakageRate: number | null;
    defectRejectionRate: number;
    regressionRate: number;
    rejectionReasons: Record<string, number>;
    closureReasonBreakdown: Record<string, number>;
    outOfScopeRate: number;
    outOfScopeBySuite: Record<string, number>;
    sprintDefectReport: SprintDefectReport;
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
    suiteId: number;
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

export interface DeleteTestCaseItem {
    planId: number;
    suiteId: number;
    testCaseId: number;
}

export interface DeleteTestCasesResult {
    deleted: number[];
    failed: { id: number; message: string }[];
}

export interface SprintInfo {
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    hasEnded: boolean;
}

export type RagStatus = "green" | "amber" | "red";

// Mirrors the org's formal release exit-criteria checklist (code_coverage.md,
// "Criteri di Accettazione - Test Funzionali Manuali"): each row is either a
// hard BLOCK gate or a WARN (tracked-only, doesn't block release).
export type GateAction = "block" | "warn";

export type GateCriterionId =
    | "testsExecuted"
    | "testsPassed"
    | "requirementsCoverage"
    | "testCaseRelevance"
    | "criticalDefectsOpen"
    | "highDefectsOpen"
    | "mediumDefectsOpen"
    | "lowDefectsOpen";

export interface ReleaseGateCriterion {
    id: GateCriterionId;
    action: GateAction;
    target: string;
    // null when the underlying data isn't available yet (e.g. requirements
    // coverage needs test-case-to-requirement links that aren't built) -
    // the criterion is still listed, but excluded from the pass/fail count
    // and from the RAG computation.
    actual: string | null;
    tracked: boolean;
    passed: boolean;
}

export interface ReleaseGateSummary {
    ragStatus: RagStatus;
    criteria: ReleaseGateCriterion[];
    trackedCount: number;
    passingCount: number;
}

export interface SprintCompletion {
    plannedCount: number;
    executedCount: number;
    notExecutedCount: number;
    completionRatePct: number;
    carryOverCount: number;
}

export interface PassRateDelta {
    currentSprintPassRate: number | null;
    previousSprintPassRate: number | null;
    deltaPct: number | null;
    previousSprintName: string | null;
}

export interface BlockingDefect {
    id: number;
    title: string;
    severity?: string;
    priority?: number;
    state: string;
    url?: string;
    creator?: string;
}

export interface BlockingDefectsSummary {
    criticalCount: number;
    highCount: number;
    totalCount: number;
    items: BlockingDefect[];
}

export interface ReleaseReadinessResponse {
    sprint: SprintInfo;
    releaseGate: ReleaseGateSummary;
    completion: SprintCompletion;
    passRateDelta: PassRateDelta;
    blockingDefects: BlockingDefectsSummary;
    cacheTimestamp: number;
}

export interface NavBadgesResponse {
    openCriticalHighDefects: number;
}
