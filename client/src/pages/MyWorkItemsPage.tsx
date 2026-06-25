import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMsal } from "@azure/msal-react";
import { TabList, Tab, Switch } from "@fluentui/react-components";
import { PageLayout } from "../components/PageLayout";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { WorkItemsTable } from "../components/WorkItemsTable";
import { fetchMyWorkItems } from "../api/client";
import type { MyWorkItemsMode } from "../types";

export function MyWorkItemsPage() {
    const { t } = useTranslation();
    const [mode, setMode] = useState<MyWorkItemsMode>("assigned");
    const [bugsOnly, setBugsOnly] = useState(false);
    const { instance, accounts } = useMsal();
    const activeAccount = instance.getActiveAccount() ?? accounts[0];

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["my-work-items", mode],
        queryFn: () => fetchMyWorkItems(mode),
    });

    const skipAuth = import.meta.env.VITE_SKIP_AUTH === "true";

    // The backend returns all active items (it can't resolve "me" since it
    // talks to Azure DevOps with a shared PAT). The real logged-in identity
    // only exists here in the browser, so "assigned to me" and "mentioned"
    // filter client-side, against each item's assignee or extracted comment
    // mentions respectively. In SKIP_AUTH dev mode there's no logged-in
    // identity to filter by, but the backend already narrowed "assigned" to
    // the PAT owner's own items via @Me, so use the data as-is for that mode.
    // "Following" can't be filtered client-side at all (Azure DevOps doesn't
    // expose a "followed by" field per work item) - it always reflects
    // whichever identity the backend's PAT belongs to.
    const myItems = useMemo(() => {
        if (!data) return [];

        let items: typeof data;

        if (mode === "following") {
            items = data;
        } else if (mode === "assigned") {
            if (skipAuth) {
                items = data;
            } else {
                const username = activeAccount?.username?.toLowerCase();

                items = username
                    ? data.filter(
                        (item) =>
                            item.assignee?.uniqueName?.toLowerCase() ===
                            username
                    )
                    : [];
            }
        } else {
            // mode === "mentioned"
            if (skipAuth) {
                items = data;
            } else {
                const displayName = activeAccount?.name?.toLowerCase();

                items = displayName
                    ? data.filter((item) =>
                        item.mentions?.some(
                            (mention) =>
                                mention.toLowerCase() === displayName
                        )
                    )
                    : [];
            }
        }

        return bugsOnly
            ? items.filter((item) => item.type === "Bug")
            : items;
    }, [data, activeAccount, skipAuth, mode, bugsOnly]);

    return (
        <PageLayout title={t("myWorkItemsPage.title")}>
            <TabList
                selectedValue={mode}
                onTabSelect={(_, data) =>
                    setMode(data.value as MyWorkItemsMode)
                }
            >
                <Tab value="assigned">
                    {t("myWorkItemsPage.filters.assignedToMe")}
                </Tab>
                <Tab value="mentioned" style={{ display: "none" }}>
                    {t("myWorkItemsPage.filters.mentioned")}
                </Tab>
                <Tab value="following">
                    {t("myWorkItemsPage.filters.following")}
                </Tab>
            </TabList>

            <Switch
                checked={bugsOnly}
                onChange={(_, data) => setBugsOnly(data.checked)}
                label={t("myWorkItemsPage.filters.bugsOnly")}
            />

            {isLoading && <LoadingCardGrid />}

            {isError && (
                <ErrorState message={error.message} onRetry={refetch} />
            )}

            {data && (
                myItems.length > 0 ? (
                    <WorkItemsTable
                        items={myItems}
                        ariaLabel={t("myWorkItemsPage.title")}
                    />
                ) : (
                    <EmptyState message={t("myWorkItemsPage.empty")} />
                )
            )}
        </PageLayout>
    );
}
