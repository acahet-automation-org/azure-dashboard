import {
    Link,
    Table,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import type { BugInfo } from "../types";

export function BugsTable({
    bugs,
    ariaLabel,
}: {
    bugs: BugInfo[];
    ariaLabel: string;
}) {
    const { t } = useTranslation();

    return (
        <Table aria-label={ariaLabel}>
            <TableHeader>
                <TableRow>
                    <TableHeaderCell>
                        {t("bugsTable.columns.id")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("bugsTable.columns.title")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("bugsTable.columns.state")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("bugsTable.columns.creator")}
                    </TableHeaderCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                {bugs.map((bug) => (
                    <TableRow key={bug.id}>
                        <TableCell>
                            {bug.url ? (
                                <Link
                                    href={bug.url}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {bug.id}
                                </Link>
                            ) : (
                                bug.id
                            )}
                        </TableCell>
                        <TableCell>{bug.title}</TableCell>
                        <TableCell>{bug.state}</TableCell>
                        <TableCell>{bug.creator ?? ""}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
