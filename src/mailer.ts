import nodemailer from "nodemailer";
import "dotenv/config";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === "true",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
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
    await getTransporter().sendMail({
        // Gmail (and most providers) reject/rewrite a "from" address that
        // isn't the authenticated account, so only the display name can be
        // customized here - the underlying address stays SMTP_USER.
        from: {
            name: fromName,
            address: process.env.MAIL_FROM ?? process.env.SMTP_USER!,
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
