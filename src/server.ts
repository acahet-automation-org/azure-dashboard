import "dotenv/config";
import express from "express";
import cors from "cors";
import { requireAuth } from "./auth.js";
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
    deleteTestCases,
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
    getStoryPointsByArea,
    filterRecords,
    getAvailableProjects,
    resolveProject,
} from "./defectData.js";
import {
    getCommonErrorsData,
    getCommonErrorsCacheTimestamp,
    clearCommonErrorsCache,
} from "./errorAggregationData.js";
import {
    getAssignedWorkItems,
    getMentionedWorkItems,
    getFollowedWorkItems,
} from "./myWorkItemsData.js";
import { sendReportEmail } from "./mailer.js";
import {
    computePlanOverview,
    clearPlanOverviewCache,
} from "./planOverviewData.js";
import {
    computeTestPlanProgress,
    clearTestPlanProgressCache,
    computeTestPlanProgressBugs,
    clearTestPlanProgressBugsCache,
} from "./testPlanProgressData.js";
import {
    startBugSummaryScheduler,
    startNewBugPoller,
} from "./scheduler.js";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "15mb" }));

app.use("/api", requireAuth);

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

app.get("/api/plans/:planId/overview", async (req, res) => {
    try {
        const planId = Number(req.params.planId);

        res.json(await computePlanOverview(planId));
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.get("/api/plans/:planId/progress", async (req, res) => {
    try {
        const planId = Number(req.params.planId);

        res.json(await computeTestPlanProgress(planId));
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.get("/api/plans/:planId/progress/bugs", async (req, res) => {
    try {
        const planId = Number(req.params.planId);
        const suiteIdsParam = req.query.suiteIds as string | undefined;
        const suiteIds = suiteIdsParam
            ? suiteIdsParam
                  .split(",")
                  .map(Number)
                  .filter(Number.isFinite)
            : undefined;

        res.json(await computeTestPlanProgressBugs(planId, suiteIds));
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.post("/api/test-cases/delete", async (req, res) => {
    const items = Array.isArray(req.body?.items)
        ? req.body.items
              .map((item: any) => ({
                  planId: Number(item?.planId),
                  suiteId: Number(item?.suiteId),
                  testCaseId: Number(item?.testCaseId),
              }))
              .filter(
                  (item: {
                      planId: number;
                      suiteId: number;
                      testCaseId: number;
                  }) =>
                      Number.isInteger(item.planId) &&
                      Number.isInteger(item.suiteId) &&
                      Number.isInteger(item.testCaseId)
              )
        : [];

    if (items.length === 0) {
        res.status(400).json({
            message: "items is required",
        });

        return;
    }

    try {
        const result = await deleteTestCases(items);

        if (result.deleted.length > 0) {
            clearAutomationCache();
            clearPlanOverviewCache();
            clearTestPlanProgressCache();
            clearTestPlanProgressBugsCache();
        }

        res.json(result);
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.get("/api/automation", async (req, res) => {
    try {
        const planId = Number(req.query.planId);

        res.json(
            await getAutomationDashboard(
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
        const project = resolveProject(
            req.query.project as string | undefined
        );

        const [records, storyCount, storyPointsByArea] =
            await Promise.all([
                getDefectData(project),
                getStoryCount(project),
                getStoryPointsByArea(project),
            ]);

        const filtered = filterRecords(records, {
            iteration: req.query.iteration as
                | string
                | undefined,
            area: req.query.area as string | undefined,
            environment: req.query.environment as
                | string
                | undefined,
            targetVersion: req.query.targetVersion as
                | string
                | undefined,
        });

        res.json({
            stats: computeDefectStats(
                filtered,
                storyCount,
                storyPointsByArea,
                records
            ),
            cacheTimestamp: getDefectCacheTimestamp(project),
            availableProjects: getAvailableProjects(),
            project,
        });
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.get("/api/common-errors", async (_, res) => {
    try {
        const { errors, totalFailedResults } =
            await getCommonErrorsData();

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
        const mode = req.query.mode;

        const items =
            mode === "mentioned"
                ? await getMentionedWorkItems()
                : mode === "following"
                    ? await getFollowedWorkItems()
                    : await getAssignedWorkItems();

        res.json(items);
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.post("/api/email-report", async (req, res) => {
    const toEmails = (process.env.SEND_MAIL_TO ?? "")
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean);

    if (process.env.ENABLE_EMAIL_REPORT !== "true" || toEmails.length === 0) {
        res.status(403).json({
            message: "Email report is disabled.",
        });

        return;
    }

    const { subject, bodyHtml, pdfBase64, filename, fromName } =
        req.body as {
            subject?: string;
            bodyHtml?: string;
            pdfBase64?: string;
            filename?: string;
            fromName?: string;
        };

    if (!subject || !pdfBase64 || !filename) {
        res.status(400).json({
            message: "subject, pdfBase64 and filename are required.",
        });

        return;
    }

    try {
        await sendReportEmail({
            to: toEmails,
            subject,
            bodyHtml: bodyHtml ?? "",
            pdfBase64,
            filename,
            fromName: fromName ?? "QA Dashboard",
        });

        res.status(204).end();
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
    clearPlanOverviewCache();
    clearTestPlanProgressCache();
    clearTestPlanProgressBugsCache();

    res.status(204).end();
});


startNewBugPoller();
startBugSummaryScheduler();

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
    console.log(
        `Running on http://localhost:${port}`
    );
});
