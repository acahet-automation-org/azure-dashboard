import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageLayout } from "../components/PageLayout";
import { CardGrid } from "../components/CardGrid";
import { PlanCardItem } from "../components/PlanCardItem";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { fetchPlans } from "../api/client";
import { useScope } from "../hooks/useScope";

export function PlansPage() {
    const { t } = useTranslation();
    const scope = useScope();
    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["plans", scope.project],
        queryFn: () => fetchPlans(scope),
        enabled: scope.isComplete,
    });

    return (
        <PageLayout title={t("plansPage.title")}>
            {!scope.isComplete && (
                <EmptyState message={t("scopeBar.selectScopePrompt")} />
            )}

            {scope.isComplete && isLoading && <LoadingCardGrid count={10} />}

            {isError && (
                <ErrorState message={error.message} onRetry={refetch} />
            )}

            {data &&
                (data.length === 0 ? (
                    <EmptyState message={t("plansPage.empty")} />
                ) : (
                    <CardGrid>
                        {data.map((plan) => (
                            <PlanCardItem key={plan.id} plan={plan} />
                        ))}
                    </CardGrid>
                ))}
        </PageLayout>
    );
}
