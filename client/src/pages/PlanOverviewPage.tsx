import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
    Dropdown,
    Option,
    Field,
    Button,
    makeStyles,
    tokens,
} from "@fluentui/react-components";
import { ChevronDownRegular, ArrowDownloadRegular } from "@fluentui/react-icons";
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
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
import { ChartsGrid } from "../components/ChartsGrid";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { BugList } from "../components/BugList";
import { fetchPlans, fetchPlanOverview } from "../api/client";
import { captureChartImage, exportPlanOverviewToPdf } from "../utils/export";
import type { ChartImage } from "../utils/export";
import type { Outcome } from "../types";

const useStyles = makeStyles({
    toolbar: {
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: tokens.spacingHorizontalM,
        flexWrap: "wrap",
    },
    section: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
    },
    filterField: {
        maxWidth: "280px",
    },
});

const OUTCOME_COLORS: Record<Outcome, string> = {
    Passed: "#107c10",
    Failed: "#d83b01",
    Blocked: "#c4314b",
    NotRun: "#c4c4c4",
};

const FALLBACK_STATE_COLOR = "8a8886";

export function PlanOverviewPage() {
    const styles = useStyles();
    const { t } = useTranslation();

    const [selectedPlanId, setSelectedPlanId] = useState<
        number | undefined
    >(undefined);
    const [isExporting, setIsExporting] = useState(false);

    const outcomeChartRef = useRef<HTMLDivElement>(null);
    const suiteChartRef = useRef<HTMLDivElement>(null);
    const bugStateChartRef = useRef<HTMLDivElement>(null);

    const { data: plans } = useQuery({
        queryKey: ["plans"],
        queryFn: fetchPlans,
    });

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["plan-overview", selectedPlanId],
        queryFn: () => fetchPlanOverview(selectedPlanId!),
        enabled: selectedPlanId != null,
    });

    const selectedPlanName = plans?.find(
        (p) => p.id === selectedPlanId
    )?.name;

    const outcomeChartData = data
        ? (Object.keys(data.outcomeCounts) as Outcome[]).map(
              (outcome) => ({
                  outcome,
                  count: data.outcomeCounts[outcome],
              })
          )
        : [];

    const passRate =
        data && data.totalTestCases
            ? Math.round(
                  (data.outcomeCounts.Passed / data.totalTestCases) * 1000
              ) / 10
            : 0;

    const handleExportPdf = async () => {
        if (!data) {
            return;
        }

        setIsExporting(true);

        try {
            const captured = await Promise.all([
                captureChartImage(
                    outcomeChartRef.current,
                    t("planOverviewPage.charts.outcomeBreakdown")
                ),
                captureChartImage(
                    suiteChartRef.current,
                    t("planOverviewPage.charts.testsBySuite")
                ),
                data.bugsByState.length > 0
                    ? captureChartImage(
                          bugStateChartRef.current,
                          t("planOverviewPage.charts.bugsByState")
                      )
                    : Promise.resolve(null),
            ]);

            const charts = captured.filter(
                (chart): chart is ChartImage => chart !== null
            );

            exportPlanOverviewToPdf(data, charts);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <PageLayout title={t("planOverviewPage.title")}>
            <div className={styles.toolbar}>
                <Field
                    label={t("planOverviewPage.planFilter.label")}
                    className={styles.filterField}
                >
                    <Dropdown
                        expandIcon={<ChevronDownRegular />}
                        placeholder={t(
                            "planOverviewPage.planFilter.placeholder"
                        )}
                        value={selectedPlanName ?? ""}
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
                        {plans?.map((plan) => (
                            <Option key={plan.id} value={String(plan.id)}>
                                {plan.name}
                            </Option>
                        ))}
                    </Dropdown>
                </Field>

                {data && (
                    <Button
                        appearance="secondary"
                        icon={<ArrowDownloadRegular />}
                        disabled={isExporting}
                        onClick={handleExportPdf}
                    >
                        {isExporting
                            ? t("planOverviewPage.exporting")
                            : t("planOverviewPage.exportPdf")}
                    </Button>
                )}
            </div>

            {selectedPlanId == null && (
                <EmptyState
                    message={t("planOverviewPage.selectPlanPrompt")}
                />
            )}

            {selectedPlanId != null && isLoading && <LoadingCardGrid />}

            {selectedPlanId != null && isError && (
                <ErrorState message={error.message} onRetry={refetch} />
            )}

            {selectedPlanId != null && data && (
                <>
                    <div className={styles.section}>
                        <CardGrid>
                            <StatCard
                                label={t(
                                    "planOverviewPage.stats.totalTests"
                                )}
                                value={data.totalTestCases}
                            />
                            <StatCard
                                label={t(
                                    "planOverviewPage.stats.totalBugs"
                                )}
                                value={data.totalBugs}
                            />
                            <StatCard
                                label={t(
                                    "planOverviewPage.stats.passRate"
                                )}
                                value={`${passRate}%`}
                            />
                        </CardGrid>
                    </div>

                    <ChartsGrid>
                        <ChartCard
                            title={t(
                                "planOverviewPage.charts.outcomeBreakdown"
                            )}
                        >
                            <div ref={outcomeChartRef}>
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={outcomeChartData}
                                        dataKey="count"
                                        nameKey="outcome"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={2}
                                    >
                                        {outcomeChartData.map((entry) => (
                                            <Cell
                                                key={entry.outcome}
                                                fill={
                                                    OUTCOME_COLORS[
                                                        entry.outcome
                                                    ]
                                                }
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value, _name, item) => [
                                            value,
                                            t(
                                                `outcome.${(item as any).payload.outcome}`
                                            ),
                                        ]}
                                    />
                                    <Legend
                                        formatter={(value) =>
                                            t(`outcome.${value}`)
                                        }
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        <ChartCard
                            title={t("planOverviewPage.charts.testsBySuite")}
                        >
                            <div ref={suiteChartRef}>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart
                                    data={data.testsBySuite}
                                    layout="vertical"
                                    margin={{ left: 24 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" allowDecimals={false} />
                                    <YAxis
                                        type="category"
                                        dataKey="suiteName"
                                        width={160}
                                        tick={{ fontSize: 12 }}
                                    />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#0078d4" />
                                </BarChart>
                            </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        <ChartCard
                            title={t("planOverviewPage.charts.bugsByState")}
                        >
                            {data.bugsByState.length > 0 ? (
                                <div ref={bugStateChartRef}>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart
                                        data={data.bugsByState}
                                        layout="vertical"
                                        margin={{ left: 24 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            type="number"
                                            allowDecimals={false}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="state"
                                            width={160}
                                            tick={{ fontSize: 12 }}
                                        />
                                        <Tooltip />
                                        <Bar dataKey="count">
                                            {data.bugsByState.map((entry) => (
                                                <Cell
                                                    key={entry.state}
                                                    fill={`#${
                                                        entry.color ??
                                                        FALLBACK_STATE_COLOR
                                                    }`}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                </div>
                            ) : (
                                <EmptyState
                                    message={t(
                                        "planOverviewPage.bugsSection.empty"
                                    )}
                                />
                            )}
                        </ChartCard>
                    </ChartsGrid>

                    <div className={styles.section}>
                        <ChartCard title={t("planOverviewPage.bugsSection.title")}>
                            {data.bugs.length > 0 ? (
                                <BugList bugs={data.bugs} />
                            ) : (
                                <EmptyState
                                    message={t(
                                        "planOverviewPage.bugsSection.empty"
                                    )}
                                />
                            )}
                        </ChartCard>
                    </div>
                </>
            )}
        </PageLayout>
    );
}
