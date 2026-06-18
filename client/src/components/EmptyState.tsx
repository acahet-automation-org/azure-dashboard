import { Text, makeStyles, tokens } from "@fluentui/react-components";
import { FolderRegular } from "@fluentui/react-icons";

const useStyles = makeStyles({
    container: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: tokens.spacingVerticalS,
        padding: tokens.spacingVerticalXXL,
        color: tokens.colorNeutralForeground3,
    },
    icon: {
        fontSize: "32px",
    },
});

export function EmptyState({ message }: { message: string }) {
    const styles = useStyles();

    return (
        <div className={styles.container}>
            <FolderRegular className={styles.icon} aria-hidden="true" />
            <Text>{message}</Text>
        </div>
    );
}
