import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Title2, Title3, makeStyles, tokens } from "@fluentui/react-components";
import { PageLayout } from "../components/PageLayout";
import { ExecutionMetrics } from "../components/ExecutionMetrics";
import { ExecutionTrendCharts } from "../components/ExecutionTrendCharts";
import { CoverageSection } from "../components/CoverageSection";
import { RiskCoverage } from "../components/RiskCoverage";
import { VisualsSection } from "../components/VisualsSection";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import {
    fetchDashboard,
    fetchSuites,
    fetchExecutionTrend,
} from "../api/client";
import { useScope } from "../hooks/useScope";

const useStyles = makeStyles({
    section: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
    },
});

export function TestExecutionPage() {
    const styles = useStyles();
    const { t } = useTranslation();
    const scope = useScope();

    const dashboardQuery = useQuery({
        queryKey: ["dashboard", scope.project, scope.areaPaths, scope.iterations],
        queryFn: () => fetchDashboard(scope),
        enabled: scope.isComplete,
    });

    const suitesQuery = useQuery({
        queryKey: ["suites", scope.project, scope.areaPaths, scope.iterations],
        queryFn: () => fetchSuites(scope),
        enabled: scope.isComplete,
    });

    const trendQuery = useQuery({
        queryKey: ["execution-trend", scope.project, scope.areaPaths, scope.iterations],
        queryFn: () => fetchExecutionTrend(scope),
        enabled: scope.isComplete,
    });

    const isLoading =
        dashboardQuery.isLoading ||
        suitesQuery.isLoading ||
        trendQuery.isLoading;

    const errorQuery = [dashboardQuery, suitesQuery, trendQuery].find(
        (q) => q.isError
    );

    return (
        <PageLayout title={t("testExecutionPage.title")}>
            {!scope.isComplete && (
                <EmptyState message={t("scopeBar.selectScopePrompt")} />
            )}

            {scope.isComplete && isLoading && <LoadingCardGrid />}

            {errorQuery && (
                <ErrorState
                    message={(errorQuery.error as Error).message}
                    onRetry={() => {
                        dashboardQuery.refetch();
                        suitesQuery.refetch();
                        trendQuery.refetch();
                    }}
                />
            )}

            {dashboardQuery.data && suitesQuery.data && trendQuery.data && (
                <>
                    <div className={styles.section}>
                        <Title2 as="h2">
                            {t("testExecutionPage.sections.metrics")}
                        </Title2>
                        <ExecutionMetrics stats={dashboardQuery.data.stats} />
                    </div>

                    <div className={styles.section}>
                        <Title2 as="h2">
                            {t("testExecutionPage.sections.trends")}
                        </Title2>
                        <ExecutionTrendCharts trend={trendQuery.data.trend} />
                    </div>

                    <div className={styles.section}>
                        <Title2 as="h2">
                            {t("testExecutionPage.sections.coverage")}
                        </Title2>
                        <CoverageSection suites={suitesQuery.data} />

                        <Title3 as="h3">
                            {t("testExecutionPage.risk.title")}
                        </Title3>
                        <RiskCoverage
                            groupedByPriority={
                                dashboardQuery.data.stats.groupedByPriority
                            }
                        />
                    </div>

                    <div className={styles.section}>
                        <Title2 as="h2">
                            {t("testExecutionPage.sections.visuals")}
                        </Title2>
                        <VisualsSection
                            stats={dashboardQuery.data.stats}
                            trend={trendQuery.data.trend}
                            totalTestCases={trendQuery.data.totalTestCases}
                        />
                    </div>
                </>
            )}
        </PageLayout>
    );
}
