import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import {
    getDashboardData,
    clearDashboardCache,
    getCacheTimestamp,
    computeDashboardStats,
    computeSuiteStats,
    computeRunCards,
    computeExecutionTrend,
    computeTestPlans,
    computePlanSuites,
} from "./dashboardData.js";
import { getAutomationDashboard } from "./automationData.js";
import {
    getDefectData,
    getDefectCacheTimestamp,
    computeDefectStats,
    clearDefectCache,
    getStoryCount,
} from "./defectData.js";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

const clientDist = path.join(
    __dirname,
    "../client/dist"
);

const app = express();

app.use(express.static(clientDist));

app.get("/api/suites", async (_, res) => {
    try {
        const allTestCases =
            await getDashboardData();

        res.json(
            computeSuiteStats(allTestCases)
        );
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.get("/api/dashboard", async (_, res) => {
    try {
        const allTestCases =
            await getDashboardData();

        res.json({
            stats: computeDashboardStats(
                allTestCases
            ),
            cacheTimestamp: getCacheTimestamp(),
        });
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.get("/api/runs", async (_, res) => {
    try {
        res.json(await computeRunCards());
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.get("/api/execution-trend", async (_, res) => {
    try {
        const [trend, allTestCases] =
            await Promise.all([
                computeExecutionTrend(),
                getDashboardData(),
            ]);

        res.json({
            trend,
            totalTestCases: allTestCases.length,
        });
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.get("/api/plans", async (_, res) => {
    try {
        res.json(await computeTestPlans());
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.get("/api/plans/:planId/suites", async (req, res) => {
    try {
        const planId = Number(req.params.planId);

        res.json(await computePlanSuites(planId));
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.get("/api/automation", async (_, res) => {
    try {
        res.json(await getAutomationDashboard());
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.get("/api/defects", async (_, res) => {
    try {
        const [records, storyCount] =
            await Promise.all([
                getDefectData(),
                getStoryCount(),
            ]);

        res.json({
            stats: computeDefectStats(
                records,
                storyCount
            ),
            cacheTimestamp: getDefectCacheTimestamp(),
        });
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.post("/api/refresh", (_, res) => {
    clearDashboardCache();
    clearDefectCache();

    res.status(204).end();
});

app.get(/^(?!\/api).*/, (_, res) => {
    res.sendFile(
        path.join(clientDist, "index.html")
    );
});

app.listen(3000, () => {
    console.log(
        "Running on http://localhost:3000"
    );
});
