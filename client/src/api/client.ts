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
    ProjectSummary,
    AreaPathNode,
} from "../types";
import { loginRequest } from "../authConfig";
import { msalInstance } from "../msalInstance";
import i18n from "../i18n";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const skipAuth = import.meta.env.VITE_SKIP_AUTH === "true";

// Every page-level query that needs auth calls getAccessToken() independently,
// and since the scope bar now restores the last-used project from
// localStorage (see ScopeContext.tsx), a single page load can mount a dozen
// of them at once. If the cached token needs interactive renewal, each would
// otherwise call acquireTokenRedirect() on its own - concurrent redirect
// attempts race before the browser actually navigates away and corrupt
// MSAL's redirect state in sessionStorage, which is what surfaces later as
// "timed_out" on unrelated login attempts. Same fix as mailGraphAuth.ts's
// inFlight guard for loginPopup: only ever kick off one redirect per page
// load, and let concurrent callers await that same one.
let redirectInFlight: Promise<void> | null = null;

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
            if (!redirectInFlight) {
                redirectInFlight = msalInstance.acquireTokenRedirect({
                    ...loginRequest,
                    account,
                });
            }

            await redirectInFlight;
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

export function fetchSuites(project?: string): Promise<
    Record<string, SuiteStat>
> {
    const qs = project ? `?project=${encodeURIComponent(project)}` : "";

    return getJson(`/api/suites${qs}`);
}

export function fetchDashboard(
    iteration?: string,
    project?: string
): Promise<DashboardResponse> {
    const params = new URLSearchParams();

    if (iteration) params.set("iteration", iteration);
    if (project) params.set("project", project);

    const qs = params.toString();

    return getJson(`/api/dashboard${qs ? `?${qs}` : ""}`);
}

export function fetchRuns(project?: string): Promise<RunCard[]> {
    const qs = project ? `?project=${encodeURIComponent(project)}` : "";

    return getJson(`/api/runs${qs}`);
}

export function fetchPlans(project?: string): Promise<TestPlanSummary[]> {
    const qs = project ? `?project=${encodeURIComponent(project)}` : "";

    return getJson(`/api/plans${qs}`);
}

export function fetchIterations(project?: string): Promise<IterationNode[]> {
    const qs = project ? `?project=${encodeURIComponent(project)}` : "";

    return getJson(`/api/iterations${qs}`);
}

export function fetchProjects(): Promise<ProjectSummary[]> {
    return getJson("/api/projects");
}

export function fetchAreaPaths(project: string): Promise<AreaPathNode[]> {
    return getJson(`/api/areas?project=${encodeURIComponent(project)}`);
}

export function fetchPlanSuites(
    planId: number,
    project?: string
): Promise<TestSuiteSummary[]> {
    const qs = project ? `?project=${encodeURIComponent(project)}` : "";

    return getJson(`/api/plans/${planId}/suites${qs}`);
}

export function fetchPlanOverview(
    planId: number,
    project?: string
): Promise<PlanOverviewResponse> {
    const qs = project ? `?project=${encodeURIComponent(project)}` : "";

    return getJson(`/api/plans/${planId}/overview${qs}`);
}

export function fetchPlanProgress(
    planId: number,
    project?: string
): Promise<TestPlanProgressResponse> {
    const qs = project ? `?project=${encodeURIComponent(project)}` : "";

    return getJson(`/api/plans/${planId}/progress${qs}`);
}

export function fetchPlanProgressBugs(
    planId: number,
    suiteIds: number[],
    project?: string
): Promise<BugInfo[]> {
    const params = new URLSearchParams();

    if (suiteIds.length) params.set("suiteIds", suiteIds.join(","));
    if (project) params.set("project", project);

    const qs = params.toString();

    return getJson(`/api/plans/${planId}/progress/bugs${qs ? `?${qs}` : ""}`);
}

export function fetchAutomationDashboard(
    planId?: number,
    iteration?: string,
    project?: string
): Promise<AutomationDashboardResponse> {
    const params = new URLSearchParams();

    if (planId != null) params.set("planId", String(planId));
    if (iteration) params.set("iteration", iteration);
    if (project) params.set("project", project);

    const qs = params.toString();
    const url = qs ? `/api/automation?${qs}` : "/api/automation";

    return getJson(url);
}

export function fetchExecutionTrend(project?: string): Promise<ExecutionTrendResponse> {
    const qs = project ? `?project=${encodeURIComponent(project)}` : "";

    return getJson(`/api/execution-trend${qs}`);
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
    filters?.suites?.forEach((suite) => params.append("suite", suite));

    const qs = params.toString();

    return getJson(`/api/defects${qs ? `?${qs}` : ""}`);
}

export function fetchReleaseReadiness(
    iteration?: string,
    project?: string
): Promise<ReleaseReadinessResponse> {
    const params = new URLSearchParams();

    if (iteration) params.set("iteration", iteration);
    if (project) params.set("project", project);

    const qs = params.toString();

    return getJson(`/api/release-readiness${qs ? `?${qs}` : ""}`);
}

export function fetchNavBadges(project?: string): Promise<NavBadgesResponse> {
    const qs = project ? `?project=${encodeURIComponent(project)}` : "";

    return getJson(`/api/nav-badges${qs}`);
}

export function fetchCommonErrors(project?: string): Promise<CommonErrorsResponse> {
    const qs = project ? `?project=${encodeURIComponent(project)}` : "";

    return getJson(`/api/common-errors${qs}`);
}

export function fetchMyWorkItems(
    mode: MyWorkItemsMode,
    project?: string
): Promise<WorkItemSummary[]> {
    const params = new URLSearchParams({ mode });

    if (project) params.set("project", project);

    return getJson(`/api/my-work-items?${params.toString()}`);
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
    project?: string
): Promise<DeleteTestCasesResult> {
    const res = await authorizedFetch("/api/test-cases/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, project }),
    });

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
