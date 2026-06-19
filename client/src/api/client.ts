import type {
    SuiteStat,
    DashboardResponse,
    RunCard,
    AutomationDashboardResponse,
    ExecutionTrendResponse,
    TestPlanSummary,
    TestSuiteSummary,
    DefectDashboardResponse,
} from "../types";

async function getJson<T>(url: string): Promise<T> {
    const res = await fetch(url);

    if (!res.ok) {
        const body = await res
            .json()
            .catch(() => null);

        throw new Error(
            body?.message ??
                `Request to ${url} failed (${res.status})`
        );
    }

    return res.json();
}

export function fetchSuites(): Promise<
    Record<string, SuiteStat>
> {
    return getJson("/api/suites");
}

export function fetchDashboard(): Promise<DashboardResponse> {
    return getJson("/api/dashboard");
}

export function fetchRuns(): Promise<RunCard[]> {
    return getJson("/api/runs");
}

export function fetchPlans(): Promise<TestPlanSummary[]> {
    return getJson("/api/plans");
}

export function fetchPlanSuites(
    planId: number
): Promise<TestSuiteSummary[]> {
    return getJson(`/api/plans/${planId}/suites`);
}

export function fetchAutomationDashboard(): Promise<AutomationDashboardResponse> {
    return getJson("/api/automation");
}

export function fetchExecutionTrend(): Promise<ExecutionTrendResponse> {
    return getJson("/api/execution-trend");
}

export function fetchDefects(): Promise<DefectDashboardResponse> {
    return getJson("/api/defects");
}

export async function postRefresh(): Promise<void> {
    const res = await fetch("/api/refresh", {
        method: "POST",
    });

    if (!res.ok) {
        throw new Error(
            `Refresh failed (${res.status})`
        );
    }
}
