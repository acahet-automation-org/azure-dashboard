// Runs the real per-assignee verifica check once, immediately, against live
// Azure DevOps data - for confirming a bug assigned to someone on
// TEAMS_VERIFICA_ASSIGNEE_ALLOWLIST in "Da verificare"/"In verifica" actually
// triggers a notification, without waiting for the next cron tick.
// Sends to the TEST channel so this never posts to the real one.
// Run with: npm run verifica:assignee-check-now
import "dotenv/config";
import { checkAssigneeVerificaNotifications } from "../scheduler.js";

const webhookUrl = process.env.TEAMS_WEBHOOK_URL_TEST_CHANNEL;

if (!webhookUrl) {
    console.error(
        "TEAMS_WEBHOOK_URL_TEST_CHANNEL is not set - add it to .env so this script has somewhere safe to send to."
    );
    process.exit(1);
}

async function main() {
    const project = process.env.TEAMS_VERIFICA_PROJECT || process.env.AZDO_PROJECT;
    const allowlist = process.env.TEAMS_VERIFICA_ASSIGNEE_ALLOWLIST;

    console.log(
        `Checking bugs currently in "Da verificare"/"In verifica" assigned to [${allowlist}] in project "${project}"...`
    );

    const { checked, notified } = await checkAssigneeVerificaNotifications({
        webhookUrl,
    });

    console.log(`Checked ${checked} matching bug(s).`);

    if (checked === 0) {
        console.log(
            `No matching bugs found in project "${project}". Check TEAMS_VERIFICA_ASSIGNEE_ALLOWLIST ` +
                "and that the bug's assignee email matches it exactly, or set TEAMS_VERIFICA_PROJECT " +
                "if the bug lives in a different Azure DevOps project."
        );
        return;
    }

    if (notified.length === 0) {
        console.log(
            "No message sent - every matching bug was already notified for its current " +
                "verifica-pending transition (it hasn't left and re-entered \"Da verificare\"/\"In verifica\" since)."
        );
        return;
    }

    for (const bug of notified) {
        console.log(`Sent: #${bug.id} - ${bug.title} (${bug.state})`);
    }
}

main().catch((error) => {
    console.error("Failed to run per-assignee verifica check", error);
    process.exit(1);
});
