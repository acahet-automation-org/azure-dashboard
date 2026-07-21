import { useMutation } from "@tanstack/react-query";
import {
    Button,
    Text,
    Title1,
    Spinner,
    makeStyles,
    tokens,
} from "@fluentui/react-components";
import { ArrowSyncRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useMsal } from "@azure/msal-react";
import { NAV_HEIGHT } from "../../layoutConstants";
import { postRefresh } from "../../api/client";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { ThemeSwitcher } from "../ThemeSwitcher";

const useStyles = makeStyles({
    bar: {
        position: "sticky",
        top: 0,
        zIndex: 10,
        minHeight: NAV_HEIGHT,
        boxSizing: "border-box",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.spacingHorizontalM,
        padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
        borderBottomWidth: "1px",
        borderBottomStyle: "solid",
        borderBottomColor: tokens.colorNeutralStroke2,
        backgroundColor: tokens.colorNeutralBackground1,
    },
    title: {
        margin: 0,
    },
    controls: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        flexWrap: "wrap",
    },
    error: {
        color: tokens.colorPaletteRedForeground1,
    },
});

export function TopBar({ title }: { title: string }) {
    const styles = useStyles();
    const { t } = useTranslation();
    const { instance, accounts } = useMsal();
    const activeAccount = instance.getActiveAccount() ?? accounts[0];

    const refreshMutation = useMutation({
        mutationFn: postRefresh,
    });

    return (
        <div className={styles.bar}>
            <Title1 as="h1" className={styles.title}>
                {title}
            </Title1>

            <div className={styles.controls}>
                {refreshMutation.isError && (
                    <Text className={styles.error} role="alert">
                        {t("nav.refreshFailed", {
                            message: refreshMutation.error.message,
                        })}
                    </Text>
                )}

                <Button
                    appearance="subtle"
                    icon={
                        refreshMutation.isPending ? (
                            <Spinner size="tiny" />
                        ) : (
                            <ArrowSyncRegular />
                        )
                    }
                    disabled={refreshMutation.isPending}
                    onClick={() => refreshMutation.mutate()}
                >
                    {t(
                        refreshMutation.isPending
                            ? "nav.refreshing"
                            : "nav.refresh"
                    )}
                </Button>

                {activeAccount && (
                    <Text>
                        {t("nav.welcome", {
                            name: activeAccount.name ?? activeAccount.username,
                        })}
                    </Text>
                )}

                <LanguageSwitcher />
                <ThemeSwitcher />
            </div>
        </div>
    );
}
