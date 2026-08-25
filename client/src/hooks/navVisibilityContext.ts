import { createContext } from "react";

export const NAV_VISIBILITY_STORAGE_KEY = "azureDashboardHiddenNavItems";

export const NavVisibilityContext = createContext<{
    hiddenKeys: Set<string>;
    isHidden: (key: string) => boolean;
    setHidden: (key: string, hidden: boolean) => void;
} | null>(null);
