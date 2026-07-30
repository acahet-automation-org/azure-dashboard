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
    DeleteTestCaseItem,
    DeleteTestCasesResult,
    ReleaseReadinessResponse,
    NavBadgesResponse,
    IterationNode,
} from "../types";
import { loginRequest } from "../authConfig";
import { msalInstance } from "../msalInstance";
import i18n from "../i18n";
import type { Scope } from "../hooks/scopeContext";

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

async function throwForErrorResponse(
    res: Response,
    fallbackMessage: string
): Promise<never> {
    const body = await res.json().catch(() => null);

    if (body?.message) {
        throw new Error(body.message);
    }

    // 502/503 without a JSON body means something in front of our API (the
    // host, a proxy) is down or restarting rather than our own route code
    // having thrown - the backend normally translates an expired/invalid
    // AZDO_PAT into a 502 with an explicit message handled above.
    if (res.status === 502 || res.status === 503) {
        throw new Error(i18n.t("errorState.serviceUnavailable"));
    }

    throw new Error(fallbackMessage);
}

async function getJson<T>(url: string): Promise<T> {
    const res = await authorizedFetch(url);

    if (!res.ok) {
        await throwForErrorResponse(
            res,
            `Request to ${url} failed (${res.status})`
        );
    }

    return res.json();
}

// Appends the global scope-bar selection (see ScopeContext) to a request -
// named `scopeAreaPath`/`scopeIteration` on the wire, distinct from several
// endpoints' own single-select `iteration`/`area` params (a page's local
// filter, which narrows further within whatever this already scoped down
// to - see the server's matching resolveScopeAreaPaths/resolveScopeIterations
// in src/server.ts).
function withScope(path: string, scope: Scope): string {
    const params = new URLSearchParams();

    if (scope.project) {
        params.set("project", scope.project);
    }

    scope.areaPaths.forEach((areaPath) =>
        params.append("scopeAreaPath", areaPath)
    );
    scope.iterations.forEach((iteration) =>
        params.append("scopeIteration", iteration)
    );

    const qs = params.toString();

    return qs ? `${path}${path.includes("?") ? "&" : "?"}${qs}` : path;
}

export function fetchSuites(
    scope: Scope
): Promise<
    Record<string, SuiteStat>
> {
    return getJson(withScope("/api/suites", scope));
}

export function fetchDashboard(
    scope: Scope,
    iteration?: string
): Promise<DashboardResponse> {
    const qs = iteration
        ? `?iteration=${encodeURIComponent(iteration)}`
        : "";

    return getJson(withScope(`/api/dashboard${qs}`, scope));
}

export function fetchRuns(scope: Scope): Promise<RunCard[]> {
    return getJson(withScope("/api/runs", scope));
}

export function fetchPlans(scope: Scope): Promise<TestPlanSummary[]> {
    return getJson(withScope("/api/plans", scope));
}

export function fetchProjects(): Promise<string[]> {
    return getJson("/api/projects");
}

export function fetchIterations(
    project?: string
): Promise<IterationNode[]> {
    const qs = project ? `?project=${encodeURIComponent(project)}` : "";

    return getJson(`/api/iterations${qs}`);
}

// Same node shape as IterationNode - see AreaPathNode's doc comment in
// src/azdo.ts. Reusing the type client-side too rather than declaring a
// second identical interface.
export function fetchAreaPaths(
    project?: string
): Promise<IterationNode[]> {
    const qs = project ? `?project=${encodeURIComponent(project)}` : "";

    return getJson(`/api/areapaths${qs}`);
}

export function fetchPlanSuites(
    planId: number,
    scope: Scope
): Promise<TestSuiteSummary[]> {
    return getJson(withScope(`/api/plans/${planId}/suites`, scope));
}

export function fetchPlanOverview(
    planId: number,
    scope: Scope
): Promise<PlanOverviewResponse> {
    return getJson(withScope(`/api/plans/${planId}/overview`, scope));
}

export function fetchPlanProgress(
    planId: number,
    scope: Scope
): Promise<TestPlanProgressResponse> {
    return getJson(withScope(`/api/plans/${planId}/progress`, scope));
}

export function fetchPlanProgressBugs(
    planId: number,
    suiteIds: number[],
    scope: Scope
): Promise<BugInfo[]> {
    const qs = suiteIds.length ? `?suiteIds=${suiteIds.join(",")}` : "";

    return getJson(
        withScope(`/api/plans/${planId}/progress/bugs${qs}`, scope)
    );
}

export function fetchAutomationDashboard(
    scope: Scope,
    planId?: number,
    iteration?: string
): Promise<AutomationDashboardResponse> {
    const params = new URLSearchParams();

    if (planId != null) params.set("planId", String(planId));
    if (iteration) params.set("iteration", iteration);

    const qs = params.toString();
    const url = qs ? `/api/automation?${qs}` : "/api/automation";

    return getJson(withScope(url, scope));
}

export function fetchExecutionTrend(
    scope: Scope
): Promise<ExecutionTrendResponse> {
    return getJson(withScope("/api/execution-trend", scope));
}

export function fetchDefects(
    scope: Scope,
    filters?: DefectFilters
): Promise<DefectDashboardResponse> {
    const params = new URLSearchParams();

    if (filters?.iteration) params.set("iteration", filters.iteration);
    if (filters?.area) params.set("area", filters.area);
    if (filters?.environment) params.set("environment", filters.environment);
    if (filters?.targetVersion) params.set("targetVersion", filters.targetVersion);
    filters?.suites?.forEach((suite) => params.append("suite", suite));

    const qs = params.toString();

    return getJson(withScope(`/api/defects${qs ? `?${qs}` : ""}`, scope));
}

export function fetchReleaseReadiness(
    scope: Scope,
    iteration?: string
): Promise<ReleaseReadinessResponse> {
    const qs = iteration
        ? `?iteration=${encodeURIComponent(iteration)}`
        : "";

    return getJson(withScope(`/api/release-readiness${qs}`, scope));
}

export function fetchNavBadges(scope: Scope): Promise<NavBadgesResponse> {
    return getJson(withScope("/api/nav-badges", scope));
}

export function fetchCommonErrors(
    scope: Scope
): Promise<CommonErrorsResponse> {
    return getJson(withScope("/api/common-errors", scope));
}

export function fetchMyWorkItems(
    mode: MyWorkItemsMode,
    scope: Scope
): Promise<WorkItemSummary[]> {
    return getJson(withScope(`/api/my-work-items?mode=${mode}`, scope));
}

export async function sendEmailReport(payload: {
    subject: string;
    bodyHtml: string;
    pdfBase64?: string;
    filename?: string;
    fromName: string;
}): Promise<void> {
    const res = await authorizedFetch("/api/email-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        await throwForErrorResponse(
            res,
            `Email report failed (${res.status})`
        );
    }
}

export async function deleteTestCases(
    items: DeleteTestCaseItem[],
    scope: Scope
): Promise<DeleteTestCasesResult> {
    const res = await authorizedFetch(
        withScope("/api/test-cases/delete", scope),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
        }
    );

    if (!res.ok) {
        await throwForErrorResponse(
            res,
            `Delete failed (${res.status})`
        );
    }

    return res.json();
}

export async function postRefresh(): Promise<void> {
    const res = await authorizedFetch("/api/refresh", {
        method: "POST",
    });

    if (!res.ok) {
        await throwForErrorResponse(
            res,
            `Refresh failed (${res.status})`
        );
    }
}
