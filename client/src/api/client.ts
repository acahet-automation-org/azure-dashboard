import type {
    SuiteStat,
    DashboardResponse,
    RunCard,
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
