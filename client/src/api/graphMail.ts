import { acquireMailToken } from "../mailGraphAuth";

const REPORT_RECIPIENTS: string[] = String(import.meta.env.VITE_SEND_MAIL_TO ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

// Sends the sprint report card via Microsoft Graph, using the signed-in
// user's own mailbox (delegated Mail.Send - see mailAuthConfig.ts). Replaces
// the old backend /api/email-report path for this button, which relied on
// SMTP that's blocked outbound on this network.
export async function sendGraphMailReport({
    subject,
    bodyHtml,
}: {
    subject: string;
    bodyHtml: string;
}): Promise<void> {
    if (REPORT_RECIPIENTS.length === 0) {
        throw new Error("VITE_SEND_MAIL_TO is not configured.");
    }

    const loginResponse = await acquireMailToken();

    const response = await fetch(
        "https://graph.microsoft.com/v1.0/me/sendMail",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${loginResponse.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: {
                    subject,
                    body: { contentType: "HTML", content: bodyHtml },
                    toRecipients: REPORT_RECIPIENTS.map((address) => ({
                        emailAddress: { address },
                    })),
                },
            }),
        }
    );

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body}`);
    }
}
