import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Switch,
    Text,
    makeStyles,
    tokens,
} from "@fluentui/react-components";
import { FlagRegular, type FluentIcon } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { AUTOMATION_ITEMS, NAV_ITEMS } from "../config/navItems";
import { RESTRICTED_ITEM_KEYS } from "../config/restrictedNavKeys";
import { useIsRestrictedOwner } from "../hooks/useIsRestrictedOwner";
import { useNavVisibility } from "../hooks/useNavVisibility";

const releaseReadinessEnabled =
    import.meta.env.VITE_ENABLE_RELEASE_READINESS === "true";

// Not part of navItems.ts today (it's assembled inline in Sidebar.tsx/App.tsx
// instead) - synthesized here so it can appear as a togglable row alongside
// everything else, only when its own env flag is on.
const RELEASE_READINESS_ROW = {
    key: "release-readiness",
    labelKey: "nav.releaseReadiness",
    icon: FlagRegular as FluentIcon,
};

const useStyles = makeStyles({
    content: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalL,
    },
    rows: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXS,
    },
    row: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        justifyContent: "space-between",
    },
    rowLabel: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
    },
    rowIcon: {
        display: "flex",
        alignItems: "center",
        fontSize: "18px",
    },
});

// Opened from the gear icon in TopBar.tsx - lets each user show/hide sidebar
// sections for themselves (see NavVisibilityProvider), applied immediately
// (no separate Save step, same as ThemeSwitcher). "Browse by Suite" (home)
// is never listed since it's the app's own home/logo target; "Plan
// Progress"/"Remove Test Cases" are only listed for the restricted owner,
// since a toggle for a page a user can never reach anyway would just be
// confusing.
export function SettingsPanel({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const styles = useStyles();
    const isRestrictedOwner = useIsRestrictedOwner();
    const { isHidden, setHidden } = useNavVisibility();

    const rows = [...NAV_ITEMS, ...AUTOMATION_ITEMS]
        .filter((item) => item.key !== "suites")
        .filter((item) => isRestrictedOwner || !RESTRICTED_ITEM_KEYS.has(item.key))
        .concat(releaseReadinessEnabled ? [RELEASE_READINESS_ROW] : []);

    return (
        <Dialog
            open={open}
            onOpenChange={(_, data) => {
                if (!data.open) {
                    onClose();
                }
            }}
        >
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>{t("settings.title")}</DialogTitle>
                    <DialogContent className={styles.content}>
                        <Text block>{t("settings.description")}</Text>

                        <div className={styles.rows}>
                            {rows.map((item) => {
                                const Icon = item.icon;
                                const label = t(item.labelKey);

                                return (
                                    <div key={item.key} className={styles.row}>
                                        <span className={styles.rowLabel}>
                                            <span className={styles.rowIcon}>
                                                <Icon />
                                            </span>
                                            <Text>{label}</Text>
                                        </span>
                                        <Switch
                                            checked={!isHidden(item.key)}
                                            onChange={(_, data) =>
                                                setHidden(item.key, !data.checked)
                                            }
                                            aria-label={label}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="primary" onClick={onClose}>
                            {t("settings.close")}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
}
