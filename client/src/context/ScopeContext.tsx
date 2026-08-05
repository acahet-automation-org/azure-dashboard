import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const SCOPE_STORAGE_KEY = "azureDashboardScope";

interface StoredScope {
    project: string;
    areaPath: string;
    sprint: string;
}

const EMPTY_SCOPE: StoredScope = { project: "", areaPath: "", sprint: "" };

function loadStoredScope(): StoredScope {
    try {
        const raw = localStorage.getItem(SCOPE_STORAGE_KEY);

        if (!raw) {
            return EMPTY_SCOPE;
        }

        const parsed = JSON.parse(raw);

        return {
            project: typeof parsed.project === "string" ? parsed.project : "",
            areaPath: typeof parsed.areaPath === "string" ? parsed.areaPath : "",
            sprint: typeof parsed.sprint === "string" ? parsed.sprint : "",
        };
    } catch {
        return EMPTY_SCOPE;
    }
}

export interface Scope {
    project: string;
    areaPath: string;
    sprint: string;
    setProject: (project: string) => void;
    setAreaPath: (areaPath: string) => void;
    setSprint: (sprint: string) => void;
    // The one hard requirement before any page fires a query - matches how
    // every page already treats iteration/area as optional filters (empty
    // string = no filter). Not tied to any signed-in account: this is a
    // single shared localStorage key, independent of which MSAL account (if
    // any) is currently signed in.
    isComplete: boolean;
}

const ScopeContext = createContext<Scope | null>(null);

export function ScopeProvider({ children }: { children: ReactNode }) {
    const [scope, setScope] = useState<StoredScope>(loadStoredScope);

    useEffect(() => {
        localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify(scope));
    }, [scope]);

    // Area/sprint belong to whichever project they were picked under -
    // switching project makes them stale, so they reset together.
    const setProject = (project: string) => {
        setScope({ project, areaPath: "", sprint: "" });
    };

    const setAreaPath = (areaPath: string) => {
        setScope((prev) => ({ ...prev, areaPath }));
    };

    const setSprint = (sprint: string) => {
        setScope((prev) => ({ ...prev, sprint }));
    };

    const value: Scope = {
        ...scope,
        setProject,
        setAreaPath,
        setSprint,
        isComplete: !!scope.project,
    };

    return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope(): Scope {
    const scope = useContext(ScopeContext);

    if (!scope) {
        throw new Error("useScope must be used within a ScopeProvider");
    }

    return scope;
}
