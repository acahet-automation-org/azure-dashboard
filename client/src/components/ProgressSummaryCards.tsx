import type { RefObject } from "react";
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
} from "recharts";
import { Text, makeStyles, tokens } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { ChartCard } from "./ChartCard";
import { StatCard } from "./StatCard";
import type { TestPlanProgressCounts } from "../types";
import { runPercent, passedPercent } from "../utils/progressReport";

const useStyles = makeStyles({
    container: {
        display: "grid",
        gridTemplateColumns: "minmax(200px, 260px) 1fr",
        gap: tokens.spacingHorizontalM,
        alignItems: "stretch",

        "@media (max-width: 720px)": {
            gridTemplateColumns: "1fr",
        },
    },
    statsColumn: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalM,
    },
    chartsRow: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: tokens.spacingHorizontalM,

        "@media (max-width: 560px)": {
            gridTemplateColumns: "1fr",
        },
    },
    donutWrap: {
        position: "relative",
        display: "flex",
        justifyContent: "center",
    },
    donutLabel: {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        textAlign: "center",
    },
    passRateRow: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: tokens.spacingVerticalS,
    },
    legend: {
        display: "flex",
        flexDirection: "row",
        gap: tokens.spacingHorizontalL,
        flexWrap: "wrap",
        justifyContent: "center",
    },
    legendRow: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalSNudge,
    },
    legendDot: {
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        flexShrink: 0,
    },
    legendCount: {
        minWidth: "28px",
        textAlign: "right",
    },
});

const RUN_COLORS = ["#107c10", tokens.colorNeutralBackground4];

const PASS_RATE_COLORS: Record<string, string> = {
    passed: "#107c10",
    failed: "#d13438",
    blocked: "#8764b8",
};

const OUTCOME_LABEL_KEYS: Record<string, string> = {
    passed: "outcome.Passed",
    failed: "outcome.Failed",
    blocked: "outcome.Blocked",
};

export function ProgressSummaryCards({
    counts,
    runChartRef,
    passRateChartRef,
}: {
    counts: TestPlanProgressCounts;
    runChartRef?: RefObject<HTMLDivElement | null>;
    passRateChartRef?: RefObject<HTMLDivElement | null>;
}) {
    const { t } = useTranslation();
    const styles = useStyles();

    const executed = counts.total - counts.notExecuted;
    const run = runPercent(counts);
    const passed = passedPercent(counts);

    const runChartData = [
        { name: "executed", value: executed },
        { name: "remaining", value: counts.notExecuted },
    ];

    const passRateChartData = [
        { name: "passed", value: counts.passed },
        { name: "failed", value: counts.failed },
        { name: "blocked", value: counts.blocked },
    ].filter((entry) => entry.value > 0);

    const legendEntries: Array<{
        key: keyof typeof PASS_RATE_COLORS;
        count: number;
    }> = [
        { key: "passed", count: counts.passed },
        { key: "failed", count: counts.failed },
        { key: "blocked", count: counts.blocked },
    ];

    return (
        <div className={styles.container}>
            <div className={styles.statsColumn}>
                <StatCard
                    label={t("planProgressPage.summary.testPoints")}
                    value={counts.total}
                />
                <StatCard
                    label={t("planProgressPage.summary.testPointsRun")}
                    value={`${executed} (${executed} / ${counts.total})`}
                />
                <StatCard
                    label={t("planProgressPage.summary.passRate")}
                    value={`${passed}% (${counts.passed} / ${counts.total})`}
                />
            </div>

            <div className={styles.chartsRow}>
                <ChartCard title={t("planProgressPage.summary.runChart")}>
                    <div className={styles.donutWrap} ref={runChartRef}>
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={runChartData}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={62}
                                    outerRadius={88}
                                    startAngle={90}
                                    endAngle={-270}
                                    stroke="none"
                                >
                                    {runChartData.map((entry, index) => (
                                        <Cell
                                            key={entry.name}
                                            fill={RUN_COLORS[index]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value, name) => [
                                        value,
                                        name === "executed"
                                            ? t(
                                                  "planProgressPage.summary.executedLabel"
                                              )
                                            : t("outcome.NotRun"),
                                    ]}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className={styles.donutLabel}>
                            <Text size={700} weight="bold">
                                {run}%
                            </Text>
                        </div>
                    </div>
                </ChartCard>

                <ChartCard title={t("planProgressPage.summary.passRateChart")}>
                    <div className={styles.passRateRow} ref={passRateChartRef}>
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie
                                    data={passRateChartData}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={62}
                                    outerRadius={88}
                                    stroke="none"
                                >
                                    {passRateChartData.map((entry) => (
                                        <Cell
                                            key={entry.name}
                                            fill={
                                                PASS_RATE_COLORS[entry.name]
                                            }
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value, name) => [
                                        value,
                                        t(
                                            OUTCOME_LABEL_KEYS[
                                                name as string
                                            ]
                                        ),
                                    ]}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className={styles.legend}>
                            {legendEntries.map(({ key, count }) => (
                                <div key={key} className={styles.legendRow}>
                                    <span
                                        className={styles.legendDot}
                                        style={{
                                            backgroundColor:
                                                PASS_RATE_COLORS[key],
                                        }}
                                    />
                                    <Text
                                        className={styles.legendCount}
                                        weight="semibold"
                                    >
                                        {count}
                                    </Text>
                                    <Text>
                                        {t(OUTCOME_LABEL_KEYS[key])}
                                    </Text>
                                </div>
                            ))}
                        </div>
                    </div>
                </ChartCard>
            </div>
        </div>
    );
}
