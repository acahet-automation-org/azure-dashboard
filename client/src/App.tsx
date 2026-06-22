import { Routes, Route } from "react-router-dom";
import { AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";
import { SignInPage } from "./pages/SignInPage";
import { SuitesPage } from "./pages/SuitesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { RunsPage } from "./pages/RunsPage";
import { PlansPage } from "./pages/PlansPage";
import { PlanDetailPage } from "./pages/PlanDetailPage";
import { AutomationDashboardPage } from "./pages/AutomationDashboardPage";
import { TestExecutionPage } from "./pages/TestExecutionPage";
import { DefectManagementPage } from "./pages/DefectManagementPage";
import { CommonErrorsPage } from "./pages/CommonErrorsPage";
import { MyWorkItemsPage } from "./pages/MyWorkItemsPage";

function App() {
    return (
        <>
            <AuthenticatedTemplate>
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
            </AuthenticatedTemplate>

            <UnauthenticatedTemplate>
                <SignInPage />
            </UnauthenticatedTemplate>
        </>
    );
}

export default App;
