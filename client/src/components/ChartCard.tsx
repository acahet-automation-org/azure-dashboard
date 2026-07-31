import type { ReactNode } from "react";
import { Card, Title3, Text, makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
    card: {
        padding: tokens.spacingHorizontalM,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
        minWidth: "0",
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.spacingHorizontalS,
    },
    titleRow: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
    },
    icon: {
        display: "flex",
        color: tokens.colorBrandForeground1,
        fontSize: "16px",
    },
    subtitle: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
        whiteSpace: "nowrap",
    },
});

export function ChartCard({
    title,
    icon,
    subtitle,
    children,
}: {
    title: string;
    icon?: ReactNode;
    subtitle?: string;
    children: ReactNode;
}) {
    const styles = useStyles();

    return (
        <Card className={styles.card}>
            <div className={styles.header}>
                <div className={styles.titleRow}>
                    {icon && <span className={styles.icon}>{icon}</span>}
                    <Title3 as="h3">{title}</Title3>
                </div>
                {subtitle && <Text className={styles.subtitle}>{subtitle}</Text>}
            </div>
            {children}
        </Card>
    );
}
