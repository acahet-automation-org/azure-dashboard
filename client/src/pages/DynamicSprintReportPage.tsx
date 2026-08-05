import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
    Dropdown,
    Option,
    Field,
    Text,
    makeStyles,
    tokens,
} from "@fluentui/react-components";
import { ChevronDownRegular } from "@fluentui/react-icons";
import { PageLayout } from "../components/PageLayout";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { DefectFilterBar } from "../components/DefectFilterBar";
import { SprintDefectReportTab } from "../components/SprintDefectReportTab";
import type { SuiteGroupDef } from "../components/SprintDefectReportTab";
import {
    fetchPlans,
    fetchPlanOverview,
    fetchDefects,
} from "../api/client";
import { useScope } from "../context/ScopeContext";
import type { DefectFilters } from "../types";

const useStyles = makeStyles({
    filters: {
        display: "flex",
        flexWrap: "wrap",
        gap: tokens.spacingHorizontalM,
        alignItems: "flex-end",
    },
    field: {
        minWidth: "220px",
        flex: "1 1 220px",
    },
    chevron: {
        color: tokens.colorBrandForeground1,
        fontSize: "18px",
    },
    dropdownButton: {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    hint: {
        color: tokens.colorNeutralForeground3,
    },
});

export function DynamicSprintReportPage() {
    const { t } = useTranslation();
    const styles = useStyles();
    const scope = useScope();

    const [selectedPlanIds, setSelectedPlanIds] = useState<number[]>([]);
    const [localFilters, setLocalFilters] = useState<DefectFilters>({
        iteration: "",
        area: "",
        environment: "",
        targetVersion: "",
        suites: [],
    });

    const filters: DefectFilters = {
        ...localFilters,
        iteration: scope.sprint,
        area: scope.areaPath,
    };

    const { data: plans } = useQuery({
        queryKey: ["plans", scope.project],
        queryFn: () => fetchPlans(scope.project),
        enabled: scope.isComplete,
    });

    // Plans whose own iteration/area metadata match the current selection
    // are surfaced first - shown as a hint, not enforced, since that
    // metadata isn't always set reliably on every plan.
    const sortedPlans = useMemo(() => {
        const list = plans ?? [];

        return [...list].sort((a, b) => {
            const aMatches = a.iteration === scope.sprint || a.areaPath === scope.areaPath;
            const bMatches = b.iteration === scope.sprint || b.areaPath === scope.areaPath;

            if (aMatches !== bMatches) {
                return aMatches ? -1 : 1;
            }

            return a.name.localeCompare(b.name);
        });
    }, [plans, scope.sprint, scope.areaPath]);

    // Fetched to enumerate each selected plan's *real* suites, so the Suite
    // Progress table/PDF export and the "Includi Bug per Suite" toggle
    // reflect the actual suites inside the selected test plan(s) instead of
    // a single whole-plan row - reuses the same ["plan-overview", planId,
    // project] query SprintDefectReportTab fetches internally, so React
    // Query dedupes the two into one request per plan.
    const planOverviewQueries = useQueries({
        queries: selectedPlanIds.map((planId) => ({
            queryKey: ["plan-overview", planId, scope.project],
            queryFn: () => fetchPlanOverview(planId, scope.project),
            enabled: scope.isComplete,
        })),
    });

    const suiteGroupDefs: SuiteGroupDef[] = useMemo(() => {
        const rows: { label: string; planId: number; suiteIds: number[] }[] = [];

        selectedPlanIds.forEach((planId, index) => {
            const overview = planOverviewQueries[index]?.data;

            if (!overview) {
                return;
            }

            for (const suite of overview.suites) {
                rows.push({
                    label: suite.suiteName,
                    planId,
                    suiteIds: [suite.suiteId],
                });
            }
        });

        // Azure DevOps allows two suites with the same name within (or
        // across) selected plans - StatusReportCard keys its rows by label,
        // so a name reused as-is would collide into one row instead of two
        // (see the "Test Agenti" suiteId-matching comment on AUTO_SUITE_GROUP_DEFS
        // in SprintDefectReportTab.tsx for the same underlying ambiguity).
        // Disambiguate every row sharing a name with its suite ID.
        const nameCounts = new Map<string, number>();
        for (const row of rows) {
            nameCounts.set(row.label, (nameCounts.get(row.label) ?? 0) + 1);
        }

        return rows.map((row) => ({
            ...row,
            label:
                (nameCounts.get(row.label) ?? 0) > 1
                    ? `${row.label} (${row.suiteIds[0]})`
                    : row.label,
        }));
    }, [selectedPlanIds, planOverviewQueries]);

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["defects", filters, scope.project],
        queryFn: () => fetchDefects(filters, scope.project),
        enabled: scope.isComplete && !!scope.sprint,
    });

    const selectedPlansLabel =
        selectedPlanIds.length > 0
            ? t("dynamicSprintReportPage.selectedTestPlans", {
                  count: selectedPlanIds.length,
              })
            : t("dynamicSprintReportPage.testPlansPlaceholder");

    return (
        <PageLayout title={t("dynamicSprintReportPage.title")}>
            {!scope.isComplete && (
                <Text className={styles.hint}>
                    {t("dynamicSprintReportPage.selectProjectPrompt")}
                </Text>
            )}

            {scope.isComplete && !scope.sprint && (
                <Text className={styles.hint}>
                    {t("dynamicSprintReportPage.selectSprintPrompt")}
                </Text>
            )}

            {scope.isComplete && scope.sprint && (
                <div className={styles.filters}>
                    <Field
                        label={t("dynamicSprintReportPage.testPlansLabel")}
                        className={styles.field}
                    >
                        <Dropdown
                            multiselect
                            expandIcon={<ChevronDownRegular className={styles.chevron} />}
                            button={{ className: styles.dropdownButton }}
                            value={selectedPlansLabel}
                            selectedOptions={selectedPlanIds.map(String)}
                            onOptionSelect={(_, optionData) =>
                                setSelectedPlanIds(
                                    optionData.selectedOptions.map(Number)
                                )
                            }
                        >
                            {sortedPlans.map((plan) => (
                                <Option key={plan.id} value={String(plan.id)}>
                                    {plan.name}
                                </Option>
                            ))}
                        </Dropdown>
                    </Field>
                </div>
            )}

            {isLoading && <LoadingCardGrid />}

            {isError && (
                <ErrorState message={error.message} onRetry={refetch} />
            )}

            {data && scope.sprint && (
                <>
                    <DefectFilterBar
                        availableFilters={data.stats.availableFilters}
                        filters={filters}
                        onChange={setLocalFilters}
                        fields={["environment", "targetVersion"]}
                    />

                    <SprintDefectReportTab
                        stats={data.stats}
                        project={scope.project}
                        suiteGroupDefs={suiteGroupDefs}
                        defaultHeaderTitle={t("dynamicSprintReportPage.defaultHeaderTitle")}
                        defaultHeaderSubtitle={t(
                            "dynamicSprintReportPage.defaultHeaderSubtitle"
                        )}
                        includeDsiSource={false}
                        includeDeadline={false}
                    />
                </>
            )}
        </PageLayout>
    );
}
