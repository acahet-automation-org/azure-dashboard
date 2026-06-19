import { Text, mergeClasses, makeStyles, tokens } from "@fluentui/react-components";
import { BugFilled, CheckmarkCircleFilled } from "@fluentui/react-icons";
import type { BugInfo } from "../types";

const useStyles = makeStyles({
    list: {
        marginTop: tokens.spacingVerticalXS,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXXS,
    },
    bug: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
        marginLeft: tokens.spacingHorizontalL,
        fontSize: tokens.fontSizeBase200,
    },
    active: {
        color: tokens.colorPaletteRedForeground1,
    },
    closed: {
        color: tokens.colorPaletteGreenForeground1,
    },
});

export function BugList({ bugs }: { bugs: BugInfo[] }) {
    const styles = useStyles();

    return (
        <div className={styles.list}>
            {bugs.map((bug) => {
                const isActive = bug.state !== "Closed";

                return (
                    <Text
                        key={bug.id}
                        className={mergeClasses(
                            styles.bug,
                            isActive ? styles.active : styles.closed
                        )}
                    >
                        {isActive ? (
                            <BugFilled aria-hidden="true" />
                        ) : (
                            <CheckmarkCircleFilled aria-hidden="true" />
                        )}
                        {bug.id} - {bug.title} ({bug.state})
                    </Text>
                );
            })}
        </div>
    );
}
