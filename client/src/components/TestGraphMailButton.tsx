import { useEffect, useState } from "react";
import { Button, Spinner, Text } from "@fluentui/react-components";
import { PersonRegular, SignOutRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import {
    acquireMailToken,
    getSignedInMailAccount,
    signOutOfMail,
} from "../mailGraphAuth";
import { ensureMailMsalInitialized } from "../mailMsalInstance";

// Matches TopBar's own error color (rail bar stays dark regardless of
// light/dark theme, so a theme token here would resolve to the wrong color).
const ERROR_COLOR = "#ff9b93";

// Toggles sign-in/sign-out against the delegated Graph app registration used
// by the report "Send by email" button (see mailGraphAuth.ts/api/graphMail.ts)
// - handy for confirming the app registration/auth flow still works, and for
// switching accounts, without sending a real (or test) email.
export function TestGraphMailButton() {
    const { t } = useTranslation();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        ensureMailMsalInitialized().then(() => {
            if (!cancelled) {
                setIsLoggedIn(getSignedInMailAccount() != null);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    const handleClick = async () => {
        setIsBusy(true);
        setError(null);

        try {
            if (isLoggedIn) {
                await signOutOfMail();
                setIsLoggedIn(false);
            } else {
                await acquireMailToken();
                setIsLoggedIn(true);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsBusy(false);
        }
    };

    const label = isBusy
        ? t(
              isLoggedIn
                  ? "nav.testGraphSigningOut"
                  : "nav.testGraphSigningIn"
          )
        : t(isLoggedIn ? "nav.testGraphLogout" : "nav.testGraphLogin");

    return (
        <>
            <Button
                appearance="secondary"
                icon={
                    isBusy ? (
                        <Spinner size="tiny" />
                    ) : isLoggedIn ? (
                        <SignOutRegular />
                    ) : (
                        <PersonRegular />
                    )
                }
                disabled={isBusy}
                onClick={handleClick}
            >
                {label}
            </Button>
            {error && (
                <Text role="alert" style={{ color: ERROR_COLOR }}>
                    {t(
                        isLoggedIn
                            ? "nav.testGraphLogoutFailed"
                            : "nav.testGraphLoginFailed",
                        { message: error }
                    )}
                </Text>
            )}
        </>
    );
}
