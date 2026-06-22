import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { TabList, Tab } from "@fluentui/react-components";
import { PageLayout } from "../components/PageLayout";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { WorkItemList } from "../components/WorkItemList";
import { fetchMyWorkItems } from "../api/client";

export function MyWorkItemsPage() {
    const { t } = useTranslation();
    const [type, setType] = useState<"Task" | "Bug">("Task");

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["my-work-items", type],
        queryFn: () => fetchMyWorkItems(type),
    });

    return (
        <PageLayout title={t("myWorkItemsPage.title")}>
            <TabList
                selectedValue={type}
                onTabSelect={(_, data) => setType(data.value as "Task" | "Bug")}
            >
                <Tab value="Task">{t("myWorkItemsPage.filters.tasks")}</Tab>
                <Tab value="Bug">{t("myWorkItemsPage.filters.bugs")}</Tab>
            </TabList>

            {isLoading && <LoadingCardGrid />}

            {isError && (
                <ErrorState message={error.message} onRetry={refetch} />
            )}

            {data && (
                data.length > 0 ? (
                    <WorkItemList items={data} />
                ) : (
                    <EmptyState message={t("myWorkItemsPage.empty")} />
                )
            )}
        </PageLayout>
    );
}
