import { Link, Text, mergeClasses, makeStyles, tokens } from "@fluentui/react-components";
import { BugFilled, TaskListSquareLtrFilled, CheckmarkCircleFilled } from "@fluentui/react-icons";
import type { WorkItemSummary } from "../types";

const useStyles = makeStyles({
    list: {
        marginTop: tokens.spacingVerticalXS,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXXS,
    },
    item: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
        fontSize: tokens.fontSizeBase300,
    },
    active: {
        color: tokens.colorNeutralForeground1,
    },
    closed: {
        color: tokens.colorPaletteGreenForeground1,
    },
});

const CLOSED_STATES = ["Closed", "Resolved", "Removed", "Done"];

export function WorkItemList({ items }: { items: WorkItemSummary[] }) {
    const styles = useStyles();

    return (
        <div className={styles.list}>
            {items.map((item) => {
                const isClosed = CLOSED_STATES.includes(item.state);
                const icon = isClosed ? (
                    <CheckmarkCircleFilled aria-hidden="true" />
                ) : item.type === "Bug" ? (
                    <BugFilled aria-hidden="true" />
                ) : (
                    <TaskListSquareLtrFilled aria-hidden="true" />
                );
                const label =
                    item.priority != null
                        ? `P${item.priority} · ${item.id} - ${item.title} (${item.state})`
                        : `${item.id} - ${item.title} (${item.state})`;

                return (
                    <Text
                        key={item.id}
                        className={mergeClasses(
                            styles.item,
                            isClosed ? styles.closed : styles.active
                        )}
                    >
                        {icon}
                        {item.url ? (
                            <Link href={item.url} target="_blank" rel="noreferrer">
                                {label}
                            </Link>
                        ) : (
                            label
                        )}
                    </Text>
                );
            })}
        </div>
    );
}
