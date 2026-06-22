import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";
import { Spinner } from "@fluentui/react-components";
import { SignInPage } from "./pages/SignInPage";

const SuitesPage = lazy(() => import("./pages/SuitesPage").then((m) => ({ default: m.SuitesPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const RunsPage = lazy(() => import("./pages/RunsPage").then((m) => ({ default: m.RunsPage })));
const PlansPage = lazy(() => import("./pages/PlansPage").then((m) => ({ default: m.PlansPage })));
const PlanDetailPage = lazy(() => import("./pages/PlanDetailPage").then((m) => ({ default: m.PlanDetailPage })));
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

function PageFallback() {
    return (
        <div style={{ display: "flex", justifyContent: "center", padding: "48px" }}>
            <Spinner label="Loading..." />
        </div>
    );
}

function App() {
    return (
        <>
            <AuthenticatedTemplate>
                <Suspense fallback={<PageFallback />}>
                    <Routes>
                        <Route path="/" element={<SuitesPage />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/last-5-runs" element={<RunsPage />} />
                        <Route path="/plans" element={<PlansPage />} />
                        <Route path="/plans/:planId" element={<PlanDetailPage />} />
                        <Route path="/automation-dashboard" element={<AutomationDashboardPage />} />
                        <Route path="/test-execution" element={<TestExecutionPage />} />
                        <Route path="/defects" element={<DefectManagementPage />} />
                        <Route path="/common-errors" element={<CommonErrorsPage />} />
                        <Route path="/my-work-items" element={<MyWorkItemsPage />} />
                    </Routes>
                </Suspense>
            </AuthenticatedTemplate>

            <UnauthenticatedTemplate>
                <SignInPage />
            </UnauthenticatedTemplate>
        </>
    );
}

export default App;
