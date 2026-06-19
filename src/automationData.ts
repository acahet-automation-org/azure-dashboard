import type {
    AutomationKpis,
    CiCdMetrics,
    AutomationCharts,
    AutomationDashboardResponse,
} from "./types.js";

let cacheTimestamp = 0;

export function getCacheTimestamp(): number {
    return cacheTimestamp;
}

export function getAutomationKpis(): AutomationKpis {
    return {
        automatedTests: 842,
        manualTests: 318,
        automationCoveragePct: 72.6,
        flakyTestsCount: 14,
        automationSuccessRatePct: 94.1,
    };
}

export function getCiCdMetrics(): CiCdMetrics {
    return {
        pipelineSuccessRatePct: 91.3,
        pipelineFailureRatePct: 8.7,
        avgPipelineDurationMinutes: 17.4,
        testExecutionTimeMinutes: 9.8,
    };
}

export function getAutomationCharts(): AutomationCharts {
    return {
        coverageByModule: [
            { module: "Checkout", automated: 120, manual: 30, coveragePct: 80 },
            { module: "Catalog", automated: 95, manual: 55, coveragePct: 63.3 },
            { module: "Account", automated: 110, manual: 20, coveragePct: 84.6 },
            { module: "Payments", automated: 88, manual: 42, coveragePct: 67.7 },
            { module: "Search", automated: 76, manual: 24, coveragePct: 76 },
            { module: "Admin", automated: 60, manual: 60, coveragePct: 50 },
        ],
        flakyTestRanking: [
            { testCaseId: 10231, testName: "Checkout - apply promo code", flakeCount: 9, lastFailedDate: "2026-06-15" },
            { testCaseId: 10487, testName: "Search - filter by price range", flakeCount: 7, lastFailedDate: "2026-06-16" },
            { testCaseId: 10092, testName: "Account - reset password email", flakeCount: 6, lastFailedDate: "2026-06-14" },
            { testCaseId: 10355, testName: "Payments - 3D secure redirect", flakeCount: 5, lastFailedDate: "2026-06-17" },
            { testCaseId: 10678, testName: "Catalog - lazy load images", flakeCount: 4, lastFailedDate: "2026-06-12" },
            { testCaseId: 10199, testName: "Admin - bulk export CSV", flakeCount: 3, lastFailedDate: "2026-06-10" },
        ],
        pipelineSuccessTrend: [
            { date: "2026-06-05", successRatePct: 88 },
            { date: "2026-06-06", successRatePct: 90 },
            { date: "2026-06-07", successRatePct: 86 },
            { date: "2026-06-08", successRatePct: 92 },
            { date: "2026-06-09", successRatePct: 89 },
            { date: "2026-06-10", successRatePct: 93 },
            { date: "2026-06-11", successRatePct: 91 },
            { date: "2026-06-12", successRatePct: 95 },
            { date: "2026-06-13", successRatePct: 90 },
            { date: "2026-06-14", successRatePct: 94 },
            { date: "2026-06-15", successRatePct: 87 },
            { date: "2026-06-16", successRatePct: 92 },
            { date: "2026-06-17", successRatePct: 96 },
            { date: "2026-06-18", successRatePct: 91 },
        ],
    };
}

export async function getAutomationDashboard(): Promise<AutomationDashboardResponse> {
    cacheTimestamp = Date.now();

    return {
        kpis: getAutomationKpis(),
        ciCd: getCiCdMetrics(),
        charts: getAutomationCharts(),
        cacheTimestamp,
    };
}
