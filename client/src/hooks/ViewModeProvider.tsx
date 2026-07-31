import { useMemo, useState, type ReactNode } from "react";
import { useMsal } from "@azure/msal-react";
import { ViewModeContext, viewModeStorageKey, type ViewMode } from "./viewModeContext";

function readStoredMode(key: string): ViewMode | null {
    const raw = localStorage.getItem(key);

    return raw === "functional" || raw === "automation" ? raw : null;
}

// Mirrors ScopeProvider (see ScopeProvider.tsx) - mounted inside
// AuthenticatedTemplate so there is no view mode before login, and the
// choice is remembered per account across sessions.
export function ViewModeProvider({ children }: { children: ReactNode }) {
    const { instance, accounts } = useMsal();
    const activeAccount = instance.getActiveAccount() ?? accounts[0];
    const storageKey = viewModeStorageKey(
        activeAccount?.localAccountId ?? "local-dev"
    );

    const [mode, setModeState] = useState<ViewMode | null>(() =>
        readStoredMode(storageKey)
    );

    const value = useMemo(() => {
        const setMode = (next: ViewMode | null) => {
            if (next) {
                localStorage.setItem(storageKey, next);
            } else {
                localStorage.removeItem(storageKey);
            }

            setModeState(next);
        };

        return { mode, setMode };
    }, [mode, storageKey]);

    return (
        <ViewModeContext.Provider value={value}>
            {children}
        </ViewModeContext.Provider>
    );
}
