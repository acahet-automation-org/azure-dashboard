import express from "express";
import {
    getDashboardData,
    clearDashboardCache,
    getCacheTimestamp,
    computeDashboardStats,
    computeSuiteStats,
    computeRunCards,
} from "./dashboardData.js";
import { renderDashboardPage } from "./views/dashboardView.js";
import { renderSuitesPage } from "./views/suitesView.js";
import { renderRunsPage } from "./views/runsView.js";

const app = express();

app.use(express.static("public"));

app.get("/", async (_, res) => {
    try {
        const allTestCases =
            await getDashboardData();

        const suiteStats =
            computeSuiteStats(allTestCases);

        res.send(
            renderSuitesPage(suiteStats)
        );
    } catch (error: any) {
        console.error(error);

        res.status(500).send(
            error.message
        );
    }
});

app.get("/dashboard", async (_, res) => {
    try {
        const allTestCases =
            await getDashboardData();

        const stats =
            computeDashboardStats(
                allTestCases
            );

        res.send(
            renderDashboardPage(
                stats,
                getCacheTimestamp()
            )
        );
    } catch (error: any) {
        console.error(error);

        res.status(500).send(
            error.message
        );
    }
});

app.get(
    "/last-5-runs",
    async (_, res) => {
        try {
            const runCards =
                await computeRunCards();

            res.send(
                renderRunsPage(runCards)
            );
        } catch (error: any) {
            console.error(error);

            res.status(500).send(
                error.message
            );
        }
    }
);

app.get("/refresh", (_, res) => {
    clearDashboardCache();

    res.redirect("/dashboard");
});

app.listen(3000, () => {
    console.log(
        "Running on http://localhost:3000"
    );
});
