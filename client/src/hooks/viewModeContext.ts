import { createContext } from "react";

export type ViewMode = "functional" | "automation";

export interface ViewModeContextValue {
    mode: ViewMode | null;
    setMode: (mode: ViewMode | null) => void;
}

// Keyed per signed-in account, same rationale as scopeStorageKey in
// scopeContext.ts - a shared machine with multiple Azure AD accounts
// shouldn't leak one person's view choice into another's session.
export function viewModeStorageKey(accountId: string): string {
    return `viewMode:${accountId}`;
}

export const ViewModeContext = createContext<ViewModeContextValue | null>(null);
