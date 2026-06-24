import cron from "node-cron";
import "dotenv/config";
import { getDefectData } from "./defectData.js";
import {
    sendTeamsMessage,
    buildBugCreatedCard,
    buildBugsReportedTodayCard,
} from "./teamsNotifier.js";

function isToday(dateString: string, timeZone: string): boolean {
    const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });

    return fmt.format(new Date(dateString)) === fmt.format(new Date());
}

// Tracks bug IDs already seen so a server restart doesn't re-alert on bugs
// that existed before startup, and each bug is only alerted on once. Reset
// on restart - acceptable for a dashboard POC; a real deployment would
// persist this.
let knownBugIds: Set<number> | null = null;

async function pollForNewBugs(): Promise<void> {
    const records = await getDefectData();
    const currentIds = new Set(
        records.map((record) => record.id)
    );

    if (knownBugIds === null) {
        knownBugIds = currentIds;
        return;
    }

    const newBugs = records.filter(
        (record) => !knownBugIds!.has(record.id)
    );

    knownBugIds = currentIds;

    for (const bug of newBugs) {
        await sendTeamsMessage(buildBugCreatedCard(bug));
    }
}

export function startNewBugPoller(): void {
    if (process.env.ENABLE_TEAMS_NOTIFICATIONS !== "true") {
        return;
    }

    const schedule =
        process.env.NEW_BUG_POLL_CRON ?? "*/5 * * * *";

    cron.schedule(schedule, () => {
        pollForNewBugs().catch((error) => {
            console.error(
                "Failed to poll for new bugs",
                error
            );
        });
    });
}

export function startBugSummaryScheduler(): void {
    if (process.env.ENABLE_TEAMS_NOTIFICATIONS !== "true") {
        return;
    }

    const schedule =
        process.env.TEAMS_DAILY_SUMMARY_CRON ?? "45 17 * * 1-5";
    const timezone =
        process.env.TEAMS_SUMMARY_TIMEZONE ?? "Europe/Rome";

    cron.schedule(
        schedule,
        async () => {
            try {
                const records = await getDefectData();
                const bugsToday = records.filter((record) =>
                    isToday(record.createdDate, timezone)
                );

                // No bugs reported today: stay silent rather than send an empty report.
                if (bugsToday.length === 0) {
                    return;
                }

                await sendTeamsMessage(
                    buildBugsReportedTodayCard(bugsToday)
                );
            } catch (error) {
                console.error(
                    "Failed to send daily bug report to Teams",
                    error
                );
            }
        },
        { timezone }
    );
}
