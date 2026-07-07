import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
    Dropdown,
    Option,
    Field,
    Button,
    Spinner,
    Text,
    Title3,
    makeStyles,
    tokens,
} from "@fluentui/react-components";
import {
    ChevronDownRegular,
    ArrowDownloadRegular,
    MailRegular,
} from "@fluentui/react-icons";
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
import { BugsTable } from "../components/BugsTable";
import { fetchPlans, fetchPlanOverview, sendEmailReport } from "../api/client";
import {
    buildEmailReportHtml,
    buildPlanOverviewFilename,
    buildPlanOverviewPdfBase64,
    buildPlanOverviewSuitePdfBase64,
    captureChartImage,
    exportPlanOverviewToPdf,
} from "../utils/export";
import type { ChartImage } from "../utils/export";
import { categoryAxisWidth } from "../utils/chartAxis";
import type { Outcome } from "../types";

const emailReportEnabled =
    import.meta.env.VITE_ENABLE_EMAIL_REPORT === "true";

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
    meta: {
        color: tokens.colorNeutralForeground3,
    },
    overlay: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        zIndex: 1000,
    },
});

const OUTCOME_COLORS: Record<Outcome, string> = {
    Passed: "#107c10",
    Failed: "#d13438",
    Blocked: "#8764b8",
    NotApplicable: "#0078d4",
    NotRun: "#605e5c",
};

const FALLBACK_STATE_COLOR = "8a8886";

export function PlanOverviewPage() {
    const styles = useStyles();
    const { t } = useTranslation();

    const [selectedPlanId, setSelectedPlanId] = useState<
        number | undefined
    >(undefined);
    const [selectedSuiteName, setSelectedSuiteName] = useState<
        string | undefined
    >(undefined);
    const [isExporting, setIsExporting] = useState(false);

    const outcomeChartRef = useRef<HTMLDivElement>(null);
    const suiteChartRef = useRef<HTMLDivElement>(null);
    const bugStateChartRef = useRef<HTMLDivElement>(null);
    const selectedSuiteOutcomeChartRef = useRef<HTMLDivElement>(null);

    const emailReportMutation = useMutation({
        mutationFn: sendEmailReport,
    });

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

    const executionRate =
        data && data.totalTestCases
            ? Math.round(
                  ((data.totalTestCases -
                      data.outcomeCounts.NotRun -
                      data.outcomeCounts.NotApplicable) /
                      data.totalTestCases) *
                      1000
              ) / 10
            : 0;

    const selectedSuite = data?.suites.find(
        (s) => s.suiteName === selectedSuiteName
    );

    const suitePassRate =
        selectedSuite && selectedSuite.totalTestCases
            ? Math.round(
                  (selectedSuite.outcomeCounts.Passed /
                      selectedSuite.totalTestCases) *
                      1000
              ) / 10
            : 0;

    const suiteExecutionRate =
        selectedSuite && selectedSuite.totalTestCases
            ? Math.round(
                  ((selectedSuite.totalTestCases -
                      selectedSuite.outcomeCounts.NotRun -
                      selectedSuite.outcomeCounts.NotApplicable) /
                      selectedSuite.totalTestCases) *
                      1000
              ) / 10
            : 0;

    const selectedSuiteOutcomeChartData = selectedSuite
        ? (Object.keys(selectedSuite.outcomeCounts) as Outcome[]).map(
              (outcome) => ({
                  outcome,
                  count: selectedSuite.outcomeCounts[outcome],
              })
          )
        : [];

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

            if (selectedSuite) {
                const suiteChart = await captureChartImage(
                    selectedSuiteOutcomeChartRef.current,
                    t("planOverviewPage.charts.outcomeBreakdown")
                );

                exportPlanOverviewToPdf(data, charts, {
                    suite: selectedSuite,
                    chart: suiteChart,
                });
            } else {
                exportPlanOverviewToPdf(data, charts);
            }
        } finally {
            setIsExporting(false);
        }
    };

    const handleSendEmail = async () => {
        if (!data) {
            return;
        }

        if (selectedSuite) {
            const chart = await captureChartImage(
                selectedSuiteOutcomeChartRef.current,
                t("planOverviewPage.charts.outcomeBreakdown")
            );
            const fromName = `${data.planName} - ${selectedSuite.suiteName}`;
            const pdfBase64 = buildPlanOverviewSuitePdfBase64(
                data.planName,
                selectedSuite,
                chart ?? undefined
            );
            emailReportMutation.mutate({
                subject: fromName,
                bodyHtml: buildEmailReportHtml(
                    fromName,
                    [
                        [
                            t("planOverviewPage.stats.totalTests"),
                            selectedSuite.totalTestCases,
                        ],
                        [
                            t("outcome.Passed"),
                            selectedSuite.outcomeCounts.Passed,
                        ],
                        [
                            t("outcome.Failed"),
                            selectedSuite.outcomeCounts.Failed,
                        ],
                        [
                            t("outcome.Blocked"),
                            selectedSuite.outcomeCounts.Blocked,
                        ],
                        [
                            t("outcome.NotRun"),
                            selectedSuite.outcomeCounts.NotRun,
                        ],
                        [
                            t("outcome.NotApplicable"),
                            selectedSuite.outcomeCounts.NotApplicable,
                        ],
                        [
                            t("planOverviewPage.stats.passRate"),
                            `${suitePassRate}%`,
                        ],
                        [
                            t("planOverviewPage.stats.executionRate"),
                            `${suiteExecutionRate}%`,
                        ],
                        [
                            t("planOverviewPage.stats.totalBugs"),
                            selectedSuite.bugs.length,
                        ],
                    ],
                    t("planOverviewPage.email.metricColumn"),
                    t("planOverviewPage.email.valueColumn")
                ),
                pdfBase64,
                filename: buildPlanOverviewFilename(
                    data.planName,
                    selectedSuite.suiteName
                ),
                fromName,
            });
            return;
        }

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

        const pdfBase64 = buildPlanOverviewPdfBase64(data, charts);

        emailReportMutation.mutate({
            subject: data.planName,
            bodyHtml: buildEmailReportHtml(
                data.planName,
                [
                    [
                        t("planOverviewPage.stats.totalTests"),
                        data.totalTestCases,
                    ],
                    [t("outcome.Passed"), data.outcomeCounts.Passed],
                    [t("outcome.Failed"), data.outcomeCounts.Failed],
                    [t("outcome.Blocked"), data.outcomeCounts.Blocked],
                    [t("outcome.NotRun"), data.outcomeCounts.NotRun],
                    [
                        t("outcome.NotApplicable"),
                        data.outcomeCounts.NotApplicable,
                    ],
                    [t("planOverviewPage.stats.passRate"), `${passRate}%`],
                    [
                        t("planOverviewPage.stats.executionRate"),
                        `${executionRate}%`,
                    ],
                    [t("planOverviewPage.stats.totalBugs"), data.totalBugs],
                ],
                t("planOverviewPage.email.metricColumn"),
                t("planOverviewPage.email.valueColumn")
            ),
            pdfBase64,
            filename: buildPlanOverviewFilename(data.planName),
            fromName: data.planName,
        });
    };

    return (
        <PageLayout title={t("planOverviewPage.title")}>
            {emailReportMutation.isPending && (
                <div className={styles.overlay}>
                    <Spinner label={t("planOverviewPage.emailSending")} />
                </div>
            )}

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
                            setSelectedSuiteName(undefined);
                            emailReportMutation.reset();
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
                    <Field
                        label={t("planOverviewPage.suiteFilter.label")}
                        className={styles.filterField}
                    >
                        <Dropdown
                            expandIcon={<ChevronDownRegular />}
                            value={
                                selectedSuiteName ??
                                t("filterBar.allSuites")
                            }
                            selectedOptions={[selectedSuiteName ?? ""]}
                            onOptionSelect={(_, option) => {
                                const value = option.optionValue;

                                setSelectedSuiteName(value || undefined);
                                emailReportMutation.reset();
                            }}
                        >
                            <Option value="">
                                {t("filterBar.allSuites")}
                            </Option>
                            {data.suites.map((suite) => (
                                <Option
                                    key={suite.suiteName}
                                    value={suite.suiteName}
                                >
                                    {suite.suiteName}
                                </Option>
                            ))}
                        </Dropdown>
                    </Field>
                )}

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

                {data && emailReportEnabled && (
                    <Button
                        appearance="secondary"
                        icon={<MailRegular />}
                        disabled={emailReportMutation.isPending}
                        onClick={handleSendEmail}
                    >
                        {emailReportMutation.isPending
                            ? t("planOverviewPage.emailSending")
                            : t("planOverviewPage.sendEmail")}
                    </Button>
                )}
            </div>

            {data && emailReportEnabled && emailReportMutation.isSuccess && (
                <Text className={styles.meta}>
                    {t("planOverviewPage.emailSent")}
                </Text>
            )}

            {data && emailReportEnabled && emailReportMutation.isError && (
                <Text
                    role="alert"
                    style={{ color: tokens.colorPaletteRedForeground1 }}
                >
                    {t("planOverviewPage.emailFailed", {
                        message: emailReportMutation.error.message,
                    })}
                </Text>
            )}

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
                                label={t("outcome.Blocked")}
                                value={data.outcomeCounts.Blocked}
                            />
                            <StatCard
                                label={t("outcome.NotRun")}
                                value={data.outcomeCounts.NotRun}
                            />
                            <StatCard
                                label={t("outcome.NotApplicable")}
                                value={data.outcomeCounts.NotApplicable}
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
                            <StatCard
                                label={t(
                                    "planOverviewPage.stats.executionRate"
                                )}
                                value={`${executionRate}%`}
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
                                        formatter={(
                                            value,
                                            _name,
                                            item: { payload?: { outcome: string } }
                                        ) => [
                                            value,
                                            t(
                                                `outcome.${item.payload?.outcome ?? ""}`
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
                                        width={categoryAxisWidth(
                                            data.testsBySuite.map(
                                                (s) => s.suiteName
                                            )
                                        )}
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
                                            width={categoryAxisWidth(
                                                data.bugsByState.map(
                                                    (s) => s.state
                                                )
                                            )}
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
                                <BugsTable
                                    bugs={data.bugs}
                                    ariaLabel={t(
                                        "planOverviewPage.bugsSection.title"
                                    )}
                                />
                            ) : (
                                <EmptyState
                                    message={t(
                                        "planOverviewPage.bugsSection.empty"
                                    )}
                                />
                            )}
                        </ChartCard>
                    </div>

                    {selectedSuite && (
                        <div className={styles.section}>
                            <Title3 as="h2">
                                {t("planOverviewPage.selectedSuiteSection.title", {
                                    suite: selectedSuite.suiteName,
                                })}
                            </Title3>

                            <CardGrid>
                                <StatCard
                                    label={t(
                                        "planOverviewPage.stats.totalTests"
                                    )}
                                    value={selectedSuite.totalTestCases}
                                />
                                <StatCard
                                    label={t("outcome.Blocked")}
                                    value={selectedSuite.outcomeCounts.Blocked}
                                />
                                <StatCard
                                    label={t("outcome.NotRun")}
                                    value={selectedSuite.outcomeCounts.NotRun}
                                />
                                <StatCard
                                    label={t("outcome.NotApplicable")}
                                    value={
                                        selectedSuite.outcomeCounts
                                            .NotApplicable
                                    }
                                />
                                <StatCard
                                    label={t(
                                        "planOverviewPage.stats.totalBugs"
                                    )}
                                    value={selectedSuite.bugs.length}
                                />
                                <StatCard
                                    label={t(
                                        "planOverviewPage.stats.passRate"
                                    )}
                                    value={`${suitePassRate}%`}
                                />
                                <StatCard
                                    label={t(
                                        "planOverviewPage.stats.executionRate"
                                    )}
                                    value={`${suiteExecutionRate}%`}
                                />
                            </CardGrid>

                            <ChartCard
                                title={t(
                                    "planOverviewPage.selectedSuiteSection.outcomeTitle"
                                )}
                            >
                                <div ref={selectedSuiteOutcomeChartRef}>
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie
                                            data={selectedSuiteOutcomeChartData}
                                            dataKey="count"
                                            nameKey="outcome"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={2}
                                        >
                                            {selectedSuiteOutcomeChartData.map(
                                                (entry) => (
                                                    <Cell
                                                        key={entry.outcome}
                                                        fill={
                                                            OUTCOME_COLORS[
                                                                entry.outcome
                                                            ]
                                                        }
                                                    />
                                                )
                                            )}
                                        </Pie>
                                        <Tooltip
                                            formatter={(
                                                value,
                                                _name,
                                                item: { payload?: { outcome: string } }
                                            ) => [
                                                value,
                                                t(
                                                    `outcome.${item.payload?.outcome ?? ""}`
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
                                title={t(
                                    "planOverviewPage.selectedSuiteSection.bugsTitle"
                                )}
                            >
                                {selectedSuite.bugs.length > 0 ? (
                                    <BugsTable
                                        bugs={selectedSuite.bugs}
                                        ariaLabel={t(
                                            "planOverviewPage.selectedSuiteSection.bugsTitle"
                                        )}
                                    />
                                ) : (
                                    <EmptyState
                                        message={t(
                                            "planOverviewPage.selectedSuiteSection.noBugs"
                                        )}
                                    />
                                )}
                            </ChartCard>
                        </div>
                    )}
                </>
            )}
        </PageLayout>
    );
}
