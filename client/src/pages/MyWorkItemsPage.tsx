import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { TabList, Tab } from "@fluentui/react-components";
import { WeatherSunnyRegular } from "@fluentui/react-icons";
import { PageLayout } from "../components/PageLayout";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { WorkItemsTable } from "../components/WorkItemsTable";
import { Pagination } from "../components/Pagination";
import { fetchMyWorkItems } from "../api/client";
import { useScope } from "../hooks/useScope";
import type { MyWorkItemsMode, WorkItemSummary } from "../types";

const EMPTY_MESSAGE_KEY: Record<MyWorkItemsMode, string> = {
    assigned: "myWorkItemsPage.emptyAssigned",
    mentioned: "myWorkItemsPage.emptyMentioned",
    following: "myWorkItemsPage.emptyFollowing",
    created: "myWorkItemsPage.emptyCreated",
};

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

// There's no signed-in identity anymore (see App.tsx) to derive "me" from,
// so it's configured directly - VITE_MY_EMAIL for assignee/creator matching
// (Azure DevOps uniqueName), VITE_MY_NAME for the mentioned-tab display-name
// match. Same role AZDO_PAT plays for the backend: a fixed identity instead
// of a per-request one.
const myEmail = import.meta.env.VITE_MY_EMAIL?.toLowerCase();
const myName = import.meta.env.VITE_MY_NAME?.toLowerCase();

function filterByAssignee(
    data: WorkItemSummary[],
    username: string | undefined
): WorkItemSummary[] {
    if (!username) return [];

    return data.filter(
        (item) => item.assignee?.uniqueName?.toLowerCase() === username
    );
}

function filterByCreator(
    data: WorkItemSummary[],
    username: string | undefined
): WorkItemSummary[] {
    if (!username) return [];

    return data.filter(
        (item) => item.creator?.uniqueName?.toLowerCase() === username
    );
}

function filterByMention(
    data: WorkItemSummary[],
    displayName: string | undefined
): WorkItemSummary[] {
    if (!displayName) return [];

    return data.filter((item) =>
        item.mentions?.some((mention) => mention.toLowerCase() === displayName)
    );
}

// The backend returns all active items (it can't resolve "me" since it talks
// to Azure DevOps with a shared PAT). The real logged-in identity only exists
// here in the browser, so "assigned to me", "created by me", and "mentioned"
// filter client-side, against each item's assignee, creator, or extracted
// comment mentions respectively. "Following" can't be filtered client-side at
// all (Azure DevOps doesn't expose a "followed by" field per work item) - it
// always reflects whichever identity the backend's PAT belongs to.
function computeMyItems(
    data: WorkItemSummary[] | undefined,
    mode: MyWorkItemsMode
): WorkItemSummary[] {
    if (!data) return [];
    if (mode === "following") return data;

    if (mode === "assigned") {
        return filterByAssignee(data, myEmail);
    }

    if (mode === "created") {
        return filterByCreator(data, myEmail);
    }

    return filterByMention(data, myName);
}

export function MyWorkItemsPage() {
    const { t } = useTranslation();
    const [mode, setMode] = useState<MyWorkItemsMode>("assigned");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[1]);
    const scope = useScope();

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["my-work-items", mode, scope.project],
        queryFn: () => fetchMyWorkItems(mode, scope.project),
        enabled: scope.isComplete,
    });

    const myItems = useMemo(
        () => computeMyItems(data, mode),
        [data, mode]
    );

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
