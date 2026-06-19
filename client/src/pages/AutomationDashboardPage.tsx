import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { makeStyles, tokens } from "@fluentui/react-components";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";
import { PageLayout } from "../components/PageLayout";
import { StatCard } from "../components/StatCard";
import { CardGrid } from "../components/CardGrid";
import { ChartCard } from "../components/ChartCard";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { fetchAutomationDashboard } from "../api/client";

const useStyles = makeStyles({
    section: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
    },
    chartsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: tokens.spacingHorizontalM,
    },
});

export function AutomationDashboardPage() {
    const styles = useStyles();
    const { t } = useTranslation();

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["automation"],
        queryFn: fetchAutomationDashboard,
    });

    return (
        <PageLayout title={t("automationDashboardPage.title")}>
            {isLoading && <LoadingCardGrid />}

            {isError && (
                <ErrorState message={error.message} onRetry={refetch} />
            )}

            {data && (
                <>
                    <div className={styles.section}>
                        <CardGrid>
                            <StatCard
                                label={t("automationDashboardPage.kpis.automatedTests")}
                                value={data.kpis.automatedTests}
                            />
                            <StatCard
                                label={t("automationDashboardPage.kpis.manualTests")}
                                value={data.kpis.manualTests}
                            />
                            <StatCard
                                label={t("automationDashboardPage.kpis.automationCoveragePct")}
                                value={`${data.kpis.automationCoveragePct}%`}
                            />
                            <StatCard
                                label={t("automationDashboardPage.kpis.flakyTests")}
                                value={data.kpis.flakyTestsCount}
                            />
                            <StatCard
                                label={t("automationDashboardPage.kpis.automationSuccessRate")}
                                value={`${data.kpis.automationSuccessRatePct}%`}
                            />
                        </CardGrid>
                    </div>

                    <div className={styles.section}>
                        <CardGrid>
                            <StatCard
                                label={t("automationDashboardPage.ciCd.pipelineSuccessRate")}
                                value={`${data.ciCd.pipelineSuccessRatePct}%`}
                            />
                            <StatCard
                                label={t("automationDashboardPage.ciCd.pipelineFailureRate")}
                                value={`${data.ciCd.pipelineFailureRatePct}%`}
                            />
                            <StatCard
                                label={t("automationDashboardPage.ciCd.avgPipelineDuration")}
                                value={t("automationDashboardPage.minutes", {
                                    value: data.ciCd.avgPipelineDurationMinutes,
                                })}
                            />
                            <StatCard
                                label={t("automationDashboardPage.ciCd.testExecutionTime")}
                                value={t("automationDashboardPage.minutes", {
                                    value: data.ciCd.testExecutionTimeMinutes,
                                })}
                            />
                        </CardGrid>
                    </div>

                    <div className={styles.chartsGrid}>
                        <ChartCard title={t("automationDashboardPage.charts.coverageByModule")}>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={data.charts.coverageByModule}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="module" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="automated" stackId="tests" fill="#0078d4" />
                                    <Bar dataKey="manual" stackId="tests" fill="#c4c4c4" />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard title={t("automationDashboardPage.charts.flakyTestRanking")}>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart
                                    data={data.charts.flakyTestRanking}
                                    layout="vertical"
                                    margin={{ left: 24 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" allowDecimals={false} />
                                    <YAxis
                                        type="category"
                                        dataKey="testName"
                                        width={160}
                                        tick={{ fontSize: 12 }}
                                    />
                                    <Tooltip />
                                    <Bar dataKey="flakeCount" fill="#d83b01" />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard title={t("automationDashboardPage.charts.pipelineSuccessTrend")}>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={data.charts.pipelineSuccessTrend}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip />
                                    <Line
                                        type="monotone"
                                        dataKey="successRatePct"
                                        stroke="#107c10"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    </div>
                </>
            )}
        </PageLayout>
    );
}
