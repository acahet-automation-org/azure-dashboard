// Shared by every *Data.ts module's per-project cache (dashboardData,
// defectData, automationData, errorAggregationData) - each was fetching a
// different shape of data but repeating the same "Map keyed by project,
// entries expire after a fixed duration" bookkeeping, so it's factored out
// here once rather than duplicated per module.
export function createPerProjectCache<T>(durationMs: number) {
    const cache = new Map<string, { data: T; timestamp: number }>();

    return {
        get(project: string): T | undefined {
            const cached = cache.get(project);

            return cached && Date.now() - cached.timestamp < durationMs
                ? cached.data
                : undefined;
        },
        set(project: string, data: T): void {
            cache.set(project, { data, timestamp: Date.now() });
        },
        getTimestamp(project: string): number {
            return cache.get(project)?.timestamp ?? 0;
        },
        clear(project?: string): void {
            if (project) {
                cache.delete(project);
            } else {
                cache.clear();
            }
        },
    };
}
