import { lazy, Suspense, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";
import { Spinner } from "@fluentui/react-components";
import { SignInPage } from "./pages/SignInPage";
import { ViewModeSelectPage } from "./pages/ViewModeSelectPage";
import { useIsRestrictedOwner } from "./hooks/useIsRestrictedOwner";
import { ScopeProvider } from "./hooks/ScopeProvider";
import { useScope } from "./hooks/useScope";
import { ViewModeProvider } from "./hooks/ViewModeProvider";
import { useViewMode } from "./hooks/useViewMode";
import type { ViewMode } from "./hooks/viewModeContext";

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
const SprintReportPage = lazy(() =>
    import("./pages/SprintReportPage").then((m) => ({ default: m.SprintReportPage }))
);
const PlurifondSprintReportPage = lazy(() =>
    import("./pages/PlurifondSprintReportPage").then((m) => ({ default: m.PlurifondSprintReportPage }))
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

// Keeps a typed/bookmarked URL from crossing into the other view - once a
// mode is chosen (see ViewModeSelectPage), only its own routes are
// reachable. `mode` is null before the picker has ever been shown (no
// project selected yet), so routes stay open during that pre-gate state
// rather than redirecting in a loop.
function ModeRoute({ allow, children }: { allow: ViewMode; children: ReactNode }) {
    const { mode } = useViewMode();

    if (mode && mode !== allow) {
        return (
            <Navigate
                to={mode === "automation" ? "/automation-dashboard" : "/"}
                replace
            />
        );
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
    const { mode } = useViewMode();

    return (
        <Suspense fallback={<PageFallback />}>
            <Routes>
                {showOnlyDefectAndRelease ? (
                    <>
                        <Route path="/defects" element={<DefectManagementPage />} />
                        <Route path="/sprint-report" element={<SprintReportPage />} />
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
                        <Route
                            path="/"
                            element={
                                mode === "automation" ? (
                                    <Navigate to="/automation-dashboard" replace />
                                ) : (
                                    <SuitesPage />
                                )
                            }
                        />
                        <Route
                            path="/dashboard"
                            element={
                                <ModeRoute allow="functional">
                                    <DashboardPage />
                                </ModeRoute>
                            }
                        />
                        <Route
                            path="/last-10-runs"
                            element={
                                <ModeRoute allow="functional">
                                    <RunsPage />
                                </ModeRoute>
                            }
                        />
                        <Route
                            path="/plans"
                            element={
                                <ModeRoute allow="functional">
                                    <PlansPage />
                                </ModeRoute>
                            }
                        />
                        <Route
                            path="/plans/:planId"
                            element={
                                <ModeRoute allow="functional">
                                    <PlanDetailPage />
                                </ModeRoute>
                            }
                        />
                        <Route
                            path="/plan-overview"
                            element={
                                <ModeRoute allow="functional">
                                    <PlanOverviewPage />
                                </ModeRoute>
                            }
                        />
                        <Route
                            path="/plan-progress"
                            element={
                                <ModeRoute allow="functional">
                                    <RestrictedRoute>
                                        <PlanProgressPage />
                                    </RestrictedRoute>
                                </ModeRoute>
                            }
                        />
                        <Route
                            path="/automation-dashboard"
                            element={
                                <ModeRoute allow="automation">
                                    <AutomationDashboardPage />
                                </ModeRoute>
                            }
                        />
                        <Route
                            path="/test-execution"
                            element={
                                <ModeRoute allow="functional">
                                    <TestExecutionPage />
                                </ModeRoute>
                            }
                        />
                        <Route
                            path="/defects"
                            element={
                                <ModeRoute allow="functional">
                                    <DefectManagementPage />
                                </ModeRoute>
                            }
                        />
                        <Route
                            path="/sprint-report"
                            element={
                                <ModeRoute allow="functional">
                                    <SprintReportPage />
                                </ModeRoute>
                            }
                        />
                        <Route
                            path="/plurifond-sprint-report"
                            element={
                                <ModeRoute allow="functional">
                                    <PlurifondSprintReportPage />
                                </ModeRoute>
                            }
                        />
                        <Route
                            path="/common-errors"
                            element={
                                <ModeRoute allow="automation">
                                    <CommonErrorsPage />
                                </ModeRoute>
                            }
                        />
                        <Route
                            path="/my-work-items"
                            element={
                                <ModeRoute allow="functional">
                                    <MyWorkItemsPage />
                                </ModeRoute>
                            }
                        />
                        <Route
                            path="/remove-test-cases"
                            element={
                                <ModeRoute allow="functional">
                                    <RestrictedRoute>
                                        <RemoveTestCasesPage />
                                    </RestrictedRoute>
                                </ModeRoute>
                            }
                        />
                        {releaseReadinessEnabled && (
                            <Route
                                path="/release-readiness"
                                element={
                                    <ModeRoute allow="functional">
                                        <ReleaseReadinessPage />
                                    </ModeRoute>
                                }
                            />
                        )}
                    </>
                )}
            </Routes>
        </Suspense>
    );
}

// Once a project is selected (see ScopeBar), gate the app behind the
// Functional/Automation choice until one is made - showOnlyDefectAndRelease
// locks the app to a single fixed view already, so that mode has no picker
// to show.
function AppGate() {
    const scope = useScope();
    const { mode } = useViewMode();

    if (!showOnlyDefectAndRelease && scope.isComplete && !mode) {
        return <ViewModeSelectPage />;
    }

    return <AppRoutes />;
}

function App() {
    if (skipAuth) {
        return (
            <ScopeProvider>
                <ViewModeProvider>
                    <AppGate />
                </ViewModeProvider>
            </ScopeProvider>
        );
    }

    return (
        <>
            <AuthenticatedTemplate>
                <ScopeProvider>
                    <ViewModeProvider>
                        <AppGate />
                    </ViewModeProvider>
                </ScopeProvider>
            </AuthenticatedTemplate>

            <UnauthenticatedTemplate>
                <SignInPage />
            </UnauthenticatedTemplate>
        </>
    );
}

export default App;
