import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMsal } from "@azure/msal-react";
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
    const { instance, accounts } = useMsal();
    const activeAccount = instance.getActiveAccount() ?? accounts[0];

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["my-work-items", type],
        queryFn: () => fetchMyWorkItems(type),
    });

    // The backend returns all active items (it can't resolve "me" since it
    // talks to Azure DevOps with a shared PAT). The real logged-in identity
    // only exists here in the browser, so the "assigned to me" filter must
    // happen client-side against each item's assignee.
    const myItems = useMemo(() => {
        const username = activeAccount?.username?.toLowerCase();
        if (!data || !username) return [];

        return data.filter(
            (item) => item.assignee?.uniqueName?.toLowerCase() === username
        );
    }, [data, activeAccount]);

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
                myItems.length > 0 ? (
                    <WorkItemList items={myItems} />
                ) : (
                    <EmptyState message={t("myWorkItemsPage.empty")} />
                )
            )}
        </PageLayout>
    );
}
