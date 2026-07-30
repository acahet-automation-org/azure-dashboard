import { useMemo, useState, type ReactNode } from "react";
import { useMsal } from "@azure/msal-react";
import {
    EMPTY_SCOPE,
    ScopeContext,
    scopeStorageKey,
    type Scope,
} from "./scopeContext";

function readStoredScope(key: string): Scope {
    const raw = localStorage.getItem(key);

    if (!raw) {
        return EMPTY_SCOPE;
    }

    try {
        const parsed = JSON.parse(raw);

        return {
            project: typeof parsed.project === "string" ? parsed.project : null,
            areaPaths: Array.isArray(parsed.areaPaths) ? parsed.areaPaths : [],
            iterations: Array.isArray(parsed.iterations) ? parsed.iterations : [],
        };
    } catch {
        return EMPTY_SCOPE;
    }
}

// Mounted inside AuthenticatedTemplate (see App.tsx) so it structurally
// cannot exist for a signed-out user - there is no scope, and therefore no
// way for a gated query to become enabled, before login.
export function ScopeProvider({ children }: { children: ReactNode }) {
    const { instance, accounts } = useMsal();
    const activeAccount = instance.getActiveAccount() ?? accounts[0];
    // "local-dev" only applies under VITE_SKIP_AUTH, where there is no
    // signed-in MSAL account to key storage by.
    const storageKey = scopeStorageKey(
        activeAccount?.localAccountId ?? "local-dev"
    );

    const [scope, setScope] = useState<Scope>(() => readStoredScope(storageKey));

    const value = useMemo(() => {
        const persist = (next: Scope) => {
            localStorage.setItem(storageKey, JSON.stringify(next));
            setScope(next);
        };

        return {
            ...scope,
            isComplete: scope.project !== null,
            setProject: (project: string | null) =>
                // Area paths/iterations belong to the previous project's
                // tree, so they can't carry over to the new one.
                persist({ project, areaPaths: [], iterations: [] }),
            setAreaPaths: (areaPaths: string[]) =>
                persist({ ...scope, areaPaths }),
            setIterations: (iterations: string[]) =>
                persist({ ...scope, iterations }),
            reset: () => persist(EMPTY_SCOPE),
        };
    }, [scope, storageKey]);

    return (
        <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
    );
}
