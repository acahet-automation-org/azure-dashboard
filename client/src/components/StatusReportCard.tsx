import { forwardRef, useMemo } from "react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { makeStyles } from "@fluentui/react-components";
import { SuiteProgressBar } from "./SuiteProgressBar";
import type { Outcome, SprintDefectReport } from "../types";

function formatUpdatedTimestamp(date: Date): {
    datePart: string;
    timePart: string;
} {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return {
        datePart: `${day}/${month}`,
        timePart: `${hours}:${minutes}`,
    };
}

export interface SuiteProgressGroup {
    label: string;
    totalTestCases: number;
    outcomeCounts: Record<Outcome, number>;
}

// Severity is stored as "N - Label" (e.g. "1 - Critical"); the leading rank
// number is what drives both sort order and color, same convention used in
// SprintDefectReportTab.tsx and export.ts's severityRank.
function severityRank(raw: string): number {
    const match = /^(\d+)\s*-/.exec(raw);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function severityLabel(raw: string): string {
    const match = /^(\d+)\s*-\s*(.+)$/.exec(raw);
    return match ? match[2] : raw;
}

const SEVERITY_PALETTE = [
    { bg: "#442726", border: "#d13438", text: "#ff9b93" },
    { bg: "#3d3319", border: "#eda100", text: "#f4c669" },
    { bg: "#26313d", border: "#5b8bb0", text: "#9cc7e6" },
];
const SEVERITY_FALLBACK = { bg: "#2d2d2d", border: "#605e5c", text: "#c8c6c4" };

// Order/colors match the reference status card: most-done to least-done,
// left to right (green -> blue -> amber -> salmon).
const STATUS_ORDER = ["Closed", "Resolved", "In Progress", "New"];
const STATUS_COLORS: Record<string, string> = {
    Closed: "#3fb950",
    Resolved: "#0078d4",
    "In Progress": "#eda100",
    New: "#e8746c",
};
const STATUS_LABEL_KEYS: Record<string, string> = {
    Closed: "closed",
    Resolved: "resolved",
    "In Progress": "inProgress",
    New: "new",
};

const ACTION_PALETTE = [
    { bg: "#3d3319", border: "#eda100" },
    { bg: "#1f3550", border: "#3aa0f3" },
];

// A paragraph like "In arrivo su Azure DevOps: la maschera..." gets its
// "Label:" lead-in bolded, matching the reference card - only when the
// colon shows up early/on the first line, so it doesn't misfire on
// sentences that just happen to contain a colon further in.
function splitActionLeadIn(paragraph: string): {
    lead: string | null;
    rest: string;
} {
    const match = /^([^:\n]{1,80}:)\s*([\s\S]*)$/.exec(paragraph);

    if (!match) {
        return { lead: null, rest: paragraph };
    }

    return { lead: match[1], rest: match[2] };
}

const useStyles = makeStyles({
    card: {
        maxWidth: "480px",
        display: "flex",
        flexDirection: "column",
        borderRadius: "8px",
        overflow: "hidden",
        backgroundColor: "#1f1f1f",
        color: "#f3f2f1",
        fontFamily:
            "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "12px",
        padding: "14px 18px",
        backgroundColor: "#3e4a68",
    },
    headerTitleGroup: {
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        minWidth: "0",
    },
    headerTitle: {
        fontSize: "17px",
        fontWeight: 700,
        color: "#ffffff",
    },
    headerSubtitle: {
        fontSize: "12px",
        color: "#c3c9d9",
    },
    headerTimestamp: {
        fontSize: "11px",
        color: "#c3c9d9",
        whiteSpace: "nowrap",
    },
    body: {
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        padding: "18px",
    },
    alertBanner: {
        display: "flex",
        gap: "8px",
        padding: "10px 12px",
        borderRadius: "6px",
        backgroundColor: "#3d2f14",
        borderLeft: "4px solid #eda100",
        fontSize: "13px",
        lineHeight: 1.4,
    },
    kpiGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "8px",
    },
    kpiTile: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "2px",
        padding: "10px 6px",
        borderRadius: "6px",
        backgroundColor: "#2d2d2d",
        textAlign: "center",
    },
    kpiValue: {
        fontSize: "20px",
        fontWeight: 700,
    },
    kpiLabel: {
        fontSize: "10px",
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        color: "#c8c6c4",
    },
    dashboardButton: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        padding: "10px 12px",
        borderRadius: "6px",
        backgroundColor: "#0078d4",
        color: "#ffffff",
        fontSize: "13px",
        fontWeight: 600,
        textDecoration: "none",
    },
    sectionTitle: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#f3f2f1",
    },
    section: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
    },
    actionsBox: {
        padding: "10px 12px",
        borderRadius: "6px",
        borderLeft: "4px solid",
        fontSize: "13px",
        lineHeight: 1.4,
        whiteSpace: "pre-wrap",
    },
    emptyNote: {
        fontSize: "12px",
        color: "#8a8886",
        fontStyle: "italic",
    },
    sectionHeader: {
        display: "flex",
        flexDirection: "column",
        gap: "2px",
    },
    sectionSubtitle: {
        fontSize: "11px",
        color: "#8a8886",
    },
    statusSummaryRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: "8px",
        flexWrap: "wrap",
    },
    statusSummaryMain: {
        fontSize: "13px",
        color: "#f3f2f1",
    },
    statusStillOpen: {
        fontSize: "13px",
        fontWeight: 700,
        color: "#e8746c",
        whiteSpace: "nowrap",
    },
    statusTrack: {
        display: "flex",
        width: "100%",
        height: "10px",
        borderRadius: "5px",
        overflow: "hidden",
        backgroundColor: "#3b3a39",
    },
    statusSummary: {
        fontSize: "12px",
        color: "#c8c6c4",
    },
    statusLegend: {
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "5px",
        fontSize: "12px",
        color: "#c8c6c4",
    },
    swatch: {
        display: "inline-block",
        width: "8px",
        height: "8px",
        borderRadius: "2px",
        marginRight: "3px",
    },
    legendSeparator: {
        color: "#605e5c",
    },
    severityCaption: {
        fontSize: "11px",
        color: "#8a8886",
        textAlign: "center",
    },
    severityRow: {
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
    },
    severityChip: {
        flex: "1 1 80px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 6px",
        borderRadius: "6px",
        border: "1px solid",
    },
    severityCount: {
        fontSize: "18px",
        fontWeight: 700,
    },
    severityLabelText: {
        fontSize: "11px",
    },
});

export interface StatusReportCardProps {
    headerTitle: string;
    headerSubtitle: string;
    suiteGroups: SuiteProgressGroup[];
    report: SprintDefectReport;
    alertText: string;
    actionsText: string;
    dashboardUrl?: string;
    dashboardLinkRef?: RefObject<HTMLAnchorElement | null>;
}

export const StatusReportCard = forwardRef<
    HTMLDivElement,
    StatusReportCardProps
>(function StatusReportCard(
    {
        headerTitle,
        headerSubtitle,
        suiteGroups,
        report,
        alertText,
        actionsText,
        dashboardUrl,
        dashboardLinkRef,
    },
    ref
) {
    const { t } = useTranslation();
    const styles = useStyles();

    // Fixed to when the card first mounts rather than recomputed every
    // render, so it reads as "generated at" and doesn't visibly tick
    // forward while editing the alert/actions text below.
    const { datePart, timePart } = useMemo(
        () => formatUpdatedTimestamp(new Date()),
        []
    );

    const totalTestCases = suiteGroups.reduce(
        (sum, group) => sum + group.totalTestCases,
        0
    );

    // Pass rate = decided cases that passed (Passed / (Passed + Failed)),
    // excluding Blocked/NotApplicable/NotRun - matches the per-suite pass
    // rate shown in SuiteProgressBar and the reference card's math (e.g.
    // 109 passed / 119 decided across all suites = 92%, not passed/total).
    const totalPassed = suiteGroups.reduce(
        (sum, group) => sum + group.outcomeCounts.Passed,
        0
    );
    const totalFailed = suiteGroups.reduce(
        (sum, group) => sum + group.outcomeCounts.Failed,
        0
    );
    const totalDecided = totalPassed + totalFailed;
    const passRate = totalDecided
        ? Math.round((totalPassed / totalDecided) * 100)
        : 0;

    // Bug status covers ALL detected bugs (including out-of-scope ones -
    // they still need to be tracked to closure), so this and "still open"
    // are measured against report.total via byStatusAll, not effectiveCount.
    const bugsClosed = report.byStatusAll.Closed ?? 0;
    const bugsClosedPct = report.total
        ? Math.round((bugsClosed / report.total) * 100)
        : 0;
    const stillOpen = report.total - bugsClosed;

    const criticalCount = Object.entries(report.bySeverity)
        .filter(([key]) => severityRank(key) === 1)
        .reduce((sum, [, count]) => sum + count, 0);

    const statusEntries = STATUS_ORDER.map((name) => [
        name,
        report.byStatusAll[name] ?? 0,
    ] as const).filter(([, count]) => count > 0);

    // Severity distribution stays scoped to effective (in-scope) bugs only,
    // matching the caption under the chips.
    const severityEntries = Object.entries(report.bySeverity).sort(
        ([a], [b]) => severityRank(a) - severityRank(b)
    );

    const actionParagraphs = actionsText
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);

    const bugSources = [
        ...suiteGroups.map((group) => group.label),
        "DSI",
    ].join(", ");

    return (
        <div ref={ref} className={styles.card}>
            <div className={styles.header}>
                <div className={styles.headerTitleGroup}>
                    <span className={styles.headerTitle}>{headerTitle}</span>
                    <span className={styles.headerSubtitle}>
                        {headerSubtitle}
                    </span>
                </div>
                <span className={styles.headerTimestamp}>
                    {t(
                        "defectManagementPage.sprintReport.statusCard.updatedAt",
                        { date: datePart, time: timePart }
                    )}
                </span>
            </div>

            <div className={styles.body}>
            {alertText && (
                <div className={styles.alertBanner}>
                    <span>⚠️</span>
                    <span>{alertText}</span>
                </div>
            )}

            <div className={styles.kpiGrid}>
                <div className={styles.kpiTile}>
                    <span className={styles.kpiValue} style={{ color: "#3aa0f3" }}>
                        {totalTestCases}
                    </span>
                    <span className={styles.kpiLabel}>
                        {t(
                            "defectManagementPage.sprintReport.statusCard.kpis.totalTestCases"
                        )}
                    </span>
                </div>
                <div className={styles.kpiTile}>
                    <span className={styles.kpiValue} style={{ color: "#6bcf6b" }}>
                        {passRate}%
                    </span>
                    <span className={styles.kpiLabel}>
                        {t(
                            "defectManagementPage.sprintReport.statusCard.kpis.passRate"
                        )}
                    </span>
                </div>
                <div className={styles.kpiTile}>
                    <span className={styles.kpiValue} style={{ color: "#f2b134" }}>
                        {bugsClosed}/{report.total}
                    </span>
                    <span className={styles.kpiLabel}>
                        {t(
                            "defectManagementPage.sprintReport.statusCard.kpis.bugsClosed",
                            { percent: bugsClosedPct }
                        )}
                    </span>
                </div>
                <div className={styles.kpiTile}>
                    <span className={styles.kpiValue} style={{ color: "#ff6b6b" }}>
                        {criticalCount}
                    </span>
                    <span className={styles.kpiLabel}>
                        {t(
                            "defectManagementPage.sprintReport.statusCard.kpis.criticalBugs"
                        )}
                    </span>
                </div>
            </div>

            {dashboardUrl && (
                <a
                    ref={dashboardLinkRef}
                    href={dashboardUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.dashboardButton}
                >
                    {t(
                        "defectManagementPage.sprintReport.statusCard.openDashboard"
                    )}
                </a>
            )}

            {actionParagraphs.length > 0 && (
                <div className={styles.section}>
                    <span className={styles.sectionTitle}>
                        {t(
                            "defectManagementPage.sprintReport.statusCard.actionsTitle"
                        )}
                    </span>
                    {actionParagraphs.map((paragraph, index) => {
                        const palette =
                            ACTION_PALETTE[index % ACTION_PALETTE.length];
                        const { lead, rest } = splitActionLeadIn(paragraph);

                        return (
                            <div
                                key={index}
                                className={styles.actionsBox}
                                style={{
                                    backgroundColor: palette.bg,
                                    borderLeftColor: palette.border,
                                }}
                            >
                                {lead && <strong>{lead} </strong>}
                                {rest}
                            </div>
                        );
                    })}
                </div>
            )}

            <div className={styles.section}>
                <span className={styles.sectionTitle}>
                    {t(
                        "defectManagementPage.sprintReport.statusCard.suiteProgressTitle"
                    )}
                </span>

                {suiteGroups.length > 0 ? (
                    suiteGroups.map((group) => (
                        <SuiteProgressBar
                            key={group.label}
                            suiteName={group.label}
                            totalTestCases={group.totalTestCases}
                            outcomeCounts={group.outcomeCounts}
                        />
                    ))
                ) : (
                    <span className={styles.emptyNote}>
                        {t(
                            "defectManagementPage.sprintReport.statusCard.noPlanSelected"
                        )}
                    </span>
                )}
            </div>

            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>
                        🐛{" "}
                        {t(
                            "defectManagementPage.sprintReport.statusCard.bugStatusTitle"
                        )}
                    </span>
                    <span className={styles.sectionSubtitle}>
                        {t(
                            "defectManagementPage.sprintReport.statusCard.bugStatusSubtitle",
                            { sources: bugSources }
                        )}
                    </span>
                </div>

                <div className={styles.statusSummaryRow}>
                    <span className={styles.statusSummaryMain}>
                        <strong>
                            {t(
                                "defectManagementPage.sprintReport.statusCard.bugsDetected",
                                { count: report.total }
                            )}
                        </strong>{" "}
                        –{" "}
                        {t(
                            "defectManagementPage.sprintReport.statusCard.bugStatusSummary",
                            {
                                effective: report.effectiveCount,
                                outOfScope: report.outOfScopeCount,
                            }
                        )}
                    </span>
                    <span className={styles.statusStillOpen}>
                        {t(
                            "defectManagementPage.sprintReport.statusCard.stillOpen",
                            { count: stillOpen }
                        )}
                    </span>
                </div>

                <div className={styles.statusTrack}>
                    {statusEntries.map(([name, count]) => (
                        <div
                            key={name}
                            style={{
                                width: `${(count / report.total) * 100}%`,
                                backgroundColor: STATUS_COLORS[name],
                            }}
                        />
                    ))}
                </div>

                <span className={styles.statusLegend}>
                    {statusEntries.map(([name, count], index) => (
                        <span key={name}>
                            {index > 0 && (
                                <span className={styles.legendSeparator}>
                                    {" | "}
                                </span>
                            )}
                            <span
                                className={styles.swatch}
                                style={{ backgroundColor: STATUS_COLORS[name] }}
                            />
                            {count}{" "}
                            {t(
                                `defectManagementPage.sprintReport.statusCard.statusLabels.${STATUS_LABEL_KEYS[name]}`
                            )}
                        </span>
                    ))}
                </span>

                {severityEntries.length > 0 && (
                    <>
                        <div className={styles.severityRow}>
                            {severityEntries.map(([raw, count]) => {
                                const rank = severityRank(raw);
                                const palette =
                                    SEVERITY_PALETTE[rank - 1] ??
                                    SEVERITY_FALLBACK;

                                return (
                                    <div
                                        key={raw}
                                        className={styles.severityChip}
                                        style={{
                                            backgroundColor: palette.bg,
                                            borderColor: palette.border,
                                        }}
                                    >
                                        <span
                                            className={styles.severityCount}
                                            style={{ color: palette.text }}
                                        >
                                            {count}
                                        </span>
                                        <span
                                            className={styles.severityLabelText}
                                            style={{ color: palette.text }}
                                        >
                                            {severityLabel(raw)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <span className={styles.severityCaption}>
                            {t(
                                "defectManagementPage.sprintReport.statusCard.severityCaption",
                                { count: report.effectiveCount }
                            )}
                        </span>
                    </>
                )}
            </div>
            </div>
        </div>
    );
});
