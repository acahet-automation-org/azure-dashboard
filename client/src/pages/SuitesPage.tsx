import { useQuery } from "@tanstack/react-query";
import { PageLayout } from "../components/PageLayout";
import { CardGrid } from "../components/CardGrid";
import { SuiteCard } from "../components/SuiteCard";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { fetchSuites } from "../api/client";

export function SuitesPage() {
    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["suites"],
        queryFn: fetchSuites,
    });

    return (
        <PageLayout title="QA Dashboard">
            {isLoading && <LoadingCardGrid />}

            {isError && (
                <ErrorState message={error.message} onRetry={refetch} />
            )}

            {data &&
                (Object.keys(data).length === 0 ? (
                    <EmptyState message="No suites found." />
                ) : (
                    <CardGrid>
                        {Object.entries(data)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([suiteName, stat]) => (
                                <SuiteCard
                                    key={suiteName}
                                    suiteName={suiteName}
                                    stat={stat}
                                />
                            ))}
                    </CardGrid>
                ))}
        </PageLayout>
    );
}
