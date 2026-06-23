import "dotenv/config";
import express from "express";
import cors from "cors";
import { requireAuth } from "./auth.js";
import { getAzdoClientForRequest } from "./azdoClient.js";
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
import {
    getAutomationDashboard,
    clearAutomationCache,
} from "./automationData.js";
import {
    getDefectData,
    getDefectCacheTimestamp,
    computeDefectStats,
    clearDefectCache,
    getStoryCount,
} from "./defectData.js";
import {
    getCommonErrorsData,
    getCommonErrorsCacheTimestamp,
    clearCommonErrorsCache,
} from "./errorAggregationData.js";
import { getMyWorkItems } from "./myWorkItemsData.js";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));

app.use("/api", requireAuth);

app.get("/api/suites", async (req, res) => {
    try {
        const azdo = await getAzdoClientForRequest(req);
        const allTestCases =
            await getDashboardData(azdo);

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

app.get("/api/dashboard", async (req, res) => {
    try {
        const azdo = await getAzdoClientForRequest(req);
        const allTestCases =
            await getDashboardData(azdo);

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

app.get("/api/runs", async (req, res) => {
    try {
        const azdo = await getAzdoClientForRequest(req);

        res.json(await computeRunCards(azdo));
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.get("/api/execution-trend", async (req, res) => {
    try {
        const azdo = await getAzdoClientForRequest(req);

        const [trend, allTestCases] =
            await Promise.all([
                computeExecutionTrend(azdo),
                getDashboardData(azdo),
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

app.get("/api/plans", async (req, res) => {
    try {
        const azdo = await getAzdoClientForRequest(req);

        res.json(await computeTestPlans(azdo));
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.get("/api/plans/:planId/suites", async (req, res) => {
    try {
        const azdo = await getAzdoClientForRequest(req);
        const planId = Number(req.params.planId);

        res.json(await computePlanSuites(azdo, planId));
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.get("/api/automation", async (req, res) => {
    try {
        const azdo = await getAzdoClientForRequest(req);
        const planId = Number(req.query.planId);

        res.json(
            await getAutomationDashboard(
                azdo,
                Number.isFinite(planId)
                    ? planId
                    : undefined
            )
        );
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.get("/api/defects", async (req, res) => {
    try {
        const azdo = await getAzdoClientForRequest(req);
        const [records, storyCount] =
            await Promise.all([
                getDefectData(azdo),
                getStoryCount(azdo),
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

app.get("/api/common-errors", async (req, res) => {
    try {
        const azdo = await getAzdoClientForRequest(req);
        const { errors, totalFailedResults } =
            await getCommonErrorsData(azdo);

        res.json({
            errors,
            totalFailedResults,
            cacheTimestamp:
                getCommonErrorsCacheTimestamp(),
        });
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});
app.get("/api/my-work-items", async (req, res) => {
    try {
        const azdo = await getAzdoClientForRequest(req);
        const type = req.query.type === "Bug" ? "Bug" : "Task";

        res.json(await getMyWorkItems(azdo, type));
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
    clearCommonErrorsCache();
    clearAutomationCache();

    res.status(204).end();
});


const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
    console.log(
        `Running on http://localhost:${port}`
    );
});
