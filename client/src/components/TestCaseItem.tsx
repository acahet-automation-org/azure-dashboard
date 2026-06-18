import {
    Card,
    Text,
    Link as FluentLink,
    mergeClasses,
    makeStyles,
    tokens,
} from "@fluentui/react-components";
import { OutcomeBadge } from "./OutcomeBadge";
import { BugList } from "./BugList";
import type { TestCaseRow } from "../types";

const useStyles = makeStyles({
    card: {
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
        borderLeftWidth: "4px",
        borderLeftStyle: "solid",
        borderLeftColor: tokens.colorNeutralStroke2,
    },
    hasBugs: {
        borderLeftColor: tokens.colorPaletteRedBorder2,
    },
    header: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        flexWrap: "wrap",
    },
    meta: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
        marginTop: tokens.spacingVerticalXS,
    },
});

export function TestCaseItem({ testCase }: { testCase: TestCaseRow }) {
    const styles = useStyles();

    const activeBugs = testCase.bugs.filter(
        (b) => b.state !== "Closed"
    ).length;

    const closedBugs = testCase.bugs.length - activeBugs;

    return (
        <Card
            className={mergeClasses(
                styles.card,
                testCase.hasOpenBugs && styles.hasBugs
            )}
        >
            <div className={styles.header}>
                {testCase.testCaseUrl ? (
                    <FluentLink
                        href={testCase.testCaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {testCase.testCaseTitle}
                    </FluentLink>
                ) : (
                    <Text weight="semibold">{testCase.testCaseTitle}</Text>
                )}

                <OutcomeBadge outcome={testCase.outcome} />
            </div>

            <Text className={styles.meta} block>
                Area: {testCase.areaPath}
            </Text>

            {testCase.bugs.length > 0 && (
                <>
                    <Text className={styles.meta} block>
                        Bugs linked: {testCase.bugs.length} ({activeBugs}{" "}
                        active, {closedBugs} closed)
                    </Text>

                    <BugList bugs={testCase.bugs} />
                </>
            )}
        </Card>
    );
}
