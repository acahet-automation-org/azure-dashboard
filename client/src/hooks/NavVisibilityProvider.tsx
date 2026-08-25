import { useState, type ReactNode } from "react";
import { NAV_ITEMS, AUTOMATION_ITEMS } from "../config/navItems";
import {
    NavVisibilityContext,
    NAV_VISIBILITY_STORAGE_KEY,
} from "./navVisibilityContext";

// Kept visible out of the box - everything else defaults to hidden (see
// DEFAULT_HIDDEN_KEYS) so a fresh browser lands on the same "Sprint Report
// only" view the old VITE_SHOW_ONLY_SPRINT_REPORT env var used to force
// (removed in favor of this per-user Settings panel - see PR #69). "suites"
// isn't listed here because Sidebar.tsx/App.tsx already exempt it from
// hiding entirely (it's the home/logo target), so it doesn't need a default.
const ALWAYS_VISIBLE_BY_DEFAULT = new Set([
    "dynamic-sprint-report",
    "release-readiness",
]);

// Derived (not a hand-maintained literal list) so it stays in sync with
// navItems.ts automatically - a new nav item added there just needs
// including/excluding from ALWAYS_VISIBLE_BY_DEFAULT above, nothing here.
const DEFAULT_HIDDEN_KEYS = [...NAV_ITEMS, ...AUTOMATION_ITEMS]
    .map((item) => item.key)
    .filter((key) => !ALWAYS_VISIBLE_BY_DEFAULT.has(key));

// Fails safe to "show everything" on corrupt localStorage JSON, rather than
// throwing during render - unlike theme-mode's plain string equality check,
// this needs to JSON.parse an array.
function getInitialHidden(): Set<string> {
    try {
        const raw = localStorage.getItem(NAV_VISIBILITY_STORAGE_KEY);

        // No stored preference at all (not even an empty array) - first
        // load, or a browser that predates this feature. Anyone who's
        // already interacted with Settings (even to clear every hidden
        // item) has a real "[]" stored and keeps their explicit choice.
        if (raw === null) {
            return new Set(DEFAULT_HIDDEN_KEYS);
        }

        const parsed: unknown = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return new Set(DEFAULT_HIDDEN_KEYS);
        }

        return new Set(
            parsed.filter((key): key is string => typeof key === "string")
        );
    } catch {
        return new Set(DEFAULT_HIDDEN_KEYS);
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
