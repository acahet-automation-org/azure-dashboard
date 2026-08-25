import { useState, type ReactNode } from "react";
import {
    NavVisibilityContext,
    NAV_VISIBILITY_STORAGE_KEY,
} from "./navVisibilityContext";

// Fails safe to "show everything" on missing/corrupt localStorage JSON,
// rather than throwing during render - unlike theme-mode's plain string
// equality check, this needs to JSON.parse an array.
function getInitialHidden(): Set<string> {
    try {
        const raw = localStorage.getItem(NAV_VISIBILITY_STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];

        if (!Array.isArray(parsed)) {
            return new Set();
        }

        return new Set(
            parsed.filter((key): key is string => typeof key === "string")
        );
    } catch {
        return new Set();
    }
}

export function NavVisibilityProvider({ children }: { children: ReactNode }) {
    const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(getInitialHidden);

    const setHidden = (key: string, hidden: boolean) => {
        setHiddenKeys((prev) => {
            const next = new Set(prev);

            if (hidden) {
                next.add(key);
            } else {
                next.delete(key);
            }

            localStorage.setItem(
                NAV_VISIBILITY_STORAGE_KEY,
                JSON.stringify(Array.from(next))
            );

            return next;
        });
    };

    const isHidden = (key: string) => hiddenKeys.has(key);

    return (
        <NavVisibilityContext.Provider value={{ hiddenKeys, isHidden, setHidden }}>
            {children}
        </NavVisibilityContext.Provider>
    );
}
