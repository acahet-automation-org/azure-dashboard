import { Button, Tooltip } from "@fluentui/react-components";
import { WeatherMoonRegular, WeatherSunnyRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useThemeMode } from "../hooks/useThemeMode";

export function ThemeSwitcher() {
    const { t } = useTranslation();
    const { mode, setMode } = useThemeMode();

    const isDark = mode === "dark";
    const label = t(`themeSwitcher.${isDark ? "light" : "dark"}`);

    return (
        <Tooltip content={label} relationship="label">
            <Button
                appearance="subtle"
                icon={isDark ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
                aria-label={label}
                onClick={() => setMode(isDark ? "light" : "dark")}
            />
        </Tooltip>
    );
}
