import { useNavigate } from "react-router-dom";
import {
    Button,
    Card,
    CardHeader,
    Title1,
    Title3,
    Text,
    makeStyles,
    tokens,
} from "@fluentui/react-components";
import {
    ClipboardTaskListLtrRegular,
    RocketRegular,
    type FluentIcon,
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useScope } from "../hooks/useScope";
import { useViewMode } from "../hooks/useViewMode";
import type { ViewMode } from "../hooks/viewModeContext";

const useStyles = makeStyles({
    page: {
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacingVerticalXL,
        padding: tokens.spacingHorizontalXXL,
        backgroundColor: tokens.colorNeutralBackground2,
    },
    header: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: tokens.spacingVerticalXS,
        textAlign: "center",
    },
    chip: {
        backgroundColor: tokens.colorBrandBackground2,
        color: tokens.colorBrandForeground2,
        borderRadius: tokens.borderRadiusCircular,
        padding: `2px ${tokens.spacingHorizontalM}`,
        fontWeight: tokens.fontWeightSemibold,
    },
    options: {
        display: "flex",
        flexWrap: "wrap",
        gap: tokens.spacingHorizontalL,
        justifyContent: "center",
    },
    card: {
        width: "280px",
        padding: tokens.spacingHorizontalL,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalM,
        cursor: "pointer",
        ":hover": {
            boxShadow: tokens.shadow16,
        },
    },
    icon: {
        fontSize: "32px",
        color: tokens.colorBrandForeground1,
    },
});

function ModeCard({
    icon: Icon,
    title,
    description,
    onSelect,
}: {
    icon: FluentIcon;
    title: string;
    description: string;
    onSelect: () => void;
}) {
    const styles = useStyles();

    return (
        <Card
            className={styles.card}
            onClick={onSelect}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    onSelect();
                }
            }}
            tabIndex={0}
            role="button"
        >
            <CardHeader
                image={<Icon className={styles.icon} />}
                header={<Title3>{title}</Title3>}
            />
            <Text>{description}</Text>
            <Button appearance="primary" onClick={onSelect}>
                {title}
            </Button>
        </Card>
    );
}

// Shown once per session (after login and project selection, before the
// nav/routes render - see App.tsx) so the user picks which set of pages
// they want: functional test-plan reporting or the Playwright automation
// board. The choice persists per account (see ViewModeProvider) and can be
// changed later from the sidebar.
export function ViewModeSelectPage() {
    const styles = useStyles();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const scope = useScope();
    const { setMode } = useViewMode();

    const choose = (mode: ViewMode) => {
        setMode(mode);
        navigate(mode === "automation" ? "/automation-dashboard" : "/", {
            replace: true,
        });
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <Title1 as="h1">{t("viewModeSelectPage.title")}</Title1>
                <Text>{t("viewModeSelectPage.subtitle")}</Text>
                {scope.project && (
                    <span className={styles.chip}>{scope.project}</span>
                )}
            </div>

            <div className={styles.options}>
                <ModeCard
                    icon={ClipboardTaskListLtrRegular}
                    title={t("viewModeSelectPage.functional.title")}
                    description={t("viewModeSelectPage.functional.description")}
                    onSelect={() => choose("functional")}
                />
                <ModeCard
                    icon={RocketRegular}
                    title={t("viewModeSelectPage.automation.title")}
                    description={t("viewModeSelectPage.automation.description")}
                    onSelect={() => choose("automation")}
                />
            </div>
        </div>
    );
}
