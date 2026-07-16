import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    TabList,
    Tab,
    Button,
    Text,
    Menu,
    MenuTrigger,
    MenuPopover,
    MenuList,
    MenuItem,
    makeStyles,
    mergeClasses,
    tokens,
} from "@fluentui/react-components";
import { ChevronDownRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useMsal } from "@azure/msal-react";
import { useThemeMode } from "../hooks/useThemeMode";
import { NAV_HEIGHT } from "../layoutConstants";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";

const useStyles = makeStyles({
    bar: {
        position: "sticky",
        top: 0,
        zIndex: 10,
        minHeight: NAV_HEIGHT,
        boxSizing: "border-box",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.spacingHorizontalM,
        padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
        borderBottomWidth: "1px",
        borderBottomStyle: "solid",
        borderBottomColor: tokens.colorNeutralStroke2,
        backgroundColor: tokens.colorNeutralBackground1,
    },
    logoLink: {
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
    },
    logoLinkDark: {
        backgroundColor: "#ffffff",
        padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
        borderRadius: tokens.borderRadiusMedium,
    },
    logo: {
        height: "32px",
        width: "auto",
    },
    tabs: {
        display: "contents",
    },
    tabsRow: {
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
    },
    automationTrigger: {
        fontWeight: tokens.fontWeightRegular,
    },
    automationTriggerActive: {
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorBrandForeground1,
    },
    controls: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        flexWrap: "wrap",
    },
});

const releaseReadinessEnabled =
    import.meta.env.VITE_ENABLE_RELEASE_READINESS === "true";
// Mirrors the route restriction in App.tsx - when set, only the tabs for
// the pages that actually still have a route are shown, so there's nothing
// in the nav that would land on the "*" -> /defects redirect.
const showOnlyDefectAndRelease =
    import.meta.env.VITE_SHOW_ONLY_DEFECT_AND_RELEASE === "true";

const routeForValue: Record<string, string> = {
    suites: "/",
    dashboard: "/dashboard",
    runs: "/last-10-runs",
    plans: "/plans",
    "plan-overview": "/plan-overview",
    "plan-progress": "/plan-progress",
    execution: "/test-execution",
    defects: "/defects",
    "my-work-items": "/my-work-items",
    "remove-test-cases": "/remove-test-cases",
    "release-readiness": "/release-readiness",
};

const AUTOMATION_SECTION_PATHS = [
    "/automation-dashboard",
    "/common-errors",
];

function valueForPath(pathname: string): string {
    if (pathname === "/dashboard") {
        return "dashboard";
    }

    if (pathname === "/last-10-runs") {
        return "runs";
    }

    if (pathname.startsWith("/plans")) {
        return "plans";
    }

    if (pathname === "/plan-overview") {
        return "plan-overview";
    }

    if (pathname === "/plan-progress") {
        return "plan-progress";
    }

    if (pathname === "/test-execution") {
        return "execution";
    }

    if (pathname === "/defects") {
        return "defects";
    }

    if (pathname === "/my-work-items") {
        return "my-work-items";
    }

    if (pathname === "/remove-test-cases") {
        return "remove-test-cases";
    }

    if (pathname === "/release-readiness") {
        return "release-readiness";
    }

    return "suites";
}

export function NavBar() {
    const styles = useStyles();
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const { mode } = useThemeMode();
    const { instance, accounts } = useMsal();
    const activeAccount = instance.getActiveAccount() ?? accounts[0];

    return (
        <nav className={styles.bar} aria-label={t("nav.primary")}>
            <Link
                to="/"
                className={mergeClasses(
                    styles.logoLink,
                    mode === "dark" && styles.logoLinkDark,
                )}
                aria-label={t("nav.home")}
            >
                <img src={`${import.meta.env.BASE_URL}logo.svg`} alt={t("nav.home")} className={styles.logo} />
            </Link>

            <div className={styles.tabsRow}>
                <TabList
                    className={styles.tabs}
                    selectedValue={valueForPath(location.pathname)}
                    onTabSelect={(_, data) =>
                        navigate(routeForValue[data.value as string])
                    }
                >
                    {showOnlyDefectAndRelease ? (
                        <Tab value="defects">{t("nav.defects")}</Tab>
                    ) : (
                        <>
                            <Tab value="suites">{t("nav.suites")}</Tab>
                            <Tab value="dashboard">{t("nav.dashboard")}</Tab>
                            <Tab value="runs">{t("nav.runs")}</Tab>
                            <Tab value="plans">{t("nav.plans")}</Tab>
                            <Tab value="plan-overview">{t("nav.planOverview")}</Tab>
                            <Tab value="plan-progress">{t("nav.planProgress")}</Tab>
                            <Tab value="execution">{t("nav.execution")}</Tab>
                            <Tab value="defects">{t("nav.defects")}</Tab>
                            <Tab value="my-work-items">{t("nav.myWorkItems")}</Tab>
                            <Tab value="remove-test-cases">{t("nav.removeTestCases")}</Tab>
                        </>
                    )}
                    {releaseReadinessEnabled && (
                        <Tab value="release-readiness">
                            {t("nav.releaseReadiness")}
                        </Tab>
                    )}
                </TabList>

                {!showOnlyDefectAndRelease && (
                    <Menu>
                        <MenuTrigger disableButtonEnhancement>
                            <Button
                                appearance="transparent"
                                icon={<ChevronDownRegular />}
                                iconPosition="after"
                                className={mergeClasses(
                                    styles.automationTrigger,
                                    AUTOMATION_SECTION_PATHS.includes(location.pathname) &&
                                        styles.automationTriggerActive,
                                )}
                            >
                                {t("nav.automation")}
                            </Button>
                        </MenuTrigger>
                        <MenuPopover>
                            <MenuList>
                                <MenuItem onClick={() => navigate("/automation-dashboard")}>
                                    {t("nav.automationDashboard")}
                                </MenuItem>
                                <MenuItem onClick={() => navigate("/common-errors")}>
                                    {t("nav.commonErrors")}
                                </MenuItem>
                            </MenuList>
                        </MenuPopover>
                    </Menu>
                )}
            </div>

            <div className={styles.controls}>
                {activeAccount && (
                    <Text>
                        {t("nav.welcome", { name: activeAccount.name ?? activeAccount.username })}
                    </Text>
                )}

                <LanguageSwitcher />
                <ThemeSwitcher />
            </div>
        </nav>
    );
}
