import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageLayout } from "../components/PageLayout";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { SprintDefectReportTab } from "../components/SprintDefectReportTab";
import type { SuiteGroupDef } from "../components/SprintDefectReportTab";
import { fetchDefects } from "../api/client";
import { useScope } from "../context/ScopeContext";
import type { DefectFilters } from "../types";

// Plurifond bugs are always scoped to these three suites (matched on the
// bug's Custom.Suite field, same as the org-wide Sprint Report's suite
// filter) - fixed rather than user-editable.
const PLURIFOND_BUG_SUITES = ["Tranche 1", "Tranche 2"];

// Plurifond Sprint 1 only tracks Test Factory for now - the whole plan
// (7414, 70 test cases), not a specific suite within it - no Test
// Business/Test Agenti breakdown exists for this project yet.
const PLURIFOND_SUITE_GROUP_DEFS: SuiteGroupDef[] = [
    {
        label: "Test Factory",
        planId: 7414,
    },
];

export function PlurifondSprintReportPage() {
    const { t } = useTranslation();
    const scope = useScope();

    // Iteration/area come from the global scope bar; suites are fixed for
    // this report.
    const filters: DefectFilters = {
        iteration: scope.sprint,
        area: scope.areaPath,
        environment: "",
        targetVersion: "",
        suites: PLURIFOND_BUG_SUITES,
    };

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["defects", filters, scope.project],
        queryFn: () => fetchDefects(filters, scope.project),
        enabled: scope.isComplete,
    });

    return (
        <PageLayout title={t("plurifondSprintReportPage.title")}>
            {isLoading && <LoadingCardGrid />}

            {isError && (
                <ErrorState message={error.message} onRetry={refetch} />
            )}

            {data && (
                <SprintDefectReportTab
                    stats={data.stats}
                    project={scope.project}
                    suiteGroupDefs={PLURIFOND_SUITE_GROUP_DEFS}
                    defaultHeaderTitle="Test Funzionali - Plurifonds"
                    defaultHeaderSubtitle="Stato avanzamento test funzionali – Plurifonds"
                    defaultActionsText={(report) => {
                        let outOfScopeLine = "";
                        if (report.outOfScopeCount > 0) {
                            const isPlural = report.outOfScopeCount > 1;
                            outOfScopeLine = `* escluso${isPlural ? "i" : ""} ${report.outOfScopeCount} bug segnalat${isPlural ? "i" : "o"} come fuori ambito.\n\n`;
                        }

                        return (
                            `System Integrator: inserire entro la giornata di oggi le date di risoluzione previste per i ${report.withoutResolutionDateCount} bug aperti.\n` +
                            outOfScopeLine +
                            "Test funzionali: Avviati i test funzionali per Plurifonds in data 27/07: Rilevato un numero significativo di test case non eseguibili, poiché associati a funzionalità non ancora rilasciate ma incluse nel piano di test condiviso.\n\n"
                        );
                    }}
                    includeDsiSource={false}
                    includeDeadline={false}
                />
            )}
        </PageLayout>
    );
}
