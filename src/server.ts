import "dotenv/config";
import express, { type Response } from "express";
import cors from "cors";
import { AzdoAuthError, getIterations, getAreaPaths, getProjects } from "./azdo.js";
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
    getAllSuiteNames,
    filterRecords,
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
    getCreatedWorkItems,
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
    computeReleaseReadiness,
    clearReleaseReadinessCache,
    countOpenBySeverity,
} from "./releaseReadinessData.js";
import {
    startBugSummaryScheduler,
    startVerificaNotificationScheduler,
    startSprintReportFileExportScheduler,
} from "./scheduler.js";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "15mb" }));

// AzdoAuthError means Azure DevOps rejected our AZDO_PAT (usually expired or
// revoked) - surface it as 502 Bad Gateway so the client can tell it apart
// from an ordinary server-side bug and show a specific, actionable message.
function sendApiError(res: Response, error: any): void {
    console.error(error);

    if (error instanceof AzdoAuthError) {
        res.status(502).json({ message: error.message });
        return;
    }

    res.status(500).json({ message: error.message });
}

app.get("/api/suites", async (req, res) => {
    try {
        const project = req.query.project as string | undefined;
        const allTestCases =
            await getDashboardData(project);

        res.json(
            computeSuiteStats(allTestCases)
        );
    } catch (error: any) {
        sendApiError(res, error);
    }
});

app.get("/api/dashboard", async (req, res) => {
    try {
        const project = req.query.project as string | undefined;
        const allTestCases =
            await getDashboardData(project);

        const iteration = req.query.iteration as
            | string
            | undefined;

        const scoped = iteration
            ? allTestCases.filter(
                  (tc) => tc.iteration === iteration
              )
            : allTestCases;

        res.json({
            stats: computeDashboardStats(
                scoped
            ),
            cacheTimestamp: getCacheTimestamp(project),
        });
    } catch (error: any) {
        sendApiError(res, error);
    }
});

app.get("/api/runs", async (req, res) => {
    try {
        res.json(
            await computeRunCards(
                req.query.project as string | undefined
            )
        );
    } catch (error: any) {
        sendApiError(res, error);
    }
});

app.get("/api/execution-trend", async (req, res) => {
    try {
        const project = req.query.project as string | undefined;

        const [trend, allTestCases] =
            await Promise.all([
                computeExecutionTrend(project),
                getDashboardData(project),
            ]);

        res.json({
            trend,
            totalTestCases: allTestCases.length,
        });
    } catch (error: any) {
        sendApiError(res, error);
    }
});

app.get("/api/projects", async (_, res) => {
    try {
        res.json(await getProjects());
    } catch (error: any) {
        sendApiError(res, error);
    }
});

app.get("/api/areas", async (req, res) => {
    try {
        res.json(
            await getAreaPaths(req.query.project as string | undefined)
        );
    } catch (error: any) {
        sendApiError(res, error);
    }
});

app.get("/api/iterations", async (req, res) => {
    try {
        res.json(
            await getIterations(req.query.project as string | undefined)
        );
    } catch (error: any) {
        sendApiError(res, error);
    }
});

app.get("/api/plans", async (req, res) => {
    try {
        const plans = await computeTestPlans(
            req.query.project as string | undefined
        );

        const areaPath = req.query.areaPath as string | undefined;
        const iteration = req.query.iteration as string | undefined;

        const scoped = plans.filter(
            (plan) =>
                (!areaPath || plan.areaPath === areaPath) &&
                (!iteration || plan.iteration === iteration)
        );

        res.json(scoped);
    } catch (error: any) {
        sendApiError(res, error);
    }
});

app.get("/api/plans/:planId/suites", async (req, res) => {
    try {
        const planId = Number(req.params.planId);

        res.json(
            await computePlanSuites(
                planId,
                req.query.project as string | undefined
            )
        );
    } catch (error: any) {
        sendApiError(res, error);
    }
});

app.get("/api/plans/:planId/overview", async (req, res) => {
    try {
        const planId = Number(req.params.planId);

        res.json(
            await computePlanOverview(
                planId,
                req.query.project as string | undefined
            )
        );
    } catch (error: any) {
        sendApiError(res, error);
    }
});

app.get("/api/plans/:planId/progress", async (req, res) => {
    try {
        const planId = Number(req.params.planId);

        res.json(
            await computeTestPlanProgress(
                planId,
                req.query.project as string | undefined
            )
        );
    } catch (error: any) {
        sendApiError(res, error);
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

        res.json(
            await computeTestPlanProgressBugs(
                planId,
                suiteIds,
                req.query.project as string | undefined
            )
        );
    } catch (error: any) {
        sendApiError(res, error);
    }
});

app.get("/api/release-readiness", async (req, res) => {
    if (process.env.ENABLE_RELEASE_READINESS !== "true") {
        res.status(403).json({
            message: "Release readiness is disabled.",
        });

        return;
    }

    try {
        res.json(
            await computeReleaseReadiness(
                req.query.iteration as string | undefined,
                req.query.project as string | undefined
            )
        );
    } catch (error: any) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
});

app.get("/api/nav-badges", async (req, res) => {
    try {
        const project = req.query.project as string | undefined;
        const records = await getDefectData(project);
        const counts = countOpenBySeverity(records);

        res.json({
            openCriticalHighDefects:
                counts["1 - Critical"] + counts["2 - High"],
        });
    } catch (error: any) {
        sendApiError(res, error);
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
        const project = req.body?.project as string | undefined;
        const result = await deleteTestCases(items, project);

        if (result.deleted.length > 0) {
            clearAutomationCache();
            clearPlanOverviewCache();
            clearTestPlanProgressCache();
            clearTestPlanProgressBugsCache();
        }

        res.json(result);
    } catch (error: any) {
        sendApiError(res, error);
    }
});

app.get("/api/automation", async (req, res) => {
    try {
        const planId = Number(req.query.planId);
        const iteration = req.query.iteration as
            | string
            | undefined;

        res.json(
            await getAutomationDashboard(
                Number.isFinite(planId)
                    ? planId
                    : undefined,
                iteration,
                req.query.project as string | undefined
            )
        );
    } catch (error: any) {
        sendApiError(res, error);
    }
});

app.get("/api/defects", async (req, res) => {
    try {
        const project = req.query.project as string | undefined;

        const [records, storyCount, storyPointsByArea, allSuiteNames] =
            await Promise.all([
                getDefectData(project),
                getStoryCount(project),
                getStoryPointsByArea(project),
                getAllSuiteNames(project),
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
            suites: (Array.isArray(req.query.suite)
                ? (req.query.suite as string[])
                : req.query.suite
                ? [req.query.suite as string]
                : []
            ),
        });

        res.json({
            stats: computeDefectStats(
                filtered,
                storyCount,
                storyPointsByArea,
                records,
                allSuiteNames
            ),
            cacheTimestamp: getDefectCacheTimestamp(project),
        });
    } catch (error: any) {
        sendApiError(res, error);
    }
});

app.get("/api/common-errors", async (req, res) => {
    try {
        const project = req.query.project as string | undefined;
        const { errors, totalFailedResults } =
            await getCommonErrorsData(project);

        res.json({
            errors,
            totalFailedResults,
            cacheTimestamp:
                getCommonErrorsCacheTimestamp(project),
        });
    } catch (error: any) {
        sendApiError(res, error);
    }
});
app.get("/api/my-work-items", async (req, res) => {
    try {
        const mode = req.query.mode;
        const project = req.query.project as string | undefined;

        const items =
            mode === "mentioned"
                ? await getMentionedWorkItems(project)
                : mode === "following"
                    ? await getFollowedWorkItems(project)
                    : mode === "created"
                        ? await getCreatedWorkItems(project)
                        : await getAssignedWorkItems(project);

        res.json(items);
    } catch (error: any) {
        sendApiError(res, error);
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

    if (!subject) {
        res.status(400).json({
            message: "subject is required.",
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
        sendApiError(res, error);
    }
});

// Every data module already self-caches for 5 minutes (see e.g.
// dashboardData.ts's CACHE_DURATION_MS), so an organic page load never
// re-hits Azure DevOps more than once per 5 minutes. This handler is the one
// place that can bypass all of those at once (the "Refresh Now" button), and
// it's shared by every user hitting this server - without its own throttle,
// several people clicking it within the same few minutes would each trigger
// a full re-fetch of every dashboard from Azure DevOps. Tracked as a single
// timestamp here (not derived from the per-module cache timestamps) because
// it's guarding the *manual* clear-everything action specifically, separate
// from each module's own organic cache lifetime.
let lastManualRefreshAt = 0;
const MANUAL_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

app.post("/api/refresh", (_, res) => {
    const now = Date.now();
    const elapsed = now - lastManualRefreshAt;

    if (elapsed < MANUAL_REFRESH_COOLDOWN_MS) {
        res.status(200).json({
            refreshed: false,
            retryAfterMs: MANUAL_REFRESH_COOLDOWN_MS - elapsed,
        });

        return;
    }

    lastManualRefreshAt = now;

    clearDashboardCache();
    clearDefectCache();
    clearCommonErrorsCache();
    clearAutomationCache();
    clearPlanOverviewCache();
    clearTestPlanProgressCache();
    clearTestPlanProgressBugsCache();
    clearReleaseReadinessCache();

    res.status(200).json({ refreshed: true });
});


startBugSummaryScheduler();
startVerificaNotificationScheduler();
startSprintReportFileExportScheduler();

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
    console.log(
        `Running on http://localhost:${port}`
    );
});
