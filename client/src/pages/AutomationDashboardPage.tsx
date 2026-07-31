import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
    Badge,
    Card,
    Dropdown,
    Option,
    Field,
    Table,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
    Text,
    Title3,
    makeStyles,
    tokens,
} from "@fluentui/react-components";
import { ChevronDownRegular } from "@fluentui/react-icons";
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
import { ChartCard } from "../components/ChartCard";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { IterationFilter } from "../components/IterationFilter";
import { fetchAutomationDashboard, fetchPlans } from "../api/client";
import { useScope } from "../hooks/useScope";
import { categoryAxisWidth } from "../utils/chartAxis";

const useStyles = makeStyles({
    filterRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: tokens.spacingHorizontalM,
        alignItems: "flex-end",
    },
    filterField: {
        maxWidth: "280px",
    },
    kpiGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: tokens.spacingHorizontalS,
    },
    kpiCard: {
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXS,
        minWidth: 0,
    },
    kpiHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.spacingHorizontalXS,
    },
    kpiLabel: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightSemibold,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
    },
    kpiValue: {
        fontSize: tokens.fontSizeHero700,
        fontWeight: tokens.fontWeightBold,
        lineHeight: tokens.lineHeightHero700,
    },
    statusDot: {
        flexShrink: 0,
        width: "8px",
        height: "8px",
        borderRadius: tokens.borderRadiusCircular,
    },
    dotGood: {
        backgroundColor: tokens.colorPaletteGreenForeground1,
    },
    dotWarn: {
        backgroundColor: tokens.colorPaletteYellowForeground1,
    },
    dotBad: {
        backgroundColor: tokens.colorPaletteRedForeground1,
    },
    chartsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
        gap: tokens.spacingHorizontalM,
    },
    tableCard: {
        padding: tokens.spacingHorizontalM,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
    },
});

type KpiStatus = "good" | "warn" | "bad";

function KpiCard({
    label,
    value,
    status,
}: {
    label: string;
    value: string | number;
    status?: KpiStatus;
}) {
    const styles = useStyles();
    const dotClass =
        status === "good"
            ? styles.dotGood
            : status === "warn"
              ? styles.dotWarn
              : styles.dotBad;

    return (
        <Card className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>{label}</span>
                {status && (
                    <span className={`${styles.statusDot} ${dotClass}`} />
                )}
            </div>
            <span className={styles.kpiValue}>{value}</span>
        </Card>
    );
}

export function AutomationDashboardPage() {
    const styles = useStyles();
    const { t } = useTranslation();

    const [selectedPlanId, setSelectedPlanId] = useState<
        number | undefined
    >(undefined);
    const [iteration, setIteration] = useState("");
    const scope = useScope();

    const { data: plans } = useQuery({
        queryKey: ["plans", scope.project],
        queryFn: () => fetchPlans(scope),
        enabled: scope.isComplete,
    });

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: [
            "automation",
            selectedPlanId ?? "all",
            iteration,
            scope.project,
            scope.areaPaths,
            scope.iterations,
        ],
        queryFn: () =>
            fetchAutomationDashboard(
                scope,
                selectedPlanId,
                iteration || undefined
            ),
        enabled: scope.isComplete,
    });

    const automatedPlanIds = new Set(
        data?.automatedPlanIds ?? []
    );
    const automatedPlans = plans?.filter((p) =>
        automatedPlanIds.has(p.id)
    );

    const allPlansLabel = t("automationDashboardPage.planFilter.allPlans");
    const selectedPlanName =
        automatedPlans?.find((p) => p.id === selectedPlanId)
            ?.name ?? allPlansLabel;

    const hasNoAutomatedTests =
        Boolean(data) && data!.kpis.automatedTests === 0;

    return (
        <PageLayout title={t("automationDashboardPage.title")}>
            <div className={styles.filterRow}>
                <IterationFilter
                    value={iteration}
                    onChange={(value) => {
                        setIteration(value);
                        setSelectedPlanId(undefined);
                    }}
                />

                <Field
                    label={t("automationDashboardPage.planFilter.label")}
                    className={styles.filterField}
                >
                    <Dropdown
                        expandIcon={<ChevronDownRegular />}
                        value={selectedPlanName}
                        selectedOptions={[
                            selectedPlanId != null
                                ? String(selectedPlanId)
                                : "",
                        ]}
                        onOptionSelect={(_, option) => {
                            const value = option.optionValue;

                            setSelectedPlanId(
                                value ? Number(value) : undefined
                            );
                        }}
                    >
                        <Option value="">{allPlansLabel}</Option>
                        {automatedPlans?.map((plan) => (
                            <Option
                                key={plan.id}
                                value={String(plan.id)}
                            >
                                {plan.name}
                            </Option>
                        ))}
                    </Dropdown>
                </Field>
            </div>

            {!scope.isComplete && (
                <EmptyState message={t("scopeBar.selectScopePrompt")} />
            )}

            {scope.isComplete && isLoading && <LoadingCardGrid count={9} />}

            {isError && (
                <ErrorState message={error.message} onRetry={refetch} />
            )}

            {data && (
                <>
                    <div className={styles.kpiGrid}>
                        <KpiCard
                            label={t("automationDashboardPage.kpis.automatedTests")}
                            value={data.kpis.automatedTests}
                        />
                        <KpiCard
                            label={t("automationDashboardPage.kpis.manualTests")}
                            value={data.kpis.manualTests}
                        />
                        <KpiCard
                            label={t("automationDashboardPage.kpis.automationCoveragePct")}
                            value={`${data.kpis.automationCoveragePct}%`}
                            status={
                                data.kpis.automationCoveragePct >= 70
                                    ? "good"
                                    : data.kpis.automationCoveragePct >= 40
                                      ? "warn"
                                      : "bad"
                            }
                        />
                        <KpiCard
                            label={t("automationDashboardPage.kpis.automationSuccessRate")}
                            value={`${data.kpis.automationSuccessRatePct}%`}
                            status={
                                data.kpis.automationSuccessRatePct >= 90
                                    ? "good"
                                    : data.kpis.automationSuccessRatePct >= 70
                                      ? "warn"
                                      : "bad"
                            }
                        />
                        <KpiCard
                            label={t("automationDashboardPage.kpis.flakyTests")}
                            value={data.kpis.flakyTestsCount}
                            status={
                                data.kpis.flakyTestsCount === 0
                                    ? "good"
                                    : data.kpis.flakyTestsCount <= 5
                                      ? "warn"
                                      : "bad"
                            }
                        />
                        <KpiCard
                            label={t("automationDashboardPage.ciCd.pipelineSuccessRate")}
                            value={`${data.ciCd.pipelineSuccessRatePct}%`}
                            status={
                                data.ciCd.pipelineSuccessRatePct >= 90
                                    ? "good"
                                    : data.ciCd.pipelineSuccessRatePct >= 70
                                      ? "warn"
                                      : "bad"
                            }
                        />
                        <KpiCard
                            label={t("automationDashboardPage.ciCd.pipelineFailureRate")}
                            value={`${data.ciCd.pipelineFailureRatePct}%`}
                        />
                        <KpiCard
                            label={t("automationDashboardPage.ciCd.avgPipelineDuration")}
                            value={t("automationDashboardPage.minutes", {
                                value: data.ciCd.avgPipelineDurationMinutes,
                            })}
                        />
                        <KpiCard
                            label={t("automationDashboardPage.ciCd.testExecutionTime")}
                            value={t("automationDashboardPage.minutes", {
                                value: data.ciCd.testExecutionTimeMinutes,
                            })}
                        />
                    </div>

                    <div className={styles.chartsGrid}>
                        {hasNoAutomatedTests ? (
                            <ChartCard title={t("automationDashboardPage.charts.coverageByModule")}>
                                <EmptyState
                                    message={t("automationDashboardPage.emptyForPlan")}
                                />
                            </ChartCard>
                        ) : (
                            <ChartCard title={t("automationDashboardPage.charts.coverageByModule")}>
                                <ResponsiveContainer width="100%" height={280}>
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
                        )}

                        <ChartCard title={t("automationDashboardPage.charts.pipelineSuccessTrend")}>
                            <ResponsiveContainer width="100%" height={280}>
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

                        {!hasNoAutomatedTests && (
                            <ChartCard title={t("automationDashboardPage.charts.flakyTestRanking")}>
                                <ResponsiveContainer width="100%" height={280}>
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
                                            width={categoryAxisWidth(
                                                data.charts.flakyTestRanking.map(
                                                    (item) => item.testName
                                                )
                                            )}
                                            tick={{ fontSize: 12 }}
                                        />
                                        <Tooltip />
                                        <Bar dataKey="flakeCount" fill="#d83b01" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        )}
                    </div>

                    {!hasNoAutomatedTests && data.charts.flakyTestRanking.length > 0 && (
                        <Card className={styles.tableCard}>
                            <Title3 as="h3">
                                {t("automationDashboardPage.charts.flakyTestRanking")}
                            </Title3>
                            <Table
                                aria-label={t(
                                    "automationDashboardPage.charts.flakyTestRanking"
                                )}
                            >
                                <TableHeader>
                                    <TableRow>
                                        <TableHeaderCell>
                                            {t("automationDashboardPage.flakyTable.testName")}
                                        </TableHeaderCell>
                                        <TableHeaderCell>
                                            {t("automationDashboardPage.flakyTable.flakeCount")}
                                        </TableHeaderCell>
                                        <TableHeaderCell>
                                            {t("automationDashboardPage.flakyTable.lastFailed")}
                                        </TableHeaderCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.charts.flakyTestRanking.map((item) => (
                                        <TableRow key={item.testCaseId}>
                                            <TableCell>{item.testName}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    color={
                                                        item.flakeCount >= 5
                                                            ? "danger"
                                                            : "warning"
                                                    }
                                                    appearance="tint"
                                                >
                                                    {item.flakeCount}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {item.lastFailedDate ? (
                                                    new Date(
                                                        item.lastFailedDate
                                                    ).toLocaleDateString()
                                                ) : (
                                                    <Text>—</Text>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    )}
                </>
            )}
        </PageLayout>
    );
}
