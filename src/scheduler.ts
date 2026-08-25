import cron from "node-cron";
import "dotenv/config";
import {
    getDefectData,
    computeSprintDefectReport,
    VERIFICA_STATE,
    VERIFICA_PENDING_STATES,
} from "./defectData.js";
import {
    sendTeamsMessage,
    buildBugsReportedTodayCard,
    buildBugsReadyToBeVerifiedCard,
    buildBugsPendingVerificationCard,
    parseAllowedSenders,
    isAllowedSender,
} from "./teamsNotifier.js";
import { writeSprintDefectReportFile } from "./sprintReportFileExport.js";
import type { DefectRecord } from "./types.js";

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

// Bug ID -> the verificaTransition.changedDate we last notified for. Keyed
// by date (not just a notified-once flag) so a bug that leaves "Da
// verificare" and later gets sent back in gets a fresh notification instead
// of being permanently silenced - entries for bugs no longer in that state
// are dropped every check so the map stays bounded to the current backlog.
const notifiedVerificaTransitions = new Map<number, string>();

// Pulled out of the cron tick so a one-off script (see
// scripts/runVerificaCheckNow.ts) can trigger the exact same check on demand
// against real Azure DevOps data - e.g. right after moving a bug to "Da
// verificare" for testing, instead of waiting for the next scheduled tick.
// An explicit webhookUrl (the test-send scripts point this at
// TEAMS_WEBHOOK_URL_TEST_CHANNEL) bypasses ENABLE_TEAMS_NOTIFICATIONS, same
// as sendTeamsMessage itself.
export async function checkVerificaNotifications(
    options: { webhookUrl?: string } = {}
): Promise<{ checked: number; notified: DefectRecord[] }> {
    const allowedSenders = parseAllowedSenders(
        process.env.TEAMS_VERIFICA_ALLOWED_SENDERS ?? "finconsgroup.com"
    );
    // Bugs sent to verifica can live in a different Azure DevOps project
    // than AZDO_PROJECT (the app's general-purpose default, used by pages
    // that don't pass one explicitly) - falls back to it when unset so
    // existing single-project setups don't need a new env var.
    const project = process.env.TEAMS_VERIFICA_PROJECT || undefined;

    const records = await getDefectData(project);
    const inVerifica = records.filter(
        (record) => record.state === VERIFICA_STATE
    );

    const currentIds = new Set(inVerifica.map((r) => r.id));

    for (const id of notifiedVerificaTransitions.keys()) {
        if (!currentIds.has(id)) {
            notifiedVerificaTransitions.delete(id);
        }
    }

    const toNotify: DefectRecord[] = [];

    for (const bug of inVerifica) {
        const transition = bug.verificaTransition;

        if (!transition) {
            continue;
        }

        if (notifiedVerificaTransitions.get(bug.id) === transition.changedDate) {
            continue;
        }

        if (
            !bug.assignedTo ||
            !isAllowedSender(bug.assignedTo.uniqueName, allowedSenders)
        ) {
            continue;
        }

        toNotify.push(bug);
    }

    // One card listing everything this check caught, rather than one
    // message per bug - see buildBugsReadyToBeVerifiedCard. Posted to its
    // own webhook (TEAMS_WEBHOOK_URL_TEST_FACTORY) rather than the default
    // TEAMS_WEBHOOK_URL used by the other Teams cards, so it lands in a
    // different channel - callers (the test-send scripts) can still force a
    // different destination via options.webhookUrl.
    if (toNotify.length > 0) {
        await sendTeamsMessage(buildBugsReadyToBeVerifiedCard(toNotify), {
            webhookUrl:
                options.webhookUrl ?? process.env.TEAMS_WEBHOOK_URL_TEST_FACTORY,
        });

        for (const bug of toNotify) {
            notifiedVerificaTransitions.set(bug.id, bug.verificaTransition!.changedDate);
        }
    }

    return { checked: inVerifica.length, notified: toNotify };
}

export function startVerificaNotificationScheduler(): void {
    if (
        process.env.ENABLE_TEAMS_NOTIFICATIONS !== "true" ||
        process.env.ENABLE_TEAMS_VERIFICA_NOTIFICATIONS !== "true"
    ) {
        return;
    }

    const schedule = process.env.TEAMS_VERIFICA_CRON ?? "*/10 * * * *";
    const timezone = process.env.TEAMS_VERIFICA_TIMEZONE ?? "Europe/Rome";

    cron.schedule(
        schedule,
        async () => {
            try {
                await checkVerificaNotifications();
            } catch (error) {
                console.error(
                    "Failed to send 'sent to verifica' notification to Teams",
                    error
                );
            }
        },
        { timezone }
    );
}

// Bug ID -> the verificaPendingTransition.changedDate we last notified for -
// same dedup shape as notifiedVerificaTransitions above, kept separate since
// this tracks a different (broader) state set and a different recipient
// list.
const notifiedAssigneeVerificaTransitions = new Map<number, string>();

// Narrower than checkVerificaNotifications: fires for a small, explicit list
// of assignees (TEAMS_VERIFICA_ASSIGNEE_ALLOWLIST) rather than the whole
// team, and covers both "Da verificare" and "In verifica" rather than just
// the moment a bug lands in the queue - e.g. so someone who owns their own
// QA re-testing gets pinged for bugs they're actively verifying too, not
// just newly-arrived ones. Pulled out of the cron tick for the same reason
// as checkVerificaNotifications (on-demand scripts, explicit webhookUrl for
// test sends).
export async function checkAssigneeVerificaNotifications(
    options: { webhookUrl?: string } = {}
): Promise<{ checked: number; notified: DefectRecord[] }> {
    const allowedAssignees = parseAllowedSenders(
        process.env.TEAMS_VERIFICA_ASSIGNEE_ALLOWLIST ?? ""
    );

    if (allowedAssignees.length === 0) {
        return { checked: 0, notified: [] };
    }

    const project = process.env.TEAMS_VERIFICA_PROJECT || undefined;
    const records = await getDefectData(project);
    const pending = records.filter(
        (record) =>
            VERIFICA_PENDING_STATES.includes(record.state) &&
            isAllowedSender(record.assignedTo?.uniqueName, allowedAssignees)
    );

    const currentIds = new Set(pending.map((r) => r.id));

    for (const id of notifiedAssigneeVerificaTransitions.keys()) {
        if (!currentIds.has(id)) {
            notifiedAssigneeVerificaTransitions.delete(id);
        }
    }

    const toNotify: DefectRecord[] = [];

    for (const bug of pending) {
        const transition = bug.verificaPendingTransition;

        if (!transition) {
            continue;
        }

        if (
            notifiedAssigneeVerificaTransitions.get(bug.id) ===
            transition.changedDate
        ) {
            continue;
        }

        toNotify.push(bug);
    }

    if (toNotify.length > 0) {
        await sendTeamsMessage(buildBugsPendingVerificationCard(toNotify), {
            webhookUrl:
                options.webhookUrl ??
                process.env.TEAMS_WEBHOOK_URL_ASSIGNEE_VERIFICA,
        });

        for (const bug of toNotify) {
            notifiedAssigneeVerificaTransitions.set(
                bug.id,
                bug.verificaPendingTransition!.changedDate
            );
        }
    }

    return { checked: pending.length, notified: toNotify };
}

export function startAssigneeVerificaNotificationScheduler(): void {
    if (
        process.env.ENABLE_TEAMS_NOTIFICATIONS !== "true" ||
        process.env.ENABLE_TEAMS_ASSIGNEE_VERIFICA_NOTIFICATIONS !== "true"
    ) {
        return;
    }

    // Own cron var (not TEAMS_VERIFICA_CRON, shared by the team-wide "sent to
    // verifica" check above) - decoupled so changing this notifier's cadence
    // doesn't also change the other one's. Defaults to hourly, deliberately
    // slower than the other check's every-10-minutes default: this one pings
    // a small explicit list of people rather than a whole-team channel.
    const schedule = process.env.TEAMS_VERIFICA_ASSIGNEE_CRON ?? "0 * * * *";
    const timezone = process.env.TEAMS_VERIFICA_TIMEZONE ?? "Europe/Rome";

    cron.schedule(
        schedule,
        async () => {
            try {
                await checkAssigneeVerificaNotifications();
            } catch (error) {
                console.error(
                    "Failed to send per-assignee verifica notification to Teams",
                    error
                );
            }
        },
        { timezone }
    );
}

export function startSprintReportFileExportScheduler(): void {
    const destinationFolder = process.env.SPRINT_REPORT_EXPORT_PATH;

    if (
        process.env.ENABLE_SPRINT_REPORT_EXPORT !== "true" ||
        !destinationFolder
    ) {
        return;
    }

    const schedule =
        process.env.SPRINT_REPORT_EXPORT_CRON ?? "0 18 * * *";
    const timezone =
        process.env.SPRINT_REPORT_EXPORT_TIMEZONE ?? "Europe/Rome";

    cron.schedule(
        schedule,
        async () => {
            try {
                const records = await getDefectData();
                const report = computeSprintDefectReport(records);
                const filePath = writeSprintDefectReportFile(
                    report,
                    destinationFolder
                );

                console.log(`Sprint Defect Report written to ${filePath}`);
            } catch (error) {
                console.error(
                    "Failed to write daily Sprint Defect Report file",
                    error
                );
            }
        },
        { timezone }
    );
}
