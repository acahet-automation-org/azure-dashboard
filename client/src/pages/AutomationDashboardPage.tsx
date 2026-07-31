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
    type BadgeProps,
} from "@fluentui/react-components";
import {
    ChevronDownRegular,
    GaugeRegular,
    ShieldCheckmarkRegular,
    CheckmarkCircleRegular,
    BeakerRegular,
    BugRegular,
    ArrowRepeatAllRegular,
    RocketRegular,
    BugArrowCounterclockwiseRegular,
    ArrowTrendingRegular,
    DataPieRegular,
    FlashRegular,
    TimerRegular,
    GridRegular,
    ErrorCircleRegular,
    ListRegular,
} from "@fluentui/react-icons";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
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
import { fetchAutomationDashboard } from "../api/client";
import { useScope } from "../hooks/useScope";
import type {
    RiskLevel,
    FailingTestStatus,
    ReleaseReadinessStatus,
    AutomationDashboardResponse,
} from "../types";

type Status = "good" | "warn" | "bad" | "neutral";

const STATUS_COLOR = {
    good: tokens.colorPaletteGreenForeground1,
    warn: tokens.colorPaletteMarigoldForeground1,
    bad: tokens.colorPaletteRedForeground1,
    neutral: tokens.colorNeutralForeground3,
} as const;

const SEVERITY_COLOR = {
    critical: tokens.colorPaletteRedForeground1,
    high: tokens.colorPaletteDarkOrangeForeground1,
    medium: tokens.colorPaletteMarigoldForeground1,
    low: tokens.colorPaletteGreenForeground1,
} as const;

const ROOT_CAUSE_COLORS = [
    tokens.colorPaletteRedForeground1,
    tokens.colorPaletteMarigoldForeground1,
    tokens.colorBrandForeground1,
    tokens.colorNeutralForeground3,
];

const FAILING_STATUS_BADGE_COLOR: Record<
    FailingTestStatus,
    BadgeProps["color"]
> = {
    critical: "danger",
    warning: "warning",
    ok: "success",
};

const FAILING_STATUS_TO_STATUS: Record<FailingTestStatus, Status> = {
    critical: "bad",
    warning: "warn",
    ok: "good",
};

const RISK_TO_STATUS: Record<RiskLevel, Status> = {
    low: "good",
    medium: "warn",
    high: "bad",
};

const READINESS_BADGE_COLOR: Record<
    ReleaseReadinessStatus,
    BadgeProps["color"]
> = {
    ready: "success",
    atRisk: "warning",
    blocked: "danger",
};

function statusForThreshold(
    value: number,
    goodMin: number,
    warnMin: number,
): Status {
    if (value >= goodMin) return "good";

    return value >= warnMin ? "warn" : "bad";
}

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
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: tokens.spacingHorizontalS,
    },
    kpiCard: {
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: tokens.spacingVerticalXS,
        minWidth: 0,
        minHeight: "78px",
    },
    kpiCardWarnTint: {
        backgroundColor: tokens.colorPaletteMarigoldBackground1,
        border: `1px solid ${tokens.colorPaletteMarigoldBorder1}`,
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
    kpiValueRow: {
        display: "flex",
        alignItems: "baseline",
        gap: tokens.spacingHorizontalXS,
    },
    kpiValue: {
        fontSize: tokens.fontSizeHero700,
        fontWeight: tokens.fontWeightBold,
        lineHeight: tokens.lineHeightHero700,
    },
    kpiDelta: {
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorPaletteGreenForeground1,
    },
    kpiSubtitle: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
    },
    dot: {
        width: "8px",
        height: "8px",
        borderRadius: tokens.borderRadiusCircular,
        flexShrink: 0,
    },
    chartRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: tokens.spacingHorizontalM,
        alignItems: "stretch",
    },
    chartCardWide: {
        flex: "5 1 420px",
        minWidth: 0,
    },
    chartCardMedium: {
        flex: "4 1 320px",
        minWidth: 0,
    },
    chartCardNarrow: {
        flex: "3 1 260px",
        minWidth: 0,
    },
    donutLegend: {
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: tokens.spacingHorizontalM,
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
    riskGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: tokens.spacingHorizontalXS,
    },
    riskChip: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.spacingHorizontalXS,
        padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
        borderRadius: tokens.borderRadiusMedium,
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightSemibold,
    },
    riskChipLow: {
        backgroundColor: tokens.colorPaletteGreenBackground1,
        border: `1px solid ${tokens.colorPaletteGreenBorder1}`,
    },
    riskChipMedium: {
        backgroundColor: tokens.colorPaletteMarigoldBackground1,
        border: `1px solid ${tokens.colorPaletteMarigoldBorder1}`,
    },
    riskChipHigh: {
        backgroundColor: tokens.colorPaletteRedBackground1,
        border: `1px solid ${tokens.colorPaletteRedBorder1}`,
    },
    rootCauseList: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
        justifyContent: "center",
        flex: 1,
    },
    rootCauseRow: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXXS,
    },
    rootCauseLabelRow: {
        display: "flex",
        justifyContent: "space-between",
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground2,
    },
    rootCauseTrack: {
        width: "100%",
        height: "6px",
        borderRadius: tokens.borderRadiusCircular,
        backgroundColor: tokens.colorNeutralBackground4,
        overflow: "hidden",
    },
    rootCauseFill: {
        height: "100%",
        borderRadius: tokens.borderRadiusCircular,
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
    rowLabel: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
    },
});

function KpiTile({
    label,
    icon,
    status,
    tint,
    value,
    deltaLabel,
    subtitle,
    badge,
}: {
    label: string;
    icon: ReactNode;
    status?: Status;
    tint?: boolean;
    value?: ReactNode;
    deltaLabel?: string;
    subtitle?: string;
    badge?: { label: string; color: BadgeProps["color"] };
}) {
    const styles = useStyles();

    return (
        <Card
            className={`${styles.kpiCard} ${tint ? styles.kpiCardWarnTint : ""}`}
        >
            <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>{label}</span>
                {status ? (
                    <span
                        className={styles.dot}
                        style={{ backgroundColor: STATUS_COLOR[status] }}
                    />
                ) : (
                    <span className={styles.kpiIcon}>{icon}</span>
                )}
            </div>
            {badge ? (
                <Badge color={badge.color} appearance="tint" size="large">
                    {badge.label}
                </Badge>
            ) : (
                <div className={styles.kpiValueRow}>
                    <span className={styles.kpiValue}>{value}</span>
                    {deltaLabel && (
                        <span className={styles.kpiDelta}>{deltaLabel}</span>
                    )}
                </div>
            )}
            {subtitle && <span className={styles.kpiSubtitle}>{subtitle}</span>}
        </Card>
    );
}

function ModuleRiskGrid({
    items,
    riskLabel,
}: {
    items: { module: string; risk: RiskLevel }[];
    riskLabel: (risk: RiskLevel) => string;
}) {
    const styles = useStyles();
    const chipClass: Record<RiskLevel, string> = {
        low: styles.riskChipLow,
        medium: styles.riskChipMedium,
        high: styles.riskChipHigh,
    };

    return (
        <div className={styles.riskGrid}>
            {items.map((item) => (
                <div
                    key={item.module}
                    className={`${styles.riskChip} ${chipClass[item.risk]}`}
                    title={riskLabel(item.risk)}
                >
                    <span>{item.module}</span>
                    <span
                        className={styles.dot}
                        style={{
                            backgroundColor:
                                STATUS_COLOR[RISK_TO_STATUS[item.risk]],
                        }}
                    />
                </div>
            ))}
        </div>
    );
}

function RootCauseBars({ items }: { items: { label: string; pct: number }[] }) {
    const styles = useStyles();

    return (
        <div className={styles.rootCauseList}>
            {items.map((item, index) => (
                <div key={item.label} className={styles.rootCauseRow}>
                    <div className={styles.rootCauseLabelRow}>
                        <span>{item.label}</span>
                        <Text weight="semibold">{item.pct}%</Text>
                    </div>
                    <div className={styles.rootCauseTrack}>
                        <div
                            className={styles.rootCauseFill}
                            style={{
                                width: `${item.pct}%`,
                                backgroundColor:
                                    ROOT_CAUSE_COLORS[
                                        index % ROOT_CAUSE_COLORS.length
                                    ],
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function AutomationDashboardPage() {
    const styles = useStyles();
    const { t } = useTranslation();

    const [selectedPlanId, setSelectedPlanId] = useState<number | undefined>(
        undefined,
    );
    const [iteration, setIteration] = useState("");
    const scope = useScope();

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
                iteration || undefined,
            ),
        enabled: scope.isComplete,
    });

    const automatedPlans = data?.automatedPlans ?? [];

    const allPlansLabel = t("automationDashboardPage.planFilter.allPlans");
    const selectedPlanName =
        automatedPlans.find((p) => p.id === selectedPlanId)?.name ??
        allPlansLabel;

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
                                value ? Number(value) : undefined,
                            );
                        }}
                    >
                        <Option value="">{allPlansLabel}</Option>
                        {automatedPlans.map((plan) => (
                            <Option key={plan.id} value={String(plan.id)}>
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

            {data && hasNoAutomatedTests && (
                <EmptyState
                    message={t("automationDashboardPage.emptyForPlan")}
                />
            )}

            {data && !hasNoAutomatedTests && (
                <AutomationDashboardContent data={data} />
            )}
        </PageLayout>
    );
}

function AutomationDashboardContent({
    data,
}: {
    data: AutomationDashboardResponse;
}) {
    const styles = useStyles();
    const { t } = useTranslation();

    const executionStatusData = [
        {
            name: t("automationDashboardPage.executionStatusLegend.passed"),
            value: data.charts.executionStatusBreakdown.passedPct,
            color: STATUS_COLOR.good,
        },
        {
            name: t("automationDashboardPage.executionStatusLegend.failed"),
            value: data.charts.executionStatusBreakdown.failedPct,
            color: STATUS_COLOR.bad,
        },
        {
            name: t("automationDashboardPage.executionStatusLegend.blocked"),
            value: data.charts.executionStatusBreakdown.blockedPct,
            color: STATUS_COLOR.warn,
        },
        {
            name: t("automationDashboardPage.executionStatusLegend.notRun"),
            value: data.charts.executionStatusBreakdown.notRunPct,
            color: STATUS_COLOR.neutral,
        },
    ];

    const severityData = (["critical", "high", "medium", "low"] as const).map(
        (key) => ({
            key,
            label: t(`automationDashboardPage.severity.${key}`),
            value: data.charts.defectsBySeverity[key],
            color: SEVERITY_COLOR[key],
        }),
    );

    const durationLabel = t("automationDashboardPage.minutes", {
        value: data.ciCd.avgPipelineDurationMinutes,
    });
    const executionTimeLabel = t("automationDashboardPage.minutes", {
        value: data.ciCd.testExecutionTimeMinutes,
    });
    const durationSubtitle = `${durationLabel} • ${executionTimeLabel}`;

    const autoCoverageSubtitle = `${data.kpis.automatedTests} ${t(
        "automationDashboardPage.kpis.automatedTests",
    )} • ${data.kpis.manualTests} ${t(
        "automationDashboardPage.kpis.manualTests",
    )}`;

    return (
        <>
            <div className={styles.kpiGrid}>
                <KpiTile
                    icon={<GaugeRegular />}
                    label={t("automationDashboardPage.summary.qualityScore")}
                    value={`${data.summary.qualityScorePct}%`}
                    deltaLabel={`↑ +${data.summary.qualityScoreDeltaPct}%`}
                />
                <KpiTile
                    icon={<ShieldCheckmarkRegular />}
                    label={t("automationDashboardPage.summary.readiness")}
                    badge={{
                        label: t(
                            `automationDashboardPage.summary.readinessStatus.${data.summary.releaseReadiness}`,
                        ),
                        color: READINESS_BADGE_COLOR[
                            data.summary.releaseReadiness
                        ],
                    }}
                />
                <KpiTile
                    icon={<CheckmarkCircleRegular />}
                    label={t("automationDashboardPage.summary.passRate")}
                    value={`${data.kpis.automationSuccessRatePct}%`}
                    status={statusForThreshold(
                        data.kpis.automationSuccessRatePct,
                        90,
                        70,
                    )}
                />
                <KpiTile
                    icon={<BeakerRegular />}
                    label={t("automationDashboardPage.summary.autoCoverage")}
                    value={`${data.kpis.automationCoveragePct}%`}
                    status={statusForThreshold(
                        data.kpis.automationCoveragePct,
                        70,
                        40,
                    )}
                    subtitle={autoCoverageSubtitle}
                />
                <KpiTile
                    icon={<BugRegular />}
                    label={t("automationDashboardPage.summary.criticalBugs")}
                    value={data.summary.criticalBugsCount}
                    tint={data.summary.criticalBugsCount > 0}
                    subtitle={
                        data.summary.criticalBugsCount > 0
                            ? t(
                                  "automationDashboardPage.summary.criticalBugsSubtitle",
                              )
                            : undefined
                    }
                />
                <KpiTile
                    icon={<ArrowRepeatAllRegular />}
                    label={t("automationDashboardPage.summary.regression")}
                    value={`${data.summary.regressionCompletionPct}%`}
                    status={
                        data.summary.regressionCompletionPct >= 100
                            ? "good"
                            : "warn"
                    }
                />
                <KpiTile
                    icon={<RocketRegular />}
                    label={t("automationDashboardPage.summary.pipelineSuccess")}
                    value={`${data.ciCd.pipelineSuccessRatePct}%`}
                    status={statusForThreshold(
                        data.ciCd.pipelineSuccessRatePct,
                        90,
                        70,
                    )}
                />
                <KpiTile
                    icon={<BugArrowCounterclockwiseRegular />}
                    label={t("automationDashboardPage.summary.escapedBugs")}
                    value={data.summary.escapedDefectsCount}
                    subtitle={t(
                        "automationDashboardPage.summary.escapedBugsSubtitle",
                    )}
                />
            </div>

            <div className={styles.chartRow}>
                <div className={styles.chartCardWide}>
                    <ChartCard
                        icon={<ArrowTrendingRegular />}
                        title={t(
                            "automationDashboardPage.charts.executionTrend",
                        )}
                        subtitle={t(
                            "automationDashboardPage.charts.executionTrendSubtitle",
                        )}
                    >
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={data.charts.executionTrend}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Legend />
                                <Area
                                    type="monotone"
                                    dataKey="passed"
                                    name={t(
                                        "automationDashboardPage.executionStatusLegend.passed",
                                    )}
                                    stackId="execution"
                                    stroke={STATUS_COLOR.good}
                                    fill={STATUS_COLOR.good}
                                    fillOpacity={0.25}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="failed"
                                    name={t(
                                        "automationDashboardPage.executionStatusLegend.failed",
                                    )}
                                    stackId="execution"
                                    stroke={STATUS_COLOR.bad}
                                    fill={STATUS_COLOR.bad}
                                    fillOpacity={0.25}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </div>

                <div className={styles.chartCardNarrow}>
                    <ChartCard
                        icon={<DataPieRegular />}
                        title={t(
                            "automationDashboardPage.charts.executionStatus",
                        )}
                    >
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie
                                    data={executionStatusData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={45}
                                    outerRadius={75}
                                    paddingAngle={2}
                                >
                                    {executionStatusData.map((entry) => (
                                        <Cell
                                            key={entry.name}
                                            fill={entry.color}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className={styles.donutLegend}>
                            {executionStatusData.map((entry) => (
                                <span
                                    key={entry.name}
                                    className={styles.legendItem}
                                >
                                    <span
                                        className={styles.legendSwatch}
                                        style={{ backgroundColor: entry.color }}
                                    />
                                    {entry.name}
                                </span>
                            ))}
                        </div>
                    </ChartCard>
                </div>

                <div className={styles.chartCardMedium}>
                    <ChartCard
                        icon={<FlashRegular />}
                        title={t(
                            "automationDashboardPage.charts.dailyVelocity",
                        )}
                        subtitle={t(
                            "automationDashboardPage.charts.dailyVelocitySubtitle",
                        )}
                    >
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={data.charts.dailyVelocity}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Bar
                                    dataKey="executions"
                                    fill={tokens.colorBrandForeground1}
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </div>
            </div>

            <div className={styles.chartRow}>
                <div className={styles.chartCardMedium}>
                    <ChartCard
                        icon={<TimerRegular />}
                        title={t(
                            "automationDashboardPage.charts.passRateAndDuration",
                        )}
                        subtitle={durationSubtitle}
                    >
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={data.charts.pipelineSuccessTrend}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                <YAxis
                                    domain={[0, 100]}
                                    tick={{ fontSize: 10 }}
                                />
                                <Tooltip />
                                <Line
                                    type="monotone"
                                    dataKey="successRatePct"
                                    stroke={tokens.colorBrandForeground1}
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </div>

                <div className={styles.chartCardNarrow}>
                    <ChartCard
                        icon={<BugRegular />}
                        title={t(
                            "automationDashboardPage.charts.defectsBySeverity",
                        )}
                    >
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart
                                data={severityData}
                                layout="vertical"
                                margin={{ left: 8 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    type="number"
                                    allowDecimals={false}
                                    tick={{ fontSize: 10 }}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="label"
                                    width={64}
                                    tick={{ fontSize: 11 }}
                                />
                                <Tooltip />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                    {severityData.map((entry) => (
                                        <Cell
                                            key={entry.key}
                                            fill={entry.color}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </div>

                <div className={styles.chartCardNarrow}>
                    <ChartCard
                        icon={<GridRegular />}
                        title={t("automationDashboardPage.charts.moduleRisk")}
                    >
                        <ModuleRiskGrid
                            items={data.charts.moduleRisk}
                            riskLabel={(risk) =>
                                t(`automationDashboardPage.riskLevel.${risk}`)
                            }
                        />
                    </ChartCard>
                </div>

                <div className={styles.chartCardNarrow}>
                    <ChartCard
                        icon={<ErrorCircleRegular />}
                        title={t("automationDashboardPage.charts.rootCauses")}
                    >
                        <RootCauseBars items={data.charts.rootCauses} />
                    </ChartCard>
                </div>
            </div>

            {data.charts.topFailingTests.length > 0 && (
                <Card className={styles.tableCard}>
                    <div className={styles.tableHeaderRow}>
                        <ListRegular />
                        <Title3 as="h3">
                            {t(
                                "automationDashboardPage.charts.topFailingTests",
                            )}
                        </Title3>
                        <Badge color="danger" appearance="tint">
                            {t(
                                "automationDashboardPage.failingTable.requiresAttention",
                            )}
                        </Badge>
                    </div>
                    <Table
                        aria-label={t(
                            "automationDashboardPage.charts.topFailingTests",
                        )}
                    >
                        <TableHeader>
                            <TableRow>
                                <TableHeaderCell>
                                    {t(
                                        "automationDashboardPage.failingTable.testName",
                                    )}
                                </TableHeaderCell>
                                <TableHeaderCell>
                                    {t(
                                        "automationDashboardPage.failingTable.module",
                                    )}
                                </TableHeaderCell>
                                <TableHeaderCell>
                                    {t(
                                        "automationDashboardPage.failingTable.failures",
                                    )}
                                </TableHeaderCell>
                                <TableHeaderCell>
                                    {t(
                                        "automationDashboardPage.failingTable.lastFailure",
                                    )}
                                </TableHeaderCell>
                                <TableHeaderCell>
                                    {t(
                                        "automationDashboardPage.failingTable.owner",
                                    )}
                                </TableHeaderCell>
                                <TableHeaderCell>
                                    {t(
                                        "automationDashboardPage.failingTable.status",
                                    )}
                                </TableHeaderCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.charts.topFailingTests.map((item) => (
                                <TableRow key={item.testCaseId}>
                                    <TableCell>
                                        <span className={styles.rowLabel}>
                                            <span
                                                className={styles.dot}
                                                style={{
                                                    backgroundColor:
                                                        STATUS_COLOR[
                                                            FAILING_STATUS_TO_STATUS[
                                                                item.status
                                                            ]
                                                        ],
                                                }}
                                            />
                                            {item.testName}
                                        </span>
                                    </TableCell>
                                    <TableCell>{item.module}</TableCell>
                                    <TableCell>
                                        <Badge
                                            color={
                                                FAILING_STATUS_BADGE_COLOR[
                                                    item.status
                                                ]
                                            }
                                            appearance="tint"
                                        >
                                            {item.failures}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {item.lastFailedDate ? (
                                            new Date(
                                                item.lastFailedDate,
                                            ).toLocaleDateString()
                                        ) : (
                                            <Text>—</Text>
                                        )}
                                    </TableCell>
                                    <TableCell>{item.owner}</TableCell>
                                    <TableCell>
                                        <Badge
                                            color={
                                                FAILING_STATUS_BADGE_COLOR[
                                                    item.status
                                                ]
                                            }
                                            appearance="tint"
                                        >
                                            {t(
                                                `automationDashboardPage.failingTable.statusValue.${item.status}`,
                                            )}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}
        </>
    );
}
