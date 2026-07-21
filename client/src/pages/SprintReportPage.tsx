import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageLayout } from "../components/PageLayout";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { DefectFilterBar } from "../components/DefectFilterBar";
import { SprintDefectReportTab } from "../components/SprintDefectReportTab";
import { fetchDefects } from "../api/client";
import type { DefectFilters } from "../types";

const EMPTY_FILTERS: DefectFilters = {
    iteration: "",
    area: "",
    environment: "",
    targetVersion: "",
    suites: [],
};

export function SprintReportPage() {
    const { t } = useTranslation();
    const [filters, setFilters] = useState<DefectFilters>(EMPTY_FILTERS);

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["defects", filters],
        queryFn: () => fetchDefects(filters),
    });

    return (
        <PageLayout title={t("sprintReportPage.title")}>
            {isLoading && <LoadingCardGrid />}

            {isError && (
                <ErrorState message={error.message} onRetry={refetch} />
            )}

            {data && (
                <>
                    <DefectFilterBar
                        availableFilters={data.stats.availableFilters}
                        filters={filters}
                        onChange={setFilters}
                    />

                    <SprintDefectReportTab stats={data.stats} />
                </>
            )}
        </PageLayout>
    );
}
