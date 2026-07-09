import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMsal } from "@azure/msal-react";
import { TabList, Tab } from "@fluentui/react-components";
import { WeatherSunnyRegular } from "@fluentui/react-icons";
import { PageLayout } from "../components/PageLayout";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { WorkItemsTable } from "../components/WorkItemsTable";
import { Pagination } from "../components/Pagination";
import { fetchMyWorkItems } from "../api/client";
import type { MyWorkItemsMode } from "../types";

const EMPTY_MESSAGE_KEY: Record<MyWorkItemsMode, string> = {
    assigned: "myWorkItemsPage.emptyAssigned",
    mentioned: "myWorkItemsPage.emptyMentioned",
    following: "myWorkItemsPage.emptyFollowing",
    created: "myWorkItemsPage.emptyCreated",
};

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

export function MyWorkItemsPage() {
    const { t } = useTranslation();
    const [mode, setMode] = useState<MyWorkItemsMode>("assigned");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[1]);
    const { instance, accounts } = useMsal();
    const activeAccount = instance.getActiveAccount() ?? accounts[0];

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["my-work-items", mode],
        queryFn: () => fetchMyWorkItems(mode),
    });

    const skipAuth = import.meta.env.VITE_SKIP_AUTH === "true";

    // The backend returns all active items (it can't resolve "me" since it
    // talks to Azure DevOps with a shared PAT). The real logged-in identity
    // only exists here in the browser, so "assigned to me", "created by me",
    // and "mentioned" filter client-side, against each item's assignee,
    // creator, or extracted comment mentions respectively. In SKIP_AUTH dev
    // mode there's no logged-in identity to filter by, but the backend
    // already narrowed "assigned"/"created" to the PAT owner's own items via
    // @Me, so use the data as-is for those modes.
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
        } else if (mode === "created") {
            if (skipAuth) {
                items = data;
            } else {
                const username = activeAccount?.username?.toLowerCase();

                items = username
                    ? data.filter(
                        (item) =>
                            item.creator?.uniqueName?.toLowerCase() ===
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

        return items;
    }, [data, activeAccount, skipAuth, mode]);

    const pageCount = Math.max(1, Math.ceil(myItems.length / pageSize));
    const currentPage = Math.min(page, pageCount);
    const pagedItems = useMemo(
        () =>
            myItems.slice(
                (currentPage - 1) * pageSize,
                currentPage * pageSize
            ),
        [myItems, currentPage, pageSize]
    );

    return (
        <PageLayout title={t("myWorkItemsPage.title")}>
            <TabList
                selectedValue={mode}
                onTabSelect={(_, data) => {
                    setMode(data.value as MyWorkItemsMode);
                    setPage(1);
                }}
            >
                <Tab value="assigned">
                    {t("myWorkItemsPage.filters.assignedToMe")}
                </Tab>
                <Tab value="created">
                    {t("myWorkItemsPage.filters.createdByMe")}
                </Tab>
                <Tab value="mentioned" style={{ display: "none" }}>
                    {t("myWorkItemsPage.filters.mentioned")}
                </Tab>
                <Tab value="following">
                    {t("myWorkItemsPage.filters.following")}
                </Tab>
            </TabList>

            {isLoading && <LoadingCardGrid />}

            {isError && (
                <ErrorState message={error.message} onRetry={refetch} />
            )}

            {data && (
                myItems.length > 0 ? (
                    <>
                        <WorkItemsTable
                            items={pagedItems}
                            ariaLabel={t("myWorkItemsPage.title")}
                            showTags={mode === "created"}
                        />
                        <Pagination
                            page={currentPage}
                            pageCount={pageCount}
                            onPageChange={setPage}
                            pageSize={pageSize}
                            pageSizeOptions={PAGE_SIZE_OPTIONS}
                            onPageSizeChange={(size) => {
                                setPageSize(size);
                                setPage(1);
                            }}
                        />
                    </>
                ) : (
                    <EmptyState
                        message={t(EMPTY_MESSAGE_KEY[mode])}
                        icon={<WeatherSunnyRegular />}
                    />
                )
            )}
        </PageLayout>
    );
}
