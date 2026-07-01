import { InteractionRequiredAuthError } from "@azure/msal-browser";
import type {
    SuiteStat,
    DashboardResponse,
    RunCard,
    AutomationDashboardResponse,
    ExecutionTrendResponse,
    TestPlanSummary,
    TestSuiteSummary,
    DefectDashboardResponse,
    DefectFilters,
    CommonErrorsResponse,
    WorkItemSummary,
    MyWorkItemsMode,
    PlanOverviewResponse,
    TestPlanProgressResponse,
    BugInfo,
} from "../types";
import { loginRequest } from "../authConfig";
import { msalInstance } from "../msalInstance";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const skipAuth = import.meta.env.VITE_SKIP_AUTH === "true";

async function getAccessToken(): Promise<string> {
    const account =
        msalInstance.getActiveAccount() ??
        msalInstance.getAllAccounts()[0];

    if (!account) {
        throw new Error("No signed-in account");
    }

    try {
        const result = await msalInstance.acquireTokenSilent({
            ...loginRequest,
            account,
        });

        return result.accessToken;
    } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
            await msalInstance.acquireTokenRedirect({
                ...loginRequest,
                account,
            });
        }

        throw error;
    }
}

async function authorizedFetch(
    path: string,
    init: RequestInit = {}
): Promise<Response> {
    if (skipAuth) {
        return fetch(`${API_BASE_URL}${path}`, init);
    }

    const accessToken = await getAccessToken();

    return fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: {
            ...init.headers,
            Authorization: `Bearer ${accessToken}`,
        },
    });
}

async function getJson<T>(url: string): Promise<T> {
    const res = await authorizedFetch(url);

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

export function fetchPlanOverview(
    planId: number
): Promise<PlanOverviewResponse> {
    return getJson(`/api/plans/${planId}/overview`);
}

export function fetchPlanProgress(
    planId: number
): Promise<TestPlanProgressResponse> {
    return getJson(`/api/plans/${planId}/progress`);
}

export function fetchPlanProgressBugs(
    planId: number,
    suiteIds: number[]
): Promise<BugInfo[]> {
    const qs = suiteIds.length ? `?suiteIds=${suiteIds.join(",")}` : "";

    return getJson(`/api/plans/${planId}/progress/bugs${qs}`);
}

export function fetchAutomationDashboard(
    planId?: number
): Promise<AutomationDashboardResponse> {
    const qs = planId != null ? `?planId=${planId}` : "";

    return getJson(`/api/automation${qs}`);
}

export function fetchExecutionTrend(): Promise<ExecutionTrendResponse> {
    return getJson("/api/execution-trend");
}

export function fetchDefects(
    filters?: DefectFilters,
    project?: string
): Promise<DefectDashboardResponse> {
    const params = new URLSearchParams();

    if (filters?.iteration) params.set("iteration", filters.iteration);
    if (filters?.area) params.set("area", filters.area);
    if (filters?.environment) params.set("environment", filters.environment);
    if (filters?.targetVersion) params.set("targetVersion", filters.targetVersion);
    if (project) params.set("project", project);

    const qs = params.toString();

    return getJson(`/api/defects${qs ? `?${qs}` : ""}`);
}

export function fetchCommonErrors(): Promise<CommonErrorsResponse> {
    return getJson("/api/common-errors");
}

export function fetchMyWorkItems(
    mode: MyWorkItemsMode
): Promise<WorkItemSummary[]> {
    return getJson(`/api/my-work-items?mode=${mode}`);
}

export async function sendEmailReport(payload: {
    subject: string;
    bodyHtml: string;
    pdfBase64: string;
    filename: string;
    fromName: string;
}): Promise<void> {
    const res = await authorizedFetch("/api/email-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const body = await res
            .json()
            .catch(() => null);

        throw new Error(
            body?.message ?? `Email report failed (${res.status})`
        );
    }
}

export async function postRefresh(): Promise<void> {
    const res = await authorizedFetch("/api/refresh", {
        method: "POST",
    });

    if (!res.ok) {
        throw new Error(
            `Refresh failed (${res.status})`
        );
    }
}
