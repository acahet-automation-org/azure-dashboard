// Runs the real "sent to verifica" check once, immediately, against live
// Azure DevOps data - for confirming a bug you just moved to "Da verificare"
// actually triggers a notification, without waiting for the next cron tick.
// Sends to the TEST channel so this never posts to the real one.
// Run with: npm run verifica:check-now
import "dotenv/config";
import { checkVerificaNotifications } from "../scheduler.js";

const webhookUrl = process.env.TEAMS_WEBHOOK_URL_TEST_CHANNEL;

if (!webhookUrl) {
    console.error(
        "TEAMS_WEBHOOK_URL_TEST_CHANNEL is not set - add it to .env so this script has somewhere safe to send to."
    );
    process.exit(1);
}

async function main() {
    const project = process.env.TEAMS_VERIFICA_PROJECT || process.env.AZDO_PROJECT;

    console.log(`Checking bugs currently in "Da verificare" in project "${project}"...`);

    const { checked, notified } = await checkVerificaNotifications({
        webhookUrl,
    });

    console.log(`Checked ${checked} bug(s) in "Da verificare".`);

    if (checked === 0) {
        console.log(
            `No bugs found in project "${project}". If your bug lives in a different ` +
                "Azure DevOps project, set TEAMS_VERIFICA_PROJECT in .env to that project's name."
        );
        return;
    }

    if (notified.length === 0) {
        console.log(
            "No message sent. Check that the bug's state is exactly \"Da verificare\" " +
                "(not \"In verifica\" or similar) and that it's assigned to someone whose " +
                "email matches TEAMS_VERIFICA_ALLOWED_SENDERS."
        );
        return;
    }

    for (const bug of notified) {
        console.log(`Sent: #${bug.id} - ${bug.title}`);
    }
}

main().catch((error) => {
    console.error("Failed to run verifica check", error);
    process.exit(1);
});
