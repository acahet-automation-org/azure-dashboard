import { useContext } from "react";
import { ViewModeContext } from "./viewModeContext";

export function useViewMode() {
    const context = useContext(ViewModeContext);

    if (!context) {
        throw new Error("useViewMode must be used within a ViewModeProvider");
    }

    return context;
}
