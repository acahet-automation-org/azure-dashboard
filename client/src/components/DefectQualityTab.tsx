import { useTranslation } from "react-i18next";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";
import { StatCard } from "./StatCard";
import { CardGrid } from "./CardGrid";
import { ChartCard } from "./ChartCard";
import { EmptyState } from "./EmptyState";
import type { DefectStats } from "../types";

function toChartData(
    record: Record<string, number>
): { name: string; count: number }[] {
    return Object.entries(record)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
}

export function DefectQualityTab({ stats }: { stats: DefectStats }) {
    const { t } = useTranslation();
    const rejectionReasonsData = toChartData(stats.rejectionReasons);

    return (
        <>
            <CardGrid>
                <StatCard
                    label={t("defectManagementPage.stats.leakageRate")}
                    value={
                        stats.defectLeakageRate != null
                            ? `${stats.defectLeakageRate}%`
                            : t("defectManagementPage.stats.notConfigured")
                    }
                />
                <StatCard
                    label={t("defectManagementPage.stats.rejectionRate")}
                    value={`${stats.defectRejectionRate}%`}
                />
                <StatCard
                    label={t("defectManagementPage.stats.firstTimeFixRate")}
                    value={
                        stats.firstTimeFixRate != null
                            ? `${stats.firstTimeFixRate}%`
                            : t("defectManagementPage.stats.notAvailable")
                    }
                />
            </CardGrid>

            <ChartCard title={t("defectManagementPage.charts.rejectionReasons")}>
                {rejectionReasonsData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart
                            data={rejectionReasonsData}
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
                            <Bar dataKey="count" fill="#c4314b" />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <EmptyState
                        message={t("defectManagementPage.charts.noRejections")}
                    />
                )}
            </ChartCard>
        </>
    );
}
