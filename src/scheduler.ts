import cron from "node-cron";
import "dotenv/config";
import { getDefectData } from "./defectData.js";
import {
    sendTeamsMessage,
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
