import { Card, Skeleton, SkeletonItem, makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: tokens.spacingHorizontalM,
    },
    card: {
        padding: tokens.spacingHorizontalM,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
    },
});

export function LoadingCardGrid({ count = 6 }: { count?: number }) {
    const styles = useStyles();

    return (
        <div className={styles.grid} aria-busy="true" aria-label="Loading">
            {Array.from({ length: count }).map((_, i) => (
                <Card key={i} className={styles.card}>
                    <Skeleton>
                        <SkeletonItem size={20} />
                        <SkeletonItem size={12} />
                        <SkeletonItem size={12} />
                        <SkeletonItem size={12} />
                    </Skeleton>
                </Card>
            ))}
        </div>
    );
}
