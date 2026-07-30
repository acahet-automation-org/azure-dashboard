import { createContext } from "react";

export interface Scope {
    project: string | null;
    areaPaths: string[];
    iterations: string[];
}

export interface ScopeContextValue extends Scope {
    isComplete: boolean;
    setProject: (project: string | null) => void;
    setAreaPaths: (areaPaths: string[]) => void;
    setIterations: (iterations: string[]) => void;
    reset: () => void;
}

export const EMPTY_SCOPE: Scope = {
    project: null,
    areaPaths: [],
    iterations: [],
};

// Keyed per signed-in account (rather than one shared key) so a shared
// machine with multiple Azure AD accounts doesn't leak one person's project
// selection into another's session.
export function scopeStorageKey(accountId: string): string {
    return `scope:${accountId}`;
}

export const ScopeContext = createContext<ScopeContextValue | null>(null);
