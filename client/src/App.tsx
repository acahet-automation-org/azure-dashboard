import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";
import { Spinner } from "@fluentui/react-components";
import { SignInPage } from "./pages/SignInPage";

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
const CommonErrorsPage = lazy(() => import("./pages/CommonErrorsPage").then((m) => ({ default: m.CommonErrorsPage })));
const MyWorkItemsPage = lazy(() => import("./pages/MyWorkItemsPage").then((m) => ({ default: m.MyWorkItemsPage })));
const RemoveTestCasesPage = lazy(() =>
    import("./pages/RemoveTestCasesPage").then((m) => ({ default: m.RemoveTestCasesPage }))
);
const ReleaseReadinessPage = lazy(() =>
    import("./pages/ReleaseReadinessPage").then((m) => ({ default: m.ReleaseReadinessPage }))
);

function PageFallback() {
    return (
        <div style={{ display: "flex", justifyContent: "center", padding: "48px" }}>
            <Spinner label="Loading..." />
        </div>
    );
}

const skipAuth = import.meta.env.VITE_SKIP_AUTH === "true";
const releaseReadinessEnabled =
    import.meta.env.VITE_ENABLE_RELEASE_READINESS === "true";
// Locks the whole app down to just Defect Management (+ Release Readiness,
// if that's also enabled) - every other route redirects to /defects rather
// than rendering, so there's no way to reach them via a typed/bookmarked
// URL either, not just via the nav bar (see NavBar.tsx for the matching tab
// restriction).
const showOnlyDefectAndRelease =
    import.meta.env.VITE_SHOW_ONLY_DEFECT_AND_RELEASE === "true";

function AppRoutes() {
    return (
        <Suspense fallback={<PageFallback />}>
            <Routes>
                {showOnlyDefectAndRelease ? (
                    <>
                        <Route path="/defects" element={<DefectManagementPage />} />
                        {releaseReadinessEnabled && (
                            <Route
                                path="/release-readiness"
                                element={<ReleaseReadinessPage />}
                            />
                        )}
                        <Route path="*" element={<Navigate to="/defects" replace />} />
                    </>
                ) : (
                    <>
                        <Route path="/" element={<SuitesPage />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/last-10-runs" element={<RunsPage />} />
                        <Route path="/plans" element={<PlansPage />} />
                        <Route path="/plans/:planId" element={<PlanDetailPage />} />
                        <Route path="/plan-overview" element={<PlanOverviewPage />} />
                        <Route path="/plan-progress" element={<PlanProgressPage />} />
                        <Route path="/automation-dashboard" element={<AutomationDashboardPage />} />
                        <Route path="/test-execution" element={<TestExecutionPage />} />
                        <Route path="/defects" element={<DefectManagementPage />} />
                        <Route path="/common-errors" element={<CommonErrorsPage />} />
                        <Route path="/my-work-items" element={<MyWorkItemsPage />} />
                        <Route path="/remove-test-cases" element={<RemoveTestCasesPage />} />
                        {releaseReadinessEnabled && (
                            <Route
                                path="/release-readiness"
                                element={<ReleaseReadinessPage />}
                            />
                        )}
                    </>
                )}
            </Routes>
        </Suspense>
    );
}

function App() {
    if (skipAuth) {
        return <AppRoutes />;
    }

    return (
        <>
            <AuthenticatedTemplate>
                <AppRoutes />
            </AuthenticatedTemplate>

            <UnauthenticatedTemplate>
                <SignInPage />
            </UnauthenticatedTemplate>
        </>
    );
}

export default App;
