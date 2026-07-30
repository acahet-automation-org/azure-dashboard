import { useState } from "react";
import { Button, Spinner, Text } from "@fluentui/react-components";
import { MailRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { acquireMailToken } from "../mailGraphAuth";

type Status = "idle" | "sending" | "sent" | "error";

// Matches TopBar's own error color (rail bar stays dark regardless of
// light/dark theme, so a theme token here would resolve to the wrong color).
const ERROR_COLOR = "#ff9b93";

const LABEL_KEY: Record<Status, string> = {
    idle: "nav.testGraphMail",
    sending: "nav.testGraphMailSending",
    sent: "nav.testGraphMailSuccess",
    error: "nav.testGraphMail",
};

// Only exercises sign-in against the delegated Graph app registration used
// by the report "Send by email" button (see mailGraphAuth.ts/api/graphMail.ts)
// - handy for confirming the app registration/auth flow still works without
// sending a real (or test) email.
export function TestGraphMailButton() {
    const { t } = useTranslation();
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState<string | null>(null);

    const handleClick = async () => {
        setStatus("sending");
        setError(null);

        try {
            await acquireMailToken();
            setStatus("sent");
        } catch (err) {
            setStatus("error");
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    return (
        <>
            <Button
                appearance="secondary"
                icon={status === "sending" ? <Spinner size="tiny" /> : <MailRegular />}
                disabled={status === "sending"}
                onClick={handleClick}
            >
                {t(LABEL_KEY[status])}
            </Button>
            {status === "error" && error && (
                <Text role="alert" style={{ color: ERROR_COLOR }}>
                    {t("nav.testGraphMailFailed", { message: error })}
                </Text>
            )}
        </>
    );
}
