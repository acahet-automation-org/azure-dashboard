import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Tab, TabList } from "@fluentui/react-components";
import { PageLayout } from "../components/PageLayout";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { DefectFilterBar } from "../components/DefectFilterBar";
import { DefectOverviewTab } from "../components/DefectOverviewTab";
import { DefectQualityTab } from "../components/DefectQualityTab";
import { DefectResourceTab } from "../components/DefectResourceTab";
import { fetchDefects } from "../api/client";
import type { DefectFilters } from "../types";

type DefectTab = "overview" | "quality" | "resource";

const EMPTY_FILTERS: DefectFilters = {
    iteration: "",
    area: "",
    environment: "",
    targetVersion: "",
};

export function DefectManagementPage() {
    const { t } = useTranslation();
    const [filters, setFilters] = useState<DefectFilters>(EMPTY_FILTERS);
    const [project, setProject] = useState("");
    const [tab, setTab] = useState<DefectTab>("overview");

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["defects", filters, project],
        queryFn: () => fetchDefects(filters, project || undefined),
    });

    return (
        <PageLayout title={t("defectManagementPage.title")}>
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
                        project={project || data.project}
                        availableProjects={data.availableProjects}
                        onProjectChange={(next) => {
                            setProject(next);
                            setFilters(EMPTY_FILTERS);
                        }}
                    />

                    <TabList
                        selectedValue={tab}
                        onTabSelect={(_, item) => setTab(item.value as DefectTab)}
                    >
                        <Tab value="overview">
                            {t("defectManagementPage.tabs.overview")}
                        </Tab>
                        <Tab value="quality">
                            {t("defectManagementPage.tabs.quality")}
                        </Tab>
                        <Tab value="resource">
                            {t("defectManagementPage.tabs.resource")}
                        </Tab>
                    </TabList>

                    {tab === "overview" && (
                        <DefectOverviewTab stats={data.stats} />
                    )}
                    {tab === "quality" && (
                        <DefectQualityTab stats={data.stats} />
                    )}
                    {tab === "resource" && (
                        <DefectResourceTab stats={data.stats} />
                    )}
                </>
            )}
        </PageLayout>
    );
}
