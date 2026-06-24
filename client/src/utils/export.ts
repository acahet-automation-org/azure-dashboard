import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import type { TestCaseRow } from "../types";

export interface ExportableRow {
    testPlan?: string;
    suiteName?: string;
    testCaseTitle?: string;
    outcome?: string;
    linkedDefects?: string;
}

export interface SuiteBugTotal {
    suiteName: string;
    totalBugs: number;
}

export interface SuiteHeaderStats {
    suiteName: string;
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    notRun: number;
    openBugs: number;
    closedBugs: number;
}

export function buildSuiteHeaderStats(
    rows: TestCaseRow[]
): SuiteHeaderStats {
    const bugStateById = new Map<number, string>();
    let passed = 0;
    let failed = 0;
    let blocked = 0;
    let notRun = 0;

    for (const row of rows) {
        if (row.outcome === "Passed") {
            passed++;
        } else if (row.outcome === "Failed") {
            failed++;
        } else if (row.outcome === "Blocked") {
            blocked++;
        } else {
            notRun++;
        }

        for (const bug of row.bugs) {
            bugStateById.set(bug.id, bug.state);
        }
    }

    let openBugs = 0;
    let closedBugs = 0;

    for (const state of bugStateById.values()) {
        if (state === "Closed") {
            closedBugs++;
        } else {
            openBugs++;
        }
    }

    return {
        suiteName: rows[0]?.suiteName ?? "",
        total: rows.length,
        passed,
        failed,
        blocked,
        notRun,
        openBugs,
        closedBugs,
    };
}

export function buildSuiteBugTotals(rows: TestCaseRow[]): SuiteBugTotal[] {
    const bugIdsBySuite = new Map<string, Set<number>>();

    for (const row of rows) {
        if (!bugIdsBySuite.has(row.suiteName)) {
            bugIdsBySuite.set(row.suiteName, new Set());
        }

        const bugIds = bugIdsBySuite.get(row.suiteName)!;

        for (const bug of row.bugs) {
            bugIds.add(bug.id);
        }
    }

    return [...bugIdsBySuite.entries()]
        .map(([suiteName, bugIds]) => ({
            suiteName,
            totalBugs: bugIds.size,
        }))
        .sort((a, b) => a.suiteName.localeCompare(b.suiteName));
}

interface ColumnDef {
    key: keyof ExportableRow;
    label: string;
}

const ALL_COLUMNS: ColumnDef[] = [
    { key: "testPlan", label: "Test Plan" },
    { key: "suiteName", label: "Suite Name" },
    { key: "testCaseTitle", label: "Test Case" },
    { key: "outcome", label: "Status" },
    { key: "linkedDefects", label: "Linked Defects" },
];

function activeColumns(rows: ExportableRow[]): ColumnDef[] {
    return ALL_COLUMNS.filter((col) =>
        rows.some((row) => row[col.key] !== undefined)
    );
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function exportToCsv(
    filename: string,
    rows: ExportableRow[],
    suiteBugTotals?: SuiteBugTotal[]
): void {
    const columns = activeColumns(rows);
    const lines: string[] = [];

    if (rows.length > 0) {
        lines.push(columns.map((col) => csvEscape(col.label)).join(","));

        for (const row of rows) {
            lines.push(
                columns
                    .map((col) => csvEscape(String(row[col.key] ?? "")))
                    .join(",")
            );
        }
    }

    if (suiteBugTotals && suiteBugTotals.length > 0) {
        if (lines.length > 0) {
            lines.push("");
        }
        lines.push("Total bugs by suite");
        lines.push(["Suite Name", "Total Bugs"].map(csvEscape).join(","));

        for (const total of suiteBugTotals) {
            lines.push(
                [csvEscape(total.suiteName), String(total.totalBugs)].join(",")
            );
        }
    }

    const blob = new Blob([lines.join("\n")], {
        type: "text/csv;charset=utf-8;",
    });
    downloadBlob(blob, `${filename}.csv`);
}

export async function exportToExcel(
    filename: string,
    rows: ExportableRow[],
    suiteBugTotals?: SuiteBugTotal[]
): Promise<void> {
    const columns = activeColumns(rows);
    const workbook = new ExcelJS.Workbook();

    if (rows.length > 0) {
        const sheet = workbook.addWorksheet("Results");

        sheet.columns = columns.map((col) => ({
            header: col.label,
            key: col.key,
            width: 30,
            style: { alignment: { wrapText: true, vertical: "top" } },
        }));

        for (const row of rows) {
            sheet.addRow(
                columns.reduce<Record<string, string>>((acc, col) => {
                    acc[col.key] = row[col.key] ?? "";
                    return acc;
                }, {})
            );
        }

        sheet.getRow(1).font = { bold: true };
    }

    if (suiteBugTotals && suiteBugTotals.length > 0) {
        const totalsSheet = workbook.addWorksheet("Bug Totals");
        totalsSheet.columns = [
            { header: "Suite Name", key: "suiteName", width: 30 },
            { header: "Total Bugs", key: "totalBugs", width: 15 },
        ];

        for (const total of suiteBugTotals) {
            totalsSheet.addRow(total);
        }

        totalsSheet.getRow(1).font = { bold: true };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, `${filename}.xlsx`);
}

function buildPdfDocument(
    title: string,
    rows: ExportableRow[],
    suiteBugTotals?: SuiteBugTotal[],
    suiteHeader?: SuiteHeaderStats
): jsPDF {
    const columns = activeColumns(rows);
    const doc = new jsPDF({
        orientation: columns.length > 2 ? "landscape" : "portrait",
    });

    doc.setFontSize(14);
    doc.text(title, 14, 15);

    let nextY = 22;

    if (suiteHeader) {
        doc.setFontSize(11);
        doc.text(`Suite: ${suiteHeader.suiteName}`, 14, nextY);
        nextY += 5;

        autoTable(doc, {
            startY: nextY,
            head: [
                [
                    "Total Tests",
                    "Passed",
                    "Failed",
                    "Not Run",
                    "Blocked",
                    "Bugs Open",
                    "Bugs Closed",
                ],
            ],
            body: [
                [
                    String(suiteHeader.total),
                    String(suiteHeader.passed),
                    String(suiteHeader.failed),
                    String(suiteHeader.notRun),
                    String(suiteHeader.blocked),
                    String(suiteHeader.openBugs),
                    String(suiteHeader.closedBugs),
                ],
            ],
            styles: { fontSize: 8 },
            headStyles: { fillColor: [0, 90, 158] },
        });

        nextY = (doc as unknown as { lastAutoTable: { finalY: number } })
            .lastAutoTable.finalY + 10;
    }

    if (rows.length > 0) {
        autoTable(doc, {
            startY: nextY,
            head: [columns.map((col) => col.label)],
            body: rows.map((row) =>
                columns.map((col) => String(row[col.key] ?? ""))
            ),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [0, 90, 158] },
        });

        nextY = (doc as unknown as { lastAutoTable: { finalY: number } })
            .lastAutoTable.finalY + 10;
    }

    if (!suiteHeader && suiteBugTotals && suiteBugTotals.length > 0) {
        doc.setFontSize(12);
        doc.text("Total bugs by suite", 14, nextY);
        nextY += 4;

        autoTable(doc, {
            startY: nextY,
            head: [["Suite Name", "Total Bugs"]],
            body: suiteBugTotals.map((total) => [
                total.suiteName,
                String(total.totalBugs),
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [0, 90, 158] },
        });
    }

    return doc;
}

export function exportToPdf(
    filename: string,
    title: string,
    rows: ExportableRow[],
    suiteBugTotals?: SuiteBugTotal[],
    suiteHeader?: SuiteHeaderStats
): void {
    const doc = buildPdfDocument(title, rows, suiteBugTotals, suiteHeader);
    doc.save(`${filename}.pdf`);
}

export function buildPdfBase64(
    title: string,
    rows: ExportableRow[],
    suiteBugTotals?: SuiteBugTotal[],
    suiteHeader?: SuiteHeaderStats
): string {
    const doc = buildPdfDocument(title, rows, suiteBugTotals, suiteHeader);

    return doc.output("datauristring").split(",")[1];
}
