import { useState, type ReactNode } from "react";
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
import {
    ChevronDownRegular,
    BeakerRegular,
    PersonRegular,
    ShieldCheckmarkRegular,
    CheckmarkCircleRegular,
    WarningRegular,
    RocketRegular,
    DismissCircleRegular,
    TimerRegular,
    ClockRegular,
    ChartMultipleRegular,
    PulseRegular,
    ListRegular,
} from "@fluentui/react-icons";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
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

const AUTOMATED_COLOR = "#0078d4";
const MANUAL_COLOR = "#c4c4c4";

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
    kpiCardBad: {
        backgroundColor: tokens.colorPaletteRedBackground1,
        border: `1px solid ${tokens.colorPaletteRedBorder1}`,
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
    kpiIcon: {
        display: "flex",
        flexShrink: 0,
        fontSize: "16px",
    },
    iconGood: {
        color: tokens.colorPaletteGreenForeground1,
    },
    iconWarn: {
        color: tokens.colorPaletteYellowForeground1,
    },
    iconBad: {
        color: tokens.colorPaletteRedForeground1,
    },
    iconNeutral: {
        color: tokens.colorNeutralForeground3,
    },
    kpiValue: {
        fontSize: tokens.fontSizeHero700,
        fontWeight: tokens.fontWeightBold,
        lineHeight: tokens.lineHeightHero700,
    },
    kpiValueBad: {
        color: tokens.colorPaletteRedForeground1,
    },
    chartsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: tokens.spacingHorizontalM,
    },
    tableCard: {
        padding: tokens.spacingHorizontalM,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
    },
    tableHeaderRow: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
    },
    statusDot: {
        flexShrink: 0,
        width: "8px",
        height: "8px",
        borderRadius: tokens.borderRadiusCircular,
    },
    dotBad: {
        backgroundColor: tokens.colorPaletteRedForeground1,
    },
    dotWarn: {
        backgroundColor: tokens.colorPaletteYellowForeground1,
    },
    rowLabel: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
    },
    donutLegend: {
        display: "flex",
        justifyContent: "center",
        gap: tokens.spacingHorizontalL,
        fontSize: tokens.fontSizeBase200,
    },
    legendItem: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
    },
    legendSwatch: {
        width: "10px",
        height: "10px",
        borderRadius: tokens.borderRadiusCircular,
    },
});

type KpiStatus = "good" | "warn" | "bad";

function KpiCard({
    label,
    value,
    icon,
    status,
}: {
    label: string;
    value: string | number;
    icon: ReactNode;
    status?: KpiStatus;
}) {
    const styles = useStyles();
    const iconClass =
        status === "good"
            ? styles.iconGood
            : status === "warn"
              ? styles.iconWarn
              : status === "bad"
                ? styles.iconBad
                : styles.iconNeutral;

    return (
        <Card
            className={`${styles.kpiCard} ${status === "bad" ? styles.kpiCardBad : ""}`}
        >
            <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>{label}</span>
                <span className={`${styles.kpiIcon} ${iconClass}`}>{icon}</span>
            </div>
            <span
                className={`${styles.kpiValue} ${status === "bad" ? styles.kpiValueBad : ""}`}
            >
                {value}
            </span>
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

    const splitChartData = data
        ? [
              { name: t("automationDashboardPage.kpis.automatedTests"), value: data.kpis.automatedTests, color: AUTOMATED_COLOR },
              { name: t("automationDashboardPage.kpis.manualTests"), value: data.kpis.manualTests, color: MANUAL_COLOR },
          ].filter((entry) => entry.value > 0)
        : [];

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
                            icon={<BeakerRegular />}
                            label={t("automationDashboardPage.kpis.automatedTests")}
                            value={data.kpis.automatedTests}
                        />
                        <KpiCard
                            icon={<PersonRegular />}
                            label={t("automationDashboardPage.kpis.manualTests")}
                            value={data.kpis.manualTests}
                        />
                        <KpiCard
                            icon={<ShieldCheckmarkRegular />}
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
                            icon={<CheckmarkCircleRegular />}
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
                            icon={<WarningRegular />}
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
                            icon={<RocketRegular />}
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
                            icon={<DismissCircleRegular />}
                            label={t("automationDashboardPage.ciCd.pipelineFailureRate")}
                            value={`${data.ciCd.pipelineFailureRatePct}%`}
                        />
                        <KpiCard
                            icon={<TimerRegular />}
                            label={t("automationDashboardPage.ciCd.avgPipelineDuration")}
                            value={t("automationDashboardPage.minutes", {
                                value: data.ciCd.avgPipelineDurationMinutes,
                            })}
                        />
                        <KpiCard
                            icon={<ClockRegular />}
                            label={t("automationDashboardPage.ciCd.testExecutionTime")}
                            value={t("automationDashboardPage.minutes", {
                                value: data.ciCd.testExecutionTimeMinutes,
                            })}
                        />
                    </div>

                    <div className={styles.chartsGrid}>
                        {hasNoAutomatedTests ? (
                            <ChartCard
                                icon={<ChartMultipleRegular />}
                                title={t("automationDashboardPage.charts.coverageByModule")}
                            >
                                <EmptyState
                                    message={t("automationDashboardPage.emptyForPlan")}
                                />
                            </ChartCard>
                        ) : (
                            <ChartCard
                                icon={<ChartMultipleRegular />}
                                title={t("automationDashboardPage.charts.coverageByModule")}
                            >
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={data.charts.coverageByModule}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="module" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="automated" stackId="tests" fill={AUTOMATED_COLOR} />
                                        <Bar dataKey="manual" stackId="tests" fill={MANUAL_COLOR} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        )}

                        {splitChartData.length > 0 && (
                            <ChartCard
                                icon={<PulseRegular />}
                                title={t("automationDashboardPage.charts.executionSplit")}
                            >
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie
                                            data={splitChartData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={85}
                                            paddingAngle={2}
                                        >
                                            {splitChartData.map((entry) => (
                                                <Cell key={entry.name} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className={styles.donutLegend}>
                                    {splitChartData.map((entry) => (
                                        <span key={entry.name} className={styles.legendItem}>
                                            <span
                                                className={styles.legendSwatch}
                                                style={{ backgroundColor: entry.color }}
                                            />
                                            {entry.name}
                                        </span>
                                    ))}
                                </div>
                            </ChartCard>
                        )}

                        <ChartCard
                            icon={<RocketRegular />}
                            title={t("automationDashboardPage.charts.pipelineSuccessTrend")}
                        >
                            <ResponsiveContainer width="100%" height={260}>
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
                            <ChartCard
                                icon={<WarningRegular />}
                                title={t("automationDashboardPage.charts.flakyTestRanking")}
                            >
                                <ResponsiveContainer width="100%" height={260}>
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
                            <div className={styles.tableHeaderRow}>
                                <ListRegular />
                                <Title3 as="h3">
                                    {t("automationDashboardPage.charts.flakyTestRanking")}
                                </Title3>
                                <Badge color="danger" appearance="tint">
                                    {t("automationDashboardPage.flakyTable.requiresAttention")}
                                </Badge>
                            </div>
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
                                            <TableCell>
                                                <span className={styles.rowLabel}>
                                                    <span
                                                        className={`${styles.statusDot} ${
                                                            item.flakeCount >= 5
                                                                ? styles.dotBad
                                                                : styles.dotWarn
                                                        }`}
                                                    />
                                                    {item.testName}
                                                </span>
                                            </TableCell>
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
