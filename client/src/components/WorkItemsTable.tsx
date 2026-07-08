import {
    Badge,
    Link,
    Table,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import type { WorkItemSummary } from "../types";

const CLOSED_STATES = ["Closed", "Resolved", "Removed", "Done"];

export function WorkItemsTable({
    items,
    ariaLabel,
    showTags = false,
}: {
    items: WorkItemSummary[];
    ariaLabel: string;
    showTags?: boolean;
}) {
    const { t } = useTranslation();
    const showPriority = items.some((item) => item.priority != null);

    return (
        <Table aria-label={ariaLabel}>
            <TableHeader>
                <TableRow>
                    {showPriority && (
                        <TableHeaderCell>
                            {t("workItemsTable.columns.priority")}
                        </TableHeaderCell>
                    )}
                    <TableHeaderCell>
                        {t("workItemsTable.columns.id")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("workItemsTable.columns.title")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("workItemsTable.columns.type")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("workItemsTable.columns.state")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("workItemsTable.columns.assignee")}
                    </TableHeaderCell>
                    {showTags && (
                        <TableHeaderCell>
                            {t("workItemsTable.columns.tags")}
                        </TableHeaderCell>
                    )}
                </TableRow>
            </TableHeader>
            <TableBody>
                {items.map((item) => {
                    const isActive = !CLOSED_STATES.includes(item.state);

                    return (
                        <TableRow key={item.id}>
                            {showPriority && (
                                <TableCell>
                                    {item.priority != null
                                        ? `P${item.priority}`
                                        : ""}
                                </TableCell>
                            )}
                            <TableCell>
                                {item.url ? (
                                    <Link
                                        href={item.url}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {item.id}
                                    </Link>
                                ) : (
                                    item.id
                                )}
                            </TableCell>
                            <TableCell>{item.title}</TableCell>
                            <TableCell>{item.type}</TableCell>
                            <TableCell>
                                <Badge
                                    color={isActive ? "danger" : "success"}
                                    appearance="tint"
                                >
                                    {item.state}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                {item.assignee?.displayName ?? ""}
                            </TableCell>
                            {showTags && (
                                <TableCell>
                                    {item.type === "Bug"
                                        ? item.tags?.length
                                            ? item.tags.join(", ")
                                            : t("workItemsTable.noTags")
                                        : ""}
                                </TableCell>
                            )}
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}
