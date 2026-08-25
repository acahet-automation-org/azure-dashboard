import { useContext } from "react";
import { NavVisibilityContext } from "./navVisibilityContext";

export function useNavVisibility() {
    const context = useContext(NavVisibilityContext);

    if (!context) {
        throw new Error("useNavVisibility must be used within a NavVisibilityProvider");
    }

    return context;
}
