// Shared by every *Data.ts module that narrows an already-fetched,
// per-project dataset down to the area paths/iterations selected in the
// client's global scope bar (see ScopeContext.tsx) - the per-page filters
// (DefectFilterBar, IterationFilter) then narrow further within whatever
// this already let through.
//
// An empty scope list means "no restriction" (not "match nothing") - that's
// the state before the user has picked anything within that field, and
// selecting a project alone should still show that project's full dataset.

// Azure DevOps area paths are hierarchical ("Nuova Frontiera\Backend\API" is
// under "Nuova Frontiera\Backend"), so a selected area path also matches
// everything nested under it, not just an exact string match.
export function areaPathInScope(
    areaPath: string | undefined,
    scopedAreaPaths: string[]
): boolean {
    if (scopedAreaPaths.length === 0) {
        return true;
    }

    if (!areaPath) {
        return false;
    }

    return scopedAreaPaths.some(
        (scoped) => areaPath === scoped || areaPath.startsWith(`${scoped}\\`)
    );
}

// Iterations (sprints) are selected as specific leaf nodes in the scope bar,
// so unlike area paths this is an exact match rather than a prefix match.
export function iterationInScope(
    iteration: string | undefined,
    scopedIterations: string[]
): boolean {
    if (scopedIterations.length === 0) {
        return true;
    }

    return iteration != null && scopedIterations.includes(iteration);
}
