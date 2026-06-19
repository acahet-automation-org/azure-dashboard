import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    TabList,
    Tab,
    Table,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
    makeStyles,
    tokens,
} from "@fluentui/react-components";
import type { SuiteStat } from "../types";

const useStyles = makeStyles({
    section: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
    },
});

const coverageTabs = ["requirements", "userStory", "feature"] as const;

type CoverageTab = (typeof coverageTabs)[number];

function suiteExecuted(stat: SuiteStat): number {
    return stat.passed + stat.failed + stat.blocked;
}

function suitePassRate(stat: SuiteStat): number {
    return stat.total
        ? Math.round((stat.passed / stat.total) * 1000) / 10
        : 0;
}

function suiteCoveragePct(stat: SuiteStat): number {
    return stat.total
        ? Math.round((suiteExecuted(stat) / stat.total) * 1000) / 10
        : 0;
}

function SuiteCoverageTable({
    suites,
}: {
    suites: Record<string, SuiteStat>;
}) {
    const { t } = useTranslation();

    const entries = Object.entries(suites).sort(([a], [b]) =>
        a.localeCompare(b)
    );

    return (
        <Table aria-label={t("testExecutionPage.coverage.tableLabel")}>
            <TableHeader>
                <TableRow>
                    <TableHeaderCell>
                        {t("testExecutionPage.coverage.columns.name")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("testExecutionPage.coverage.columns.total")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("testExecutionPage.coverage.columns.executed")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("testExecutionPage.coverage.columns.coverage")}
                    </TableHeaderCell>
                    <TableHeaderCell>
                        {t("testExecutionPage.coverage.columns.passRate")}
                    </TableHeaderCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                {entries.map(([name, stat]) => (
                    <TableRow key={name}>
                        <TableCell>{name}</TableCell>
                        <TableCell>{stat.total}</TableCell>
                        <TableCell>{suiteExecuted(stat)}</TableCell>
                        <TableCell>{suiteCoveragePct(stat)}%</TableCell>
                        <TableCell>{suitePassRate(stat)}%</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

export function CoverageSection({
    suites,
}: {
    suites: Record<string, SuiteStat>;
}) {
    const styles = useStyles();
    const { t } = useTranslation();
    const [selected, setSelected] = useState<CoverageTab>("requirements");

    return (
        <div className={styles.section}>
            <TabList
                selectedValue={selected}
                onTabSelect={(_, data) =>
                    setSelected(data.value as CoverageTab)
                }
            >
                {coverageTabs.map((tab) => (
                    <Tab key={tab} value={tab}>
                        {t(`testExecutionPage.coverage.tabs.${tab}`)}
                    </Tab>
                ))}
            </TabList>

            <SuiteCoverageTable suites={suites} />
        </div>
    );
}
