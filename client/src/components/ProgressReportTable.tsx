import { useState } from "react";
import {
    Table,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
    Button,
    Text,
    makeStyles,
    tokens,
} from "@fluentui/react-components";
import {
    ChevronRightRegular,
    ChevronDownRegular,
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import type { TestPlanProgressNode } from "../types";
import {
    runPercent,
    passedPercent,
    failedPercent,
} from "../utils/progressReport";

const useStyles = makeStyles({
    titleCell: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
    },
    spacer: {
        display: "inline-block",
        width: "32px",
    },
});

type FlatRow = {
    node: TestPlanProgressNode;
    depth: number;
    key: string;
};

function flatten(
    nodes: TestPlanProgressNode[],
    depth: number,
    parentKey: string,
    expanded: Set<string>
): FlatRow[] {
    return nodes.flatMap((node) => {
        const key = `${parentKey}/${node.id}`;
        const row: FlatRow = { node, depth, key };

        if (node.children.length === 0 || !expanded.has(key)) {
            return [row];
        }

        return [row, ...flatten(node.children, depth + 1, key, expanded)];
    });
}

export function ProgressReportTable({
    nodes,
}: {
    nodes: TestPlanProgressNode[];
}) {
    const { t } = useTranslation();
    const styles = useStyles();
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const rows = flatten(nodes, 0, "", expanded);

    const toggle = (key: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);

            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }

            return next;
        });
    };

    return (
        <Table aria-label={t("planProgressPage.table.ariaLabel")}>
            <TableHeader>
                <TableRow>
                    <TableHeaderCell>
                        {t("planProgressPage.table.columns.title")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("planProgressPage.table.columns.testPoints")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("planProgressPage.table.columns.runPercent")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("planProgressPage.table.columns.passedPercent")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("planProgressPage.table.columns.failedPercent")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("planProgressPage.table.columns.notRunCount")}
                    </TableHeaderCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map(({ node, depth, key }) => (
                    <TableRow key={key}>
                        <TableCell>
                            <div
                                className={styles.titleCell}
                                style={{
                                    paddingLeft: `${depth * 20}px`,
                                }}
                            >
                                {node.children.length > 0 ? (
                                    <Button
                                        appearance="transparent"
                                        size="small"
                                        icon={
                                            expanded.has(key) ? (
                                                <ChevronDownRegular />
                                            ) : (
                                                <ChevronRightRegular />
                                            )
                                        }
                                        onClick={() => toggle(key)}
                                        aria-label={
                                            expanded.has(key)
                                                ? t(
                                                      "planProgressPage.table.collapse"
                                                  )
                                                : t(
                                                      "planProgressPage.table.expand"
                                                  )
                                        }
                                    />
                                ) : (
                                    <span className={styles.spacer} />
                                )}
                                <Text
                                    weight={
                                        depth === 0
                                            ? "bold"
                                            : depth === 1
                                              ? "semibold"
                                              : "regular"
                                    }
                                >
                                    {node.title}
                                </Text>
                            </div>
                        </TableCell>
                        <TableCell>{node.counts.total}</TableCell>
                        <TableCell>{runPercent(node.counts)}</TableCell>
                        <TableCell>{passedPercent(node.counts)}</TableCell>
                        <TableCell>{failedPercent(node.counts)}</TableCell>
                        <TableCell>{node.counts.notExecuted}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
