import { useQuery } from "@tanstack/react-query";
import { PageLayout } from "../components/PageLayout";
import { CardGrid } from "../components/CardGrid";
import { RunCardItem } from "../components/RunCardItem";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { fetchRuns } from "../api/client";

export function RunsPage() {
    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["runs"],
        queryFn: fetchRuns,
    });

    return (
        <PageLayout title="QA Dashboard - Last 10 Runs">
            {isLoading && <LoadingCardGrid count={10} />}

            {isError && (
                <ErrorState message={error.message} onRetry={refetch} />
            )}

            {data &&
                (data.length === 0 ? (
                    <EmptyState message="No test runs found." />
                ) : (
                    <CardGrid>
                        {data.map((run) => (
                            <RunCardItem key={run.id} run={run} />
                        ))}
                    </CardGrid>
                ))}
        </PageLayout>
    );
}
