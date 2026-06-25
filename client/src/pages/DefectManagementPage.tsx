import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Switch, makeStyles, tokens } from "@fluentui/react-components";
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
import { ChartsGrid } from "../components/ChartsGrid";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { BugsTable } from "../components/BugsTable";
import { Pagination } from "../components/Pagination";
import { fetchDefects } from "../api/client";
import { compareByState } from "../utils/bugState";

const useStyles = makeStyles({
    section: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
    },
});

const GAPS_PAGE_SIZE = 5;

function toChartData(
    record: Record<string, number>
): { name: string; count: number }[] {
    return Object.entries(record)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
}

export function DefectManagementPage() {
    const styles = useStyles();
    const { t } = useTranslation();
    const [excludeClosed, setExcludeClosed] = useState(true);
    const [gapsPage, setGapsPage] = useState(1);

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["defects"],
        queryFn: fetchDefects,
    });

    const filteredGaps = data?.stats.defectsWithoutLinkedTestCase
        .filter((b) => !excludeClosed || b.state !== "Closed")
        .sort(compareByState);

    const gapsPageCount = filteredGaps
        ? Math.max(1, Math.ceil(filteredGaps.length / GAPS_PAGE_SIZE))
        : 1;
    const currentGapsPage = Math.min(gapsPage, gapsPageCount);
    const paginatedGaps = filteredGaps?.slice(
        (currentGapsPage - 1) * GAPS_PAGE_SIZE,
        currentGapsPage * GAPS_PAGE_SIZE
    );

    return (
        <PageLayout title={t("defectManagementPage.title")}>
            {isLoading && <LoadingCardGrid />}

            {isError && (
                <ErrorState message={error.message} onRetry={refetch} />
            )}

            {data && (
                <>
                    <div className={styles.section}>
                        <CardGrid>
                            <StatCard
                                label={t("defectManagementPage.stats.totalOpen")}
                                value={data.stats.totalOpen}
                            />
                            <StatCard
                                label={t("defectManagementPage.stats.totalClosed")}
                                value={data.stats.totalClosed}
                            />
                            <StatCard
                                label={t("defectManagementPage.stats.mttr")}
                                value={
                                    data.stats.mttrDays != null
                                        ? t("defectManagementPage.stats.days", {
                                            value: data.stats.mttrDays,
                                        })
                                        : t("defectManagementPage.stats.notAvailable")
                                }
                            />
                            <StatCard
                                label={t("defectManagementPage.stats.reopenedBugs")}
                                value={data.stats.reopenedBugCount}
                            />
                            <StatCard
                                label={t("defectManagementPage.stats.duplicateRate")}
                                value={`${data.stats.duplicateRate}%`}
                            />
                            <StatCard
                                label={t("defectManagementPage.stats.bugsPerStory")}
                                value={
                                    data.stats.bugsPerStory != null
                                        ? data.stats.bugsPerStory
                                        : t("defectManagementPage.stats.notAvailable")
                                }
                            />
                            <StatCard
                                label={t("defectManagementPage.stats.withoutLinkedTestCase")}
                                value={filteredGaps?.length ?? 0}
                            />
                        </CardGrid>
                    </div>

                    <div className={styles.section}>
                        <ChartCard title={t("defectManagementPage.charts.trend")}>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={data.stats.trend}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="weekStart" tick={{ fontSize: 11 }} />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="opened"
                                        name={t("defectManagementPage.charts.opened")}
                                        stroke="#d83b01"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="closed"
                                        name={t("defectManagementPage.charts.closed")}
                                        stroke="#107c10"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="openTotal"
                                        name={t("defectManagementPage.charts.openTotal")}
                                        stroke="#0078d4"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    </div>

                    <ChartsGrid>
                        <ChartCard title={t("defectManagementPage.charts.bySeverity")}>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={toChartData(data.stats.bySeverity)}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#d83b01" />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard title={t("defectManagementPage.charts.byPriority")}>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={toChartData(data.stats.byPriority)}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#0078d4" />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard title={t("defectManagementPage.charts.byComponent")}>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart
                                    data={toChartData(data.stats.byComponent)}
                                    layout="vertical"
                                    margin={{ left: 24 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" allowDecimals={false} />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={160}
                                        tick={{ fontSize: 12 }}
                                    />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#8764b8" />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard title={t("defectManagementPage.charts.byTeam")}>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart
                                    data={toChartData(data.stats.byTeam)}
                                    layout="vertical"
                                    margin={{ left: 24 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" allowDecimals={false} />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={160}
                                        tick={{ fontSize: 12 }}
                                    />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#038387" />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard title={t("defectManagementPage.charts.aging")}>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={data.stats.agingBuckets}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#c4314b" />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    </ChartsGrid>

                    <div className={styles.section}>
                        <ChartCard
                            title={t("defectManagementPage.sections.withoutLinkedTestCase")}
                        >
                            <Switch
                                checked={excludeClosed}
                                onChange={(_, data) => {
                                    setExcludeClosed(data.checked);
                                    setGapsPage(1);
                                }}
                                label={t("defectManagementPage.sections.excludeClosed")}
                            />

                            {paginatedGaps && paginatedGaps.length > 0 ? (
                                <>
                                    <BugsTable
                                        bugs={paginatedGaps}
                                        ariaLabel={t(
                                            "defectManagementPage.sections.withoutLinkedTestCase"
                                        )}
                                    />
                                    <Pagination
                                        page={currentGapsPage}
                                        pageCount={gapsPageCount}
                                        onPageChange={setGapsPage}
                                    />
                                </>
                            ) : (
                                <EmptyState
                                    message={t("defectManagementPage.sections.noGaps")}
                                />
                            )}
                        </ChartCard>
                    </div>
                </>
            )}
        </PageLayout>
    );
}
