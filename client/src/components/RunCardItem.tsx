import { Text, Title3, makeStyles, tokens } from "@fluentui/react-components";
import { PlayCircleRegular } from "@fluentui/react-icons";
import type { RunCard } from "../types";

const useStyles = makeStyles({
    card: {
        padding: tokens.spacingHorizontalM,
        borderRadius: tokens.borderRadiusMedium,
        backgroundColor: tokens.colorNeutralBackground1,
        boxShadow: tokens.shadow4,
        textDecorationLine: "none",
        color: "inherit",
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXS,
        ":hover": {
            boxShadow: tokens.shadow8,
        },
    },
    title: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
    },
    passRate: {
        fontWeight: tokens.fontWeightSemibold,
    },
});

export function RunCardItem({ run }: { run: RunCard }) {
    const styles = useStyles();

    return (
        <a
            href={run.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.card}
        >
            <Title3 as="h3" className={styles.title}>
                <PlayCircleRegular aria-hidden="true" />
                {run.name}
            </Title3>

            <Text>State: {run.state}</Text>

            <Text>
                Completed:{" "}
                {run.completedDate
                    ? new Date(run.completedDate).toLocaleString()
                    : "N/A"}
            </Text>

            <Text>Total: {run.total}</Text>

            <Text>
                Passed {run.counts.Passed} &middot; Failed {run.counts.Failed}{" "}
                &middot; Blocked {run.counts.Blocked} &middot; Not Run{" "}
                {run.counts.NotRun}
            </Text>

            <Text className={styles.passRate}>Pass rate: {run.passRate}%</Text>
        </a>
    );
}
