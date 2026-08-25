import { lazy, Suspense, useState, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@fluentui/react-components";
import { useIsRestrictedOwner } from "./hooks/useIsRestrictedOwner";
import { useNavVisibility } from "./hooks/useNavVisibility";
import { fetchProjects } from "./api/client";
import { AzdoConnectionError } from "./components/AzdoConnectionError";
import { GettingStartedGuide } from "./components/GettingStartedGuide";
import { PatSetup } from "./components/PatSetup";
import { useAzdoConnection } from "./azdoConnection";

const SuitesPage = lazy(() => import("./pages/SuitesPage").then((m) => ({ default: m.SuitesPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const RunsPage = lazy(() => import("./pages/RunsPage").then((m) => ({ default: m.RunsPage })));
const PlansPage = lazy(() => import("./pages/PlansPage").then((m) => ({ default: m.PlansPage })));
const PlanDetailPage = lazy(() => import("./pages/PlanDetailPage").then((m) => ({ default: m.PlanDetailPage })));
const PlanOverviewPage = lazy(() =>
    import("./pages/PlanOverviewPage").then((m) => ({ default: m.PlanOverviewPage }))
);
const PlanProgressPage = lazy(() =>
    import("./pages/PlanProgressPage").then((m) => ({ default: m.PlanProgressPage }))
);
const AutomationDashboardPage = lazy(() =>
    import("./pages/AutomationDashboardPage").then((m) => ({ default: m.AutomationDashboardPage }))
);
const TestExecutionPage = lazy(() =>
    import("./pages/TestExecutionPage").then((m) => ({ default: m.TestExecutionPage }))
);
const DefectManagementPage = lazy(() =>
    import("./pages/DefectManagementPage").then((m) => ({ default: m.DefectManagementPage }))
);
const DynamicSprintReportPage = lazy(() =>
    import("./pages/DynamicSprintReportPage").then((m) => ({ default: m.DynamicSprintReportPage }))
);
const CommonErrorsPage = lazy(() => import("./pages/CommonErrorsPage").then((m) => ({ default: m.CommonErrorsPage })));
const MyWorkItemsPage = lazy(() => import("./pages/MyWorkItemsPage").then((m) => ({ default: m.MyWorkItemsPage })));
const RemoveTestCasesPage = lazy(() =>
    import("./pages/RemoveTestCasesPage").then((m) => ({ default: m.RemoveTestCasesPage }))
);
const ReleaseReadinessPage = lazy(() =>
    import("./pages/ReleaseReadinessPage").then((m) => ({ default: m.ReleaseReadinessPage }))
);

// "Plan Progress" and "Remove Test Cases" are hidden from the sidebar for
// everyone but the restricted owner (see useIsRestrictedOwner) - guard the
// routes too so a typed/bookmarked URL can't bypass that.
function RestrictedRoute({ children }: { children: ReactNode }) {
    const isRestrictedOwner = useIsRestrictedOwner();

    if (!isRestrictedOwner) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}

// Enforces a user's personal "hide this section" preference (Settings panel,
// see NavVisibilityProvider) at the route level too, so a typed/bookmarked
// URL can't bypass a hidden item any more than useIsRestrictedOwner's
// restriction can - same redirect-to-home strength, different (self-service,
// not admin) gate.
function HiddenRoute({
    navKey,
    children,
}: {
    navKey: string;
    children: ReactNode;
}) {
    const { isHidden } = useNavVisibility();

    if (isHidden(navKey)) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}

function PageFallback() {
    return (
        <div style={{ display: "flex", justifyContent: "center", padding: "48px" }}>
            <Spinner label="Loading..." />
        </div>
    );
}

const releaseReadinessEnabled =
    import.meta.env.VITE_ENABLE_RELEASE_READINESS === "true";

function AppRoutes() {
    return (
        <Suspense fallback={<PageFallback />}>
            <Routes>
                <Route path="/" element={<SuitesPage />} />
                <Route
                    path="/dashboard"
                    element={
                        <HiddenRoute navKey="dashboard">
                            <DashboardPage />
                        </HiddenRoute>
                    }
                />
                <Route
                    path="/last-10-runs"
                    element={
                        <HiddenRoute navKey="runs">
                            <RunsPage />
                        </HiddenRoute>
                    }
                />
                <Route
                    path="/plans"
                    element={
                        <HiddenRoute navKey="plans">
                            <PlansPage />
                        </HiddenRoute>
                    }
                />
                <Route
                    path="/plans/:planId"
                    element={
                        <HiddenRoute navKey="plans">
                            <PlanDetailPage />
                        </HiddenRoute>
                    }
                />
                <Route
                    path="/plan-overview"
                    element={
                        <HiddenRoute navKey="plan-overview">
                            <PlanOverviewPage />
                        </HiddenRoute>
                    }
                />
                <Route
                    path="/plan-progress"
                    element={
                        <RestrictedRoute>
                            <HiddenRoute navKey="plan-progress">
                                <PlanProgressPage />
                            </HiddenRoute>
                        </RestrictedRoute>
                    }
                />
                <Route
                    path="/automation-dashboard"
                    element={
                        <HiddenRoute navKey="automation-dashboard">
                            <AutomationDashboardPage />
                        </HiddenRoute>
                    }
                />
                <Route
                    path="/test-execution"
                    element={
                        <HiddenRoute navKey="execution">
                            <TestExecutionPage />
                        </HiddenRoute>
                    }
                />
                <Route
                    path="/defects"
                    element={
                        <HiddenRoute navKey="defects">
                            <DefectManagementPage />
                        </HiddenRoute>
                    }
                />
                <Route
                    path="/dynamic-sprint-report"
                    element={
                        <HiddenRoute navKey="dynamic-sprint-report">
                            <DynamicSprintReportPage />
                        </HiddenRoute>
                    }
                />
                <Route
                    path="/common-errors"
                    element={
                        <HiddenRoute navKey="common-errors">
                            <CommonErrorsPage />
                        </HiddenRoute>
                    }
                />
                <Route
                    path="/my-work-items"
                    element={
                        <HiddenRoute navKey="my-work-items">
                            <MyWorkItemsPage />
                        </HiddenRoute>
                    }
                />
                <Route
                    path="/remove-test-cases"
                    element={
                        <RestrictedRoute>
                            <HiddenRoute navKey="remove-test-cases">
                                <RemoveTestCasesPage />
                            </HiddenRoute>
                        </RestrictedRoute>
                    }
                />
                {releaseReadinessEnabled && (
                    <Route
                        path="/release-readiness"
                        element={
                            <HiddenRoute navKey="release-readiness">
                                <ReleaseReadinessPage />
                            </HiddenRoute>
                        }
                    />
                )}
            </Routes>
        </Suspense>
    );
}

const ONBOARDING_SEEN_KEY = "azureDashboardOnboardingSeen";
const SCOPE_STORAGE_KEY = "azureDashboardScope";

// No sign-in wall: access is gated on whether the server's AZDO_PAT actually
// works, not on a Microsoft identity. /api/projects is the cheapest call
// that exercises it (and the same query ScopeBar makes right after, so this
// just primes its cache rather than firing a second request). A PAT
// failure - not just "still loading" - renders AzdoConnectionError instead
// of a dashboard full of per-widget error banners.
function App() {
    const queryClient = useQueryClient();
    const { connection, saveConnection, clearConnection } = useAzdoConnection();
    const { isLoading, isError, refetch } = useQuery({
        queryKey: ["projects", connection?.org],
        queryFn: fetchProjects,
        enabled: connection != null,
    });

    // Shown once per browser the first time the app loads successfully;
    // reachable again anytime after via the Help button in TopBar.tsx.
    const [guideOpen, setGuideOpen] = useState(
        () => localStorage.getItem(ONBOARDING_SEEN_KEY) !== "true"
    );

    const closeGuide = () => {
        localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
        setGuideOpen(false);
    };

    const resetLocalState = () => {
        localStorage.removeItem(SCOPE_STORAGE_KEY);
        void queryClient.cancelQueries();
        queryClient.clear();
    };

    if (!connection) {
        return (
            <PatSetup
                onSave={(nextConnection) => {
                    saveConnection(nextConnection);
                    resetLocalState();
                    window.location.reload();
                }}
            />
        );
    }

    if (isLoading) {
        return <PageFallback />;
    }

    if (isError) {
        return (
            <AzdoConnectionError
                onRetry={() => void refetch()}
                onChangeConnection={() => {
                    clearConnection();
                    resetLocalState();
                    window.location.reload();
                }}
            />
        );
    }

    return (
        <>
            <AppRoutes />
            <GettingStartedGuide open={guideOpen} onClose={closeGuide} />
        </>
    );
}

export default App;
