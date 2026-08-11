import axios from "axios";
import "dotenv/config";
import type { DefectRecord } from "./types.js";

export async function sendTeamsMessage(
    card: Record<string, unknown>,
    options: { webhookUrl?: string } = {}
): Promise<void> {
    const webhookUrl = options.webhookUrl ?? process.env.TEAMS_WEBHOOK_URL;

    if (!webhookUrl) {
        return;
    }

    // An explicitly passed webhook (the test-send script points this at
    // TEAMS_WEBHOOK_URL_TEST_CHANNEL) always fires - ENABLE_TEAMS_NOTIFICATIONS
    // only gates the real, scheduled sends against the default webhook.
    if (!options.webhookUrl && process.env.ENABLE_TEAMS_NOTIFICATIONS !== "true") {
        return;
    }

    await axios.post(webhookUrl, card);
}

// MessageCard "sections"/"facts" fields render as a flat text stream in some
// Teams flows (e.g. Power Automate webhook triggers), losing their visual
// grouping. The card below instead renders each bug as a markdown text
// block, which is the format that's known to render reliably.
function formatBugBlock(
    bug: DefectRecord,
    options: { includeArea?: boolean } = {}
): string {
    const severity = bug.severity ?? "Unspecified";
    const priority =
        bug.priority != null
            ? String(bug.priority)
            : "Unspecified";

    const facts = [
        `Severity: ${severity}`,
        `Priority: ${priority}`,
    ];

    if (options.includeArea) {
        facts.push(`Area: ${bug.areaPath}`);
    }

    const link = bug.url
        ? `[Open in Azure DevOps](${bug.url})`
        : "";

    return [
        `**#${bug.id} - ${bug.title}**`,
        facts.join(" · "),
        link,
    ]
        .filter(Boolean)
        .join("  \n");
}

// Entries are matched either as a bare domain ("finconsgroup.com", matched
// against the part after "@") or a full address ("name@finconsgroup.com",
// matched exactly) - lets the allowlist mix "anyone at this domain" with
// one-off external addresses without two separate env vars.
export function parseAllowedSenders(raw?: string): string[] {
    return (raw ?? "")
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
}

export function isAllowedSender(
    email: string | undefined,
    allowedSenders: string[]
): boolean {
    if (!email) {
        return false;
    }

    const normalized = email.toLowerCase();
    const domain = normalized.split("@")[1];

    return allowedSenders.some((entry) =>
        entry.includes("@") ? entry === normalized : entry === domain
    );
}

// One card per check (not one per bug) so a poll that catches several bugs
// at once doesn't spam the channel with separate messages - deliberately
// just title + assignee + link per bug, no severity/priority facts, unlike
// buildBugsReportedTodayCard's daily digest.
export function buildBugsReadyToBeVerifiedCard(bugs: DefectRecord[]) {
    const title = "Bug pronti per essere verificati";

    const bugLines = bugs.map((bug) =>
        [
            `**#${bug.id} - ${bug.title}**`,
            `Assegnato a: ${bug.assignedTo?.displayName ?? "Non assegnato"}`,
            bug.url ? `[Apri in Azure DevOps](${bug.url})` : "",
        ]
            .filter(Boolean)
            .join("  \n")
    );

    return {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        themeColor: "0078D4",
        summary: title,
        title,
        text: bugLines.join("\n\n---\n\n"),
    };
}

export function buildBugsReportedTodayCard(
    bugs: DefectRecord[]
) {
    const recipient =
        process.env.TEAMS_GREETING_NAME ?? "team";
    const greeting = `Hey ${recipient}, ${bugs.length} bug(s) were created today`;

    const bugBlocks = bugs.map((bug) =>
        formatBugBlock(bug, { includeArea: true })
    );

    const text = [
        greeting,
        "",
        bugBlocks.join("\n\n---\n\n"),
    ].join("\n");

    return {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        themeColor: "0078D4",
        summary: greeting,
        title: greeting,
        text,
    };
}
