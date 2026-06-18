import { useLocation, useNavigate } from "react-router-dom";
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
import { postRefresh } from "../api/client";
import { NAV_HEIGHT } from "../layoutConstants";

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
    tabs: {
        overflowX: "auto",
    },
});

const routeForValue: Record<string, string> = {
    suites: "/",
    dashboard: "/dashboard",
    runs: "/last-5-runs",
};

function valueForPath(pathname: string): string {
    if (pathname === "/dashboard") {
        return "dashboard";
    }

    if (pathname === "/last-5-runs") {
        return "runs";
    }

    return "suites";
}

export function NavBar() {
    const styles = useStyles();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();

    const refreshMutation = useMutation({
        mutationFn: postRefresh,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["suites"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["runs"] });
        },
    });

    return (
        <nav className={styles.bar} aria-label="Primary">
            <TabList
                className={styles.tabs}
                selectedValue={valueForPath(location.pathname)}
                onTabSelect={(_, data) =>
                    navigate(routeForValue[data.value as string])
                }
            >
                <Tab value="suites">Browse by Suite</Tab>
                <Tab value="dashboard">Full Dashboard</Tab>
                <Tab value="runs">Last 10 Runs</Tab>
            </TabList>

            <Button
                appearance="secondary"
                icon={<ArrowClockwiseRegular />}
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
            >
                {refreshMutation.isPending ? "Refreshing..." : "Refresh Now"}
            </Button>

            {refreshMutation.isError && (
                <Text role="alert" style={{ color: tokens.colorPaletteRedForeground1 }}>
                    Refresh failed: {refreshMutation.error.message}
                </Text>
            )}
        </nav>
    );
}
