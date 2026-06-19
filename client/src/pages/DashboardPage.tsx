import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Accordion, Text, Title2, makeStyles, tokens } from "@fluentui/react-components";
import {
    CheckmarkCircleFilled,
    DismissCircleFilled,
    ErrorCircleFilled,
    BugFilled,
} from "@fluentui/react-icons";
import { PageLayout } from "../components/PageLayout";
import { StatCard } from "../components/StatCard";
import { FilterBar, type DashboardFilters } from "../components/FilterBar";
import { SuiteGroup } from "../components/SuiteGroup";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { fetchDashboard } from "../api/client";
import { computeGroupStats } from "../utils/stats";
import type { TestCaseRow } from "../types";

const useStyles = makeStyles({
    statsRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: tokens.spacingHorizontalM,
    },
    priority: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
    },
    meta: {
        color: tokens.colorNeutralForeground3,
    },
});

function matchesFilters(
    tc: TestCaseRow,
    filters: DashboardFilters
): boolean {
    if (filters.area && tc.areaPath !== filters.area) {
        return false;
    }

    if (filters.suite && tc.suiteName !== filters.suite) {
        return false;
    }

    if (
        filters.priority &&
        String(tc.priority) !== filters.priority
    ) {
        return false;
    }

    if (
        filters.search &&
        !tc.testCaseTitle
            .toLowerCase()
            .includes(filters.search.toLowerCase())
    ) {
        return false;
    }

    return true;
}

export function DashboardPage() {
    const styles = useStyles();
    const { t, i18n } = useTranslation();
    const [searchParams] = useSearchParams();

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["dashboard"],
        queryFn: fetchDashboard,
    });

    const [filters, setFilters] = useState<DashboardFilters>({
        area: "",
        suite: searchParams.get("suite") ?? "",
        priority: "",
        search: "",
    });

    const allTestCases = useMemo(
        () =>
            data
                ? Object.values(data.stats.groupedByPriority).flat()
                : [],
        [data]
    );

    const areaToSuites = useMemo(() => {
        const map: Record<string, Set<string>> = {};

        for (const tc of allTestCases) {
            if (!map[tc.areaPath]) {
                map[tc.areaPath] = new Set();
            }

            map[tc.areaPath].add(tc.suiteName);
        }

        return map;
    }, [allTestCases]);

    const suiteOptions = useMemo(() => {
        if (!data) {
            return [];
        }

        if (!filters.area) {
            return data.stats.suites;
        }

        return data.stats.suites.filter((s) =>
            areaToSuites[filters.area]?.has(s)
        );
    }, [data, filters.area, areaToSuites]);

    const filteredByPriority = useMemo(() => {
        if (!data) {
            return [] as [string, TestCaseRow[]][];
        }

        return Object.entries(data.stats.groupedByPriority)
            .map(
                ([priority, rows]) =>
                    [
                        priority,
                        rows.filter((tc) =>
                            matchesFilters(tc, filters)
                        ),
                    ] as [string, TestCaseRow[]]
            )
            .filter(([, rows]) => rows.length > 0)
            .sort(([a], [b]) => Number(a) - Number(b));
    }, [data, filters]);

    const filteredStats = useMemo(
        () =>
            computeGroupStats(
                filteredByPriority.flatMap(([, rows]) => rows)
            ),
        [filteredByPriority]
    );

    return (
        <PageLayout title={t("dashboardPage.title")}>
            {isLoading && <LoadingCardGrid />}

            {isError && (
                <ErrorState message={error.message} onRetry={refetch} />
            )}

            {data && (
                <>
                    <Text className={styles.meta}>
                        {t("dashboardPage.lastRefresh", {
                            date: new Date(data.cacheTimestamp).toLocaleString(
                                i18n.language
                            ),
                        })}
                    </Text>

                    <FilterBar
                        areaPaths={data.stats.areaPaths}
                        suiteOptions={suiteOptions}
                        priorities={data.stats.priorities}
                        filters={filters}
                        onChange={setFilters}
                    />

                    <div className={styles.statsRow}>
                        <StatCard
                            label={t("dashboardPage.stats.total")}
                            value={filteredStats.total}
                        />
                        <StatCard
                            label={t("dashboardPage.stats.withOpenBugs")}
                            value={filteredStats.withOpenBugs}
                            icon={<DismissCircleFilled />}
                        />
                        <StatCard
                            label={t("dashboardPage.stats.withoutOpenBugs")}
                            value={filteredStats.withoutOpenBugs}
                            icon={<CheckmarkCircleFilled />}
                        />
                        <StatCard
                            label={t("dashboardPage.stats.activeBugs")}
                            value={filteredStats.activeBugs}
                            icon={<BugFilled />}
                        />
                        <StatCard
                            label={t("dashboardPage.stats.closedBugs")}
                            value={filteredStats.closedBugs}
                            icon={<CheckmarkCircleFilled />}
                        />
                        <StatCard
                            label={t("dashboardPage.stats.passed")}
                            value={filteredStats.passed}
                        />
                        <StatCard
                            label={t("dashboardPage.stats.failed")}
                            value={filteredStats.failed}
                        />
                        <StatCard
                            label={t("dashboardPage.stats.blocked")}
                            value={filteredStats.blocked}
                            icon={<ErrorCircleFilled />}
                        />
                        <StatCard
                            label={t("dashboardPage.stats.notRun")}
                            value={filteredStats.notRun}
                        />
                        <StatCard
                            label={t("dashboardPage.stats.passRate")}
                            value={`${filteredStats.passRate}%`}
                        />
                    </div>

                    {filteredByPriority.length === 0 ? (
                        <EmptyState message={t("dashboardPage.emptyFiltered")} />
                    ) : (
                        filteredByPriority.map(([priority, rows]) => {
                            const suiteGroups = new Map<
                                string,
                                TestCaseRow[]
                            >();

                            for (const tc of rows) {
                                if (!suiteGroups.has(tc.suiteName)) {
                                    suiteGroups.set(tc.suiteName, []);
                                }

                                suiteGroups
                                    .get(tc.suiteName)!
                                    .push(tc);
                            }

                            const suiteEntries = [
                                ...suiteGroups.entries(),
                            ].sort(([a], [b]) => a.localeCompare(b));

                            return (
                                <div
                                    key={priority}
                                    className={styles.priority}
                                >
                                    <Title2 as="h2">
                                        {t("dashboardPage.priority", {
                                            value: priority,
                                        })}
                                    </Title2>

                                    <Accordion
                                        multiple
                                        collapsible
                                        defaultOpenItems={suiteEntries.map(
                                            ([suiteName]) =>
                                                `${priority}-${suiteName}`
                                        )}
                                    >
                                        {suiteEntries.map(
                                            ([
                                                suiteName,
                                                testCases,
                                            ]) => {
                                                const totalInSuite =
                                                    allTestCases.filter(
                                                        (tc) =>
                                                            tc.suiteName ===
                                                                suiteName &&
                                                            String(
                                                                tc.priority
                                                            ) === priority
                                                    ).length;

                                                return (
                                                    <SuiteGroup
                                                        key={suiteName}
                                                        value={`${priority}-${suiteName}`}
                                                        suiteName={
                                                            suiteName
                                                        }
                                                        totalCount={
                                                            totalInSuite
                                                        }
                                                        testCases={
                                                            testCases
                                                        }
                                                    />
                                                );
                                            }
                                        )}
                                    </Accordion>
                                </div>
                            );
                        })
                    )}
                </>
            )}
        </PageLayout>
    );
}
