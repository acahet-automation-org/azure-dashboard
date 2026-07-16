import nodemailer from "nodemailer";
import "dotenv/config";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.MAILTRAP_HOST,
            port: Number(process.env.MAILTRAP_PORT) || 2525,
            auth: {
                user: process.env.MAILTRAP_USER,
                pass: process.env.MAILTRAP_PASS,
            },
        });
    }

    return transporter;
}

export async function sendReportEmail({
    to,
    subject,
    bodyHtml,
    pdfBase64,
    filename,
    fromName,
}: {
    to: string[];
    subject: string;
    bodyHtml: string;
    pdfBase64: string;
    filename: string;
    fromName: string;
}): Promise<void> {
    const fromAddress = process.env.MAIL_FROM;

    if (!fromAddress) {
        throw new Error("MAIL_FROM is not set.");
    }

    // The sender identity (who this is from) is a fixed brand, separate from
    // fromName (what the report is about, e.g. "UAT Sprint 1 - Auto") - so
    // it's pinned via its own env var rather than reusing fromName, and
    // falls back to fromName only if that var isn't configured.
    const fromDisplayName = process.env.MAIL_FROM_NAME ?? fromName;

    await getTransporter().sendMail({
        from: {
            name: fromDisplayName,
            address: fromAddress,
        },
        to,
        subject,
        html: bodyHtml,
        attachments: [
            {
                filename,
                content: Buffer.from(pdfBase64, "base64"),
                contentType: "application/pdf",
            },
        ],
    });
}
