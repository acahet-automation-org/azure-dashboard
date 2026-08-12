import {
    Button,
    Card,
    Text,
    Title2,
    makeStyles,
    tokens,
} from "@fluentui/react-components";
import { ArrowSyncRegular, ErrorCircleRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { AzdoPatSteps } from "./AzdoPatSteps";

const useStyles = makeStyles({
    wrapper: {
        display: "flex",
        justifyContent: "center",
        padding: "48px 24px",
    },
    card: {
        maxWidth: "560px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalM,
        padding: tokens.spacingHorizontalL,
    },
    heading: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
    },
    icon: {
        fontSize: "24px",
        color: tokens.colorPaletteRedForeground1,
    },
});

// Rendered in place of the whole app when the "projects" query fails (see
// App.tsx) - almost always an unset/expired/invalid AZDO_PAT, since that's
// what actually gates data access (see the comment on App() there). This
// replaces what used to be a blank white page with the one thing that
// actually helps: the same setup steps as the first-load guide, plus a way
// to retry once .env has been fixed and the server restarted.
export function AzdoConnectionError({ onRetry }: { onRetry: () => void }) {
    const { t } = useTranslation();
    const styles = useStyles();

    return (
        <div className={styles.wrapper}>
            <Card className={styles.card}>
                <div className={styles.heading}>
                    <ErrorCircleRegular className={styles.icon} />
                    <Title2 as="h1">{t("azdoConnectionError.title")}</Title2>
                </div>

                <Text block>{t("azdoConnectionError.message")}</Text>

                <AzdoPatSteps />

                <Button
                    appearance="primary"
                    icon={<ArrowSyncRegular />}
                    onClick={onRetry}
                >
                    {t("azdoConnectionError.retry")}
                </Button>
            </Card>
        </div>
    );
}
