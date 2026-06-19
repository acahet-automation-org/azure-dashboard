import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    TabList,
    Tab,
    Button,
    Text,
    makeStyles,
    tokens,
} from "@fluentui/react-components";
import { ArrowClockwiseRegular } from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { postRefresh } from "../api/client";
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
    logo: {
        height: "32px",
        width: "auto",
    },
    tabs: {
        overflowX: "auto",
    },
    controls: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        flexWrap: "wrap",
    },
});

const routeForValue: Record<string, string> = {
    suites: "/",
    dashboard: "/dashboard",
    runs: "/last-5-runs",
    plans: "/plans",
    automation: "/automation-dashboard",
    execution: "/test-execution",
    defects: "/defects",
};

function valueForPath(pathname: string): string {
    if (pathname === "/dashboard") {
        return "dashboard";
    }

    if (pathname === "/last-5-runs") {
        return "runs";
    }

    if (pathname.startsWith("/plans")) {
        return "plans";
    }

    if (pathname === "/automation-dashboard") {
        return "automation";
    }

    if (pathname === "/test-execution") {
        return "execution";
    }

    if (pathname === "/defects") {
        return "defects";
    }

    return "suites";
}

export function NavBar() {
    const styles = useStyles();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { t } = useTranslation();

    const refreshMutation = useMutation({
        mutationFn: postRefresh,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["suites"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["runs"] });
            queryClient.invalidateQueries({ queryKey: ["plans"] });
            queryClient.invalidateQueries({ queryKey: ["automation"] });
            queryClient.invalidateQueries({ queryKey: ["execution-trend"] });
            queryClient.invalidateQueries({ queryKey: ["defects"] });
        },
    });

    return (
        <nav className={styles.bar} aria-label={t("nav.primary")}>
            <Link to="/" className={styles.logoLink} aria-label={t("nav.home")}>
                <img src="/login_itas.svg" alt={t("nav.home")} className={styles.logo} />
            </Link>

            <TabList
                className={styles.tabs}
                selectedValue={valueForPath(location.pathname)}
                onTabSelect={(_, data) =>
                    navigate(routeForValue[data.value as string])
                }
            >
                <Tab value="suites">{t("nav.suites")}</Tab>
                <Tab value="dashboard">{t("nav.dashboard")}</Tab>
                <Tab value="runs">{t("nav.runs")}</Tab>
                <Tab value="plans">{t("nav.plans")}</Tab>
                <Tab value="automation">{t("nav.automation")}</Tab>
                <Tab value="execution">{t("nav.execution")}</Tab>
                <Tab value="defects">{t("nav.defects")}</Tab>
            </TabList>

            <div className={styles.controls}>
                <LanguageSwitcher />
                <ThemeSwitcher />

                <Button
                    appearance="secondary"
                    icon={<ArrowClockwiseRegular />}
                    onClick={() => refreshMutation.mutate()}
                    disabled={refreshMutation.isPending}
                >
                    {refreshMutation.isPending
                        ? t("nav.refreshing")
                        : t("nav.refresh")}
                </Button>
            </div>

            {refreshMutation.isError && (
                <Text role="alert" style={{ color: tokens.colorPaletteRedForeground1 }}>
                    {t("nav.refreshFailed", {
                        message: refreshMutation.error.message,
                    })}
                </Text>
            )}
        </nav>
    );
}
