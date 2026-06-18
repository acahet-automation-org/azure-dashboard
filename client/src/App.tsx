import { Routes, Route } from "react-router-dom";
import { SuitesPage } from "./pages/SuitesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { RunsPage } from "./pages/RunsPage";

function App() {
    return (
        <Routes>
            <Route path="/" element={<SuitesPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/last-5-runs" element={<RunsPage />} />
        </Routes>
    );
}

export default App;
