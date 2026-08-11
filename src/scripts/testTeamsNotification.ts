// Sends both Teams card types to a separate test channel, so the cards can
// be eyeballed in Teams without touching the real channel or waiting for a
// cron tick. Run with: npm run test:teams
import "dotenv/config";
import {
    sendTeamsMessage,
    buildBugsReadyToBeVerifiedCard,
    buildBugsReportedTodayCard,
} from "../teamsNotifier.js";
import type { DefectRecord } from "../types.js";

const webhookUrl = process.env.TEAMS_WEBHOOK_URL_TEST_CHANNEL;

if (!webhookUrl) {
    console.error(
        "TEAMS_WEBHOOK_URL_TEST_CHANNEL is not set - add it to .env before running this script."
    );
    process.exit(1);
}

const sampleAssignee = {
    displayName: "Mario Rossi",
    uniqueName: "mario.rossi@finconsgroup.com",
};

const sampleBug: DefectRecord = {
    id: 99999,
    title: "[TEST] Bug di esempio per verificare le notifiche Teams",
    state: "Da verificare",
    severity: "2 - High",
    priority: 2,
    areaPath: "Nuova Frontiera\\Front Office Auto",
    createdDate: new Date().toISOString(),
    changedDate: new Date().toISOString(),
    reopenedCount: 0,
    hasLinkedTestCase: false,
    tags: [],
    url: "https://dev.azure.com/example-org/example-project/_workitems/edit/99999",
    creator: sampleAssignee.displayName,
    assignedTo: sampleAssignee,
};

async function main() {
    console.log("Sending test cards to TEAMS_WEBHOOK_URL_TEST_CHANNEL...");

    await sendTeamsMessage(
        buildBugsReadyToBeVerifiedCard([sampleBug]),
        { webhookUrl }
    );

    await sendTeamsMessage(buildBugsReportedTodayCard([sampleBug]), {
        webhookUrl,
    });

    console.log("Done - check the test channel in Teams.");
}

main().catch((error) => {
    console.error("Failed to send test notification", error);
    process.exit(1);
});
