import axios from "axios";
import "dotenv/config";
import type { DefectRecord } from "./types.js";

export async function sendTeamsMessage(
    card: Record<string, unknown>
): Promise<void> {
    const webhookUrl = process.env.TEAMS_WEBHOOK_URL;

    if (
        process.env.ENABLE_TEAMS_NOTIFICATIONS !== "true" ||
        !webhookUrl
    ) {
        return;
    }

    await axios.post(webhookUrl, card);
}

export function buildBugCreatedCard(bug: DefectRecord) {
    const facts = [
        { name: "Severity", value: bug.severity },
        {
            name: "Priority",
            value:
                bug.priority != null
                    ? String(bug.priority)
                    : undefined,
        },
        { name: "Area", value: bug.areaPath },
    ].filter(
        (fact): fact is { name: string; value: string } =>
            fact.value != null
    );

    return {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        themeColor: "D13438",
        summary: `New bug #${bug.id}: ${bug.title}`,
        title: `New bug #${bug.id}`,
        text: bug.title,
        sections: [{ facts }],
        potentialAction: bug.url
            ? [
                  {
                      "@type": "OpenUri",
                      name: "Open in Azure DevOps",
                      targets: [
                          { os: "default", uri: bug.url },
                      ],
                  },
              ]
            : [],
    };
}

export function buildBugsReportedTodayCard(
    bugs: DefectRecord[]
) {
    const recipient =
        process.env.TEAMS_GREETING_NAME ?? "team";
    const greeting = `Hey ${recipient}, ${bugs.length} bug(s) were created today`;

    const bugBlocks = bugs.map((bug) => {
        const severity = bug.severity ?? "Unspecified";
        const priority =
            bug.priority != null
                ? String(bug.priority)
                : "Unspecified";
        const link = bug.url
            ? `[Open in Azure DevOps](${bug.url})`
            : "";

        return [
            `**#${bug.id} - ${bug.title}**`,
            `Severity: ${severity} · Priority: ${priority}`,
            link,
        ]
            .filter(Boolean)
            .join("  \n");
    });

    // One section separator ("---") between bug blocks, since the
    // structured MessageCard "sections"/"facts" fields render as one flat
    // text stream in some Teams flows (e.g. Power Automate webhook
    // triggers), losing the visual grouping between bugs.
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
