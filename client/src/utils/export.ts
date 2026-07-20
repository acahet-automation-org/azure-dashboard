import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";
import PptxGenJS from "pptxgenjs";
import type {
    BugInfo,
    Outcome,
    PlanOverviewResponse,
    PlanOverviewSuiteDetail,
    SprintDefectReport,
    TestCaseRow,
    TestPlanProgressCounts,
} from "../types";
import type { SuiteProgressGroup } from "../components/StatusReportCard";
import { passedPercent } from "./progressReport";

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
    notApplicable: number;
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
    let notApplicable = 0;
    let notRun = 0;

    for (const row of rows) {
        if (row.outcome === "Passed") {
            passed++;
        } else if (row.outcome === "Failed") {
            failed++;
        } else if (row.outcome === "Blocked") {
            blocked++;
        } else if (row.outcome === "NotApplicable") {
            notApplicable++;
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
        notApplicable,
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

export interface ChartImage {
    title: string;
    dataUrl: string;
    width: number;
    height: number;
    // "PNG" unless captureFullCanvas was asked for JPEG (see its jpegQuality
    // option) - jsPDF's addImage() needs to know which codec produced
    // dataUrl, since passing the wrong one corrupts the embedded image.
    format?: "PNG" | "JPEG";
}

// The exported chart image is always placed on a white PDF/email background,
// regardless of the app's current theme. In dark mode, chart text (legend
// labels, etc.) renders in a light color that's invisible once pasted onto
// that white page, so force a fixed dark color on the cloned DOM html2canvas
// captures rather than on the live (theme-aware) page.
const EXPORT_TEXT_COLOR = "#242424";

export async function captureChartImage(
    element: HTMLElement | null,
    title: string
): Promise<ChartImage | null> {
    if (!element) {
        return null;
    }

    const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
        onclone: (_document, clonedElement) => {
            clonedElement.style.backgroundColor = "#ffffff";
            clonedElement.style.color = EXPORT_TEXT_COLOR;

            clonedElement
                .querySelectorAll<HTMLElement>("*")
                .forEach((node) => {
                    node.style.color = EXPORT_TEXT_COLOR;
                });
        },
    });

    return {
        title,
        dataUrl: canvas.toDataURL("image/png"),
        width: canvas.width,
        height: canvas.height,
    };
}

// Unlike captureChartImage, this does NOT force a white background/dark
// text - it's used for StatusReportCard, which is deliberately styled as a
// fixed dark "shareable card" (independent of the app's own theme) and the
// whole point of the export is to preserve that look as-is.
//
// scale/jpegQuality are overridable because the same capture feeds two very
// different size budgets: the standalone "Export Status Card" PDF (no size
// limit, so it defaults to a crisp scale-2 PNG) versus the emailed PDF
// attachment, which has to fit under the mail relay's message-size cap (e.g.
// Mailtrap's default 5MB) - a scale-2 PNG of this multi-section card
// comfortably blows past that once SMTP's base64 attachment encoding adds
// its own ~37% overhead, so the email path asks for a smaller, JPEG-encoded
// capture instead.
export async function captureFullCanvas(
    element: HTMLElement | null,
    options: { scale?: number; jpegQuality?: number } = {}
): Promise<ChartImage | null> {
    if (!element) {
        return null;
    }

    const { scale = 2, jpegQuality } = options;
    const canvas = await html2canvas(element, { scale });

    if (jpegQuality != null) {
        return {
            title: "",
            dataUrl: canvas.toDataURL("image/jpeg", jpegQuality),
            width: canvas.width,
            height: canvas.height,
            format: "JPEG",
        };
    }

    return {
        title: "",
        dataUrl: canvas.toDataURL("image/png"),
        width: canvas.width,
        height: canvas.height,
        format: "PNG",
    };
}

function sanitizeFilenamePart(value: string): string {
    return value.replace(/[\\/:*?"<>|]+/g, "_").trim();
}

export function buildPlanOverviewFilename(
    planName: string,
    suiteName?: string
): string {
    const base = sanitizeFilenamePart(planName);
    const suite = suiteName ? `_${sanitizeFilenamePart(suiteName)}` : "";
    return `${base}${suite}.pdf`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

export function buildEmailReportHtml(
    title: string,
    rows: [string, string | number][],
    metricLabel: string,
    valueLabel: string
): string {
    const rowsHtml = rows
        .map(
            ([label, value]) =>
                `<tr>` +
                `<td style="padding:8px 12px;border:1px solid #d0d0d0;">${escapeHtml(label)}</td>` +
                `<td style="padding:8px 12px;border:1px solid #d0d0d0;">${escapeHtml(String(value))}</td>` +
                `</tr>`
        )
        .join("");

    return (
        `<h2 style="font-family:Arial,sans-serif;color:#005a9e;margin:0 0 12px;">${escapeHtml(title)}</h2>` +
        `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;width:100%;max-width:480px;">` +
        `<thead><tr style="background-color:#005a9e;color:#ffffff;">` +
        `<th style="padding:8px 12px;text-align:left;border:1px solid #d0d0d0;">${escapeHtml(metricLabel)}</th>` +
        `<th style="padding:8px 12px;text-align:left;border:1px solid #d0d0d0;">${escapeHtml(valueLabel)}</th>` +
        `</tr></thead>` +
        `<tbody>${rowsHtml}</tbody>` +
        `</table>`
    );
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();

    // Revoking synchronously right after click() races the browser's actual
    // read of the blob for the download - for larger binary files (.pptx in
    // particular) that race can truncate the saved file, which is exactly
    // what makes Office prompt to "repair" it on open. Deferring the revoke
    // gives the download a moment to actually start reading first.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
                    "Not Applicable",
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
                    String(suiteHeader.notApplicable),
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

function pdfDocToBase64(doc: jsPDF): string {
    const dataUri = doc.output("datauristring");
    return dataUri.substring(dataUri.indexOf(",") + 1);
}

export function buildPdfBase64(
    title: string,
    rows: ExportableRow[],
    suiteBugTotals?: SuiteBugTotal[],
    suiteHeader?: SuiteHeaderStats
): string {
    const doc = buildPdfDocument(title, rows, suiteBugTotals, suiteHeader);
    return pdfDocToBase64(doc);
}

const PDF_MARGIN = 14;
const PDF_MAX_Y = 297 - PDF_MARGIN;

function ensurePdfSpace(
    doc: jsPDF,
    currentY: number,
    neededHeight: number
): number {
    if (currentY + neededHeight > PDF_MAX_Y) {
        doc.addPage();
        return 15;
    }

    return currentY;
}

const PDF_CHART_GAP = 6;
const PDF_CHART_ROW_MAX_HEIGHT = 55;
const PDF_CHART_TITLE_HEIGHT = 8;
const PDF_CHART_PADDING = 4;

function addChartImagesRow(
    doc: jsPDF,
    charts: ChartImage[],
    startY: number
): number {
    if (charts.length === 0) {
        return startY;
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const innerWidth = pageWidth - PDF_MARGIN * 2;
    const columnWidth =
        (innerWidth - PDF_CHART_GAP * (charts.length - 1)) / charts.length;

    let maxImgHeight = 0;

    const layout = charts.map((chart) => {
        const aspectRatio = chart.height / chart.width;
        let imgWidth = columnWidth - PDF_CHART_PADDING * 2;
        let imgHeight = imgWidth * aspectRatio;

        if (imgHeight > PDF_CHART_ROW_MAX_HEIGHT) {
            imgHeight = PDF_CHART_ROW_MAX_HEIGHT;
            imgWidth = imgHeight / aspectRatio;
        }

        maxImgHeight = Math.max(maxImgHeight, imgHeight);

        return { chart, imgWidth, imgHeight };
    });

    const rowHeight =
        PDF_CHART_TITLE_HEIGHT + maxImgHeight + PDF_CHART_PADDING * 2;
    const y = ensurePdfSpace(doc, startY, rowHeight);

    doc.setDrawColor(200, 200, 200);

    layout.forEach(({ chart, imgWidth, imgHeight }, index) => {
        const cellX = PDF_MARGIN + index * (columnWidth + PDF_CHART_GAP);

        doc.rect(cellX, y, columnWidth, rowHeight);

        doc.setFontSize(10);
        doc.text(chart.title, cellX + PDF_CHART_PADDING, y + PDF_CHART_TITLE_HEIGHT);

        const imgX = cellX + (columnWidth - imgWidth) / 2;
        const imgY = y + PDF_CHART_TITLE_HEIGHT + PDF_CHART_PADDING;

        doc.addImage(chart.dataUrl, "PNG", imgX, imgY, imgWidth, imgHeight);
    });

    return y + rowHeight + 10;
}

interface PlanOverviewSuiteSection {
    suite: PlanOverviewSuiteDetail;
    chart?: ChartImage | null;
}

function buildPlanOverviewPdfDocument(
    data: PlanOverviewResponse,
    charts: ChartImage[] = [],
    suiteSection?: PlanOverviewSuiteSection
): jsPDF {
    const passRate = data.totalTestCases
        ? Math.round(
            (data.outcomeCounts.Passed / data.totalTestCases) * 1000
        ) / 10
        : 0;

    const executionRate = data.totalTestCases
        ? Math.round(
            ((data.totalTestCases -
                data.outcomeCounts.NotRun -
                data.outcomeCounts.NotApplicable) /
                data.totalTestCases) *
                1000
        ) / 10
        : 0;

    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text(`Plan Overview: ${data.planName}`, PDF_MARGIN, 15);

    autoTable(doc, {
        startY: 22,
        head: [
            [
                "Total Test Cases",
                "Blocked",
                "Not Run",
                "Not Applicable",
                "Total Bugs",
                "Pass Rate",
                "Execution Rate",
            ],
        ],
        body: [
            [
                String(data.totalTestCases),
                String(data.outcomeCounts.Blocked),
                String(data.outcomeCounts.NotRun),
                String(data.outcomeCounts.NotApplicable),
                String(data.totalBugs),
                `${passRate}%`,
                `${executionRate}%`,
            ],
        ],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 90, 158] },
    });

    let nextY =
        (doc as unknown as { lastAutoTable: { finalY: number } })
            .lastAutoTable.finalY + 10;

    nextY = addChartImagesRow(doc, charts, nextY);

    if (data.bugs.length > 0) {
        nextY = ensurePdfSpace(doc, nextY, 20);

        doc.setFontSize(12);
        doc.text("Bugs", 14, nextY);
        nextY += 4;

        autoTable(doc, {
            startY: nextY,
            head: [["ID", "Title", "State", "Creator"]],
            body: data.bugs.map((bug) => [
                String(bug.id),
                bug.title,
                bug.state,
                bug.creator ?? "",
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [0, 90, 158] },
        });

        nextY =
            (doc as unknown as { lastAutoTable: { finalY: number } })
                .lastAutoTable.finalY + 10;
    }

    if (suiteSection) {
        const { suite, chart } = suiteSection;

        nextY = ensurePdfSpace(doc, nextY, 20);

        doc.setFontSize(13);
        doc.text(`Suite: ${suite.suiteName}`, PDF_MARGIN, nextY);
        nextY += 6;

        const suitePassRate = suite.totalTestCases
            ? Math.round(
                (suite.outcomeCounts.Passed / suite.totalTestCases) * 1000
            ) / 10
            : 0;

        const suiteExecutionRate = suite.totalTestCases
            ? Math.round(
                ((suite.totalTestCases -
                    suite.outcomeCounts.NotRun -
                    suite.outcomeCounts.NotApplicable) /
                    suite.totalTestCases) *
                    1000
            ) / 10
            : 0;

        autoTable(doc, {
            startY: nextY,
            head: [
                [
                    "Total Test Cases",
                    "Passed",
                    "Failed",
                    "Blocked",
                    "Not Run",
                    "Not Applicable",
                    "Pass Rate",
                    "Execution Rate",
                ],
            ],
            body: [
                [
                    String(suite.totalTestCases),
                    String(suite.outcomeCounts.Passed),
                    String(suite.outcomeCounts.Failed),
                    String(suite.outcomeCounts.Blocked),
                    String(suite.outcomeCounts.NotRun),
                    String(suite.outcomeCounts.NotApplicable),
                    `${suitePassRate}%`,
                    `${suiteExecutionRate}%`,
                ],
            ],
            styles: { fontSize: 8 },
            headStyles: { fillColor: [0, 90, 158] },
        });

        nextY =
            (doc as unknown as { lastAutoTable: { finalY: number } })
                .lastAutoTable.finalY + 10;

        if (chart) {
            nextY = addChartImagesRow(doc, [chart], nextY);
        }

        if (suite.bugs.length > 0) {
            nextY = ensurePdfSpace(doc, nextY, 20);

            doc.setFontSize(12);
            doc.text("Bugs", PDF_MARGIN, nextY);
            nextY += 4;

            autoTable(doc, {
                startY: nextY,
                head: [["ID", "Title", "State", "Creator"]],
                body: suite.bugs.map((bug) => [
                    String(bug.id),
                    bug.title,
                    bug.state,
                    bug.creator ?? "",
                ]),
                styles: { fontSize: 8 },
                headStyles: { fillColor: [0, 90, 158] },
            });
        }
    }

    return doc;
}

export function exportPlanOverviewToPdf(
    data: PlanOverviewResponse,
    charts: ChartImage[] = [],
    suiteSection?: PlanOverviewSuiteSection
): void {
    const doc = buildPlanOverviewPdfDocument(data, charts, suiteSection);
    const filename = suiteSection
        ? buildPlanOverviewFilename(data.planName, suiteSection.suite.suiteName)
        : buildPlanOverviewFilename(data.planName);
    doc.save(filename);
}

export function buildPlanOverviewPdfBase64(
    data: PlanOverviewResponse,
    charts: ChartImage[] = []
): string {
    const doc = buildPlanOverviewPdfDocument(data, charts);
    return pdfDocToBase64(doc);
}

export function buildPlanOverviewSuitePdfBase64(
    planName: string,
    suite: PlanOverviewSuiteDetail,
    chart?: ChartImage
): string {
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text(`Plan Overview: ${planName} - ${suite.suiteName}`, PDF_MARGIN, 15);

    autoTable(doc, {
        startY: 22,
        head: [
            [
                "Total Test Cases",
                "Passed",
                "Failed",
                "Blocked",
                "Not Run",
                "Not Applicable",
            ],
        ],
        body: [
            [
                String(suite.totalTestCases),
                String(suite.outcomeCounts.Passed),
                String(suite.outcomeCounts.Failed),
                String(suite.outcomeCounts.Blocked),
                String(suite.outcomeCounts.NotRun),
                String(suite.outcomeCounts.NotApplicable),
            ],
        ],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 90, 158] },
    });

    let nextY =
        (doc as unknown as { lastAutoTable: { finalY: number } })
            .lastAutoTable.finalY + 10;

    if (chart) {
        nextY = addChartImagesRow(doc, [chart], nextY);
    }

    if (suite.bugs.length > 0) {
        nextY = ensurePdfSpace(doc, nextY, 20);

        doc.setFontSize(12);
        doc.text("Bugs", PDF_MARGIN, nextY);
        nextY += 4;

        autoTable(doc, {
            startY: nextY,
            head: [["ID", "Title", "State", "Creator"]],
            body: suite.bugs.map((bug) => [
                String(bug.id),
                bug.title,
                bug.state,
                bug.creator ?? "",
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [0, 90, 158] },
        });
    }

    return pdfDocToBase64(doc);
}

export function buildPlanProgressFilename(planTitle: string): string {
    return `${sanitizeFilenamePart(planTitle)}_progress_report.pdf`;
}

export interface PlanProgressPdfLabels {
    titlePrefix: string;
    testCases: string;
    testCasesRun: string;
    passed: string;
    failed: string;
    blocked: string;
    notApplicable: string;
    passRate: string;
    bugsTitle: string;
    bugsEmpty: string;
    bugColumns: {
        id: string;
        title: string;
        state: string;
        creator: string;
        assignee: string;
    };
}

function buildPlanProgressPdfDocument(
    planTitle: string,
    counts: TestPlanProgressCounts,
    bugs: BugInfo[],
    labels: PlanProgressPdfLabels,
    charts: ChartImage[] = []
): jsPDF {
    const executed =
        counts.total - counts.notExecuted - counts.notApplicable;

    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text(`${labels.titlePrefix}: ${planTitle}`, PDF_MARGIN, 15);

    autoTable(doc, {
        startY: 22,
        head: [
            [
                labels.testCases,
                labels.testCasesRun,
                labels.passed,
                labels.failed,
                labels.blocked,
                labels.notApplicable,
                labels.passRate,
            ],
        ],
        body: [
            [
                String(counts.total),
                `${executed} / ${counts.total}`,
                String(counts.passed),
                String(counts.failed),
                String(counts.blocked),
                String(counts.notApplicable),
                `${passedPercent(counts)}%`,
            ],
        ],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 90, 158] },
    });

    let nextY =
        (doc as unknown as { lastAutoTable: { finalY: number } })
            .lastAutoTable.finalY + 10;

    nextY = addChartImagesRow(doc, charts, nextY);

    nextY = ensurePdfSpace(doc, nextY, 20);

    doc.setFontSize(12);
    doc.text(labels.bugsTitle, PDF_MARGIN, nextY);
    nextY += 4;

    if (bugs.length > 0) {
        autoTable(doc, {
            startY: nextY,
            head: [
                [
                    labels.bugColumns.id,
                    labels.bugColumns.title,
                    labels.bugColumns.state,
                    labels.bugColumns.creator,
                    labels.bugColumns.assignee,
                ],
            ],
            body: bugs.map((bug) => [
                String(bug.id),
                bug.title,
                bug.state,
                bug.creator ?? "",
                bug.assignee?.displayName ?? "",
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [0, 90, 158] },
        });
    } else {
        doc.setFontSize(9);
        doc.text(labels.bugsEmpty, PDF_MARGIN, nextY + 4);
    }

    return doc;
}

// Severity is stored as e.g. "1 - Critical", so sorting by the leading rank
// number naturally orders Critical, High, Medium, ... to match the chart.
function severityRank(raw: string): number {
    const match = /^(\d+)\s*-/.exec(raw);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function formatDateDDMMYYYY(date: Date): string {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Shared by every Status Card export (PDF, HTML, PPTX, emailed PDF
// attachment) so they all name the file after the card's own title rather
// than a fixed generic string - e.g. "UAT Sprint 1 - Auto_16-07-2026.pptx".
export function buildStatusReportCardFilename(
    headerTitle: string,
    extension: string
): string {
    return `${sanitizeFilenamePart(headerTitle)}_${formatDateDDMMYYYY(new Date())}.${extension}`;
}

export interface StatusReportCardLink {
    element: HTMLElement | null;
    url: string;
}

// Renders the captured card at 1:1 pixel size by sizing the PDF page to the
// canvas itself, rather than fitting/scaling it into a fixed A4 page - this
// guarantees the exported PDF looks exactly like the on-screen card with no
// cropping or rescaling artifacts.
function buildStatusReportCardPdfDoc(
    capture: ChartImage,
    element: HTMLElement,
    links: StatusReportCardLink[]
): jsPDF {
    const doc = new jsPDF({
        unit: "px",
        format: [capture.width, capture.height],
    });

    doc.addImage(
        capture.dataUrl,
        capture.format ?? "PNG",
        0,
        0,
        capture.width,
        capture.height
    );

    // The card is rendered at its natural CSS size but captured at a higher
    // pixel scale (see captureFullCanvas), and the PDF page is sized to the
    // capture's pixel dimensions - so link regions have to be scaled from
    // on-screen CSS px to capture px using that same ratio, not assumed to
    // be 1:1 or hardcoded to the capture scale factor.
    const containerRect = element.getBoundingClientRect();
    const scale = containerRect.width
        ? capture.width / containerRect.width
        : 1;

    for (const link of links) {
        if (!link.element) {
            continue;
        }

        const rect = link.element.getBoundingClientRect();

        doc.link(
            (rect.left - containerRect.left) * scale,
            (rect.top - containerRect.top) * scale,
            rect.width * scale,
            rect.height * scale,
            { url: link.url }
        );
    }

    return doc;
}

export async function exportStatusReportCardToPdf(
    filename: string,
    element: HTMLElement | null,
    links: StatusReportCardLink[] = []
): Promise<void> {
    const capture = await captureFullCanvas(element);

    if (!capture || !element) {
        return;
    }

    const doc = buildStatusReportCardPdfDoc(capture, element, links);
    doc.save(filename);
}

export type TranslateFn = (
    key: string,
    options?: Record<string, unknown>
) => string;

export interface StatusReportCardEmailData {
    headerTitle: string;
    headerSubtitle: string;
    suiteGroups: SuiteProgressGroup[];
    report: SprintDefectReport;
    alertText: string;
    actionsText: string;
    dashboardUrl?: string;
}

const EMAIL_CARD_WIDTH = 600;

// Mirrors StatusReportCard.tsx's SEVERITY_PALETTE/STATUS_COLORS/ACTION_PALETTE
// and SuiteProgressBar.tsx's OUTCOME_COLORS - kept as its own copy (like the
// PDF section above already does with severityRank/STATUS_ORDER) since this
// builder emits raw HTML strings rather than JSX and has no component to
// import styling constants from without creating a render <-> string-builder
// coupling.
const EMAIL_SEVERITY_PALETTE = [
    { bg: "#442726", border: "#d13438", text: "#ff9b93" },
    { bg: "#3d3319", border: "#eda100", text: "#f4c669" },
    { bg: "#26313d", border: "#5b8bb0", text: "#9cc7e6" },
];
const EMAIL_SEVERITY_FALLBACK = { bg: "#2d2d2d", border: "#605e5c", text: "#c8c6c4" };

const EMAIL_STATUS_ORDER = ["Closed", "Resolved", "In Progress", "New"];
const EMAIL_STATUS_COLORS: Record<string, string> = {
    Closed: "#3fb950",
    Resolved: "#0078d4",
    "In Progress": "#eda100",
    New: "#e8746c",
};
const EMAIL_STATUS_LABEL_KEYS: Record<string, string> = {
    Closed: "closed",
    Resolved: "resolved",
    "In Progress": "inProgress",
    New: "new",
};

const EMAIL_ACTION_PALETTE = [
    { bg: "#3d3319", border: "#eda100" },
    { bg: "#1f3550", border: "#3aa0f3" },
];

const EMAIL_OUTCOME_ORDER: Outcome[] = [
    "Passed",
    "Failed",
    "Blocked",
    "Paused",
    "InProgress",
    "NotApplicable",
    "NotRun",
];
const EMAIL_OUTCOME_COLORS: Record<Outcome, string> = {
    Passed: "#3fb950",
    Failed: "#d13438",
    Blocked: "#eda100",
    Paused: "#b180d7",
    InProgress: "#3aa0f3",
    NotApplicable: "#8a8886",
    NotRun: "#8a8886",
};

function formatEmailTimestamp(date: Date): { datePart: string; timePart: string } {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return {
        datePart: `${day}/${month}`,
        timePart: `${hours}:${minutes}`,
    };
}

function emailSeverityLabel(raw: string): string {
    const match = /^(\d+)\s*-\s*(.+)$/.exec(raw);
    return match ? match[2] : raw;
}

function emailExecutedColor(pct: number): string {
    if (pct >= 90) {
        return "#3fb950";
    }

    if (pct < 30) {
        return "#d13438";
    }

    return "#eda100";
}

function splitEmailActionLeadIn(paragraph: string): {
    lead: string | null;
    rest: string;
} {
    const match = /^([^:\n]{1,80}:)\s*([\s\S]*)$/.exec(paragraph);

    if (!match) {
        return { lead: null, rest: paragraph };
    }

    return { lead: match[1], rest: match[2] };
}

const EMAIL_FONT_FAMILY = "'Segoe UI', Arial, sans-serif";

// The emailed HTML card uses a light palette - NOT the same EMAIL_* dark
// constants above, which the PPTX export still uses for its own (unrelated)
// slide. These values aren't invented: they're the light-mode originals the
// reference email itself carried in Outlook's data-ogsb/data-ogsc
// attributes (what OWA reverts to when its dark-mode auto-conversion is
// switched off), so this matches the template's actual intended look.
const LIGHT_PAGE_BG = "#f4f5f7";
const LIGHT_CARD_BG = "#ffffff";
const LIGHT_RULE = "#e3e7ee";
const LIGHT_INK = "#262626";
const LIGHT_INK_MUTED = "#5a6a85";
const LIGHT_HEADER_BG = "#1f3864";
const LIGHT_HEADER_SUB = "#5a6a85";
const LIGHT_ALERT_BG = "#fdecea";
const LIGHT_ALERT_BORDER = "#c62828";
const LIGHT_ALERT_TEXT = "#7a1f1f";
const LIGHT_BUTTON_BG = "#1f3864";
const LIGHT_STILL_OPEN = "#c62828";
const LIGHT_KPI = [
    { bg: "#f4f6fa", accent: "#1f3864" },
    { bg: "#f1f8f2", accent: "#2e7d32" },
    { bg: "#fdf6e7", accent: "#b45309" },
    { bg: "#fdecea", accent: "#c62828" },
];
const LIGHT_ACTION_PALETTE = [
    { bg: "#fff8e6", border: "#f0a500" },
    { bg: "#eef3fb", border: "#1f3864" },
];
const LIGHT_OUTCOME_COLORS: Record<Outcome, string> = {
    Passed: "#2e7d32",
    Failed: "#e53935",
    Blocked: "#f0a500",
    Paused: "#8e5cd9",
    InProgress: "#1565c0",
    NotApplicable: "#9e9e9e",
    NotRun: "#d9dee7",
};
const LIGHT_STATUS_COLORS: Record<string, string> = {
    Closed: "#2e7d32",
    Resolved: "#1565c0",
    "In Progress": "#f0a500",
    New: "#e53935",
};
const LIGHT_SEVERITY_PALETTE = [
    { bg: "#fdecea", border: "#f0c7c3", text: "#7a1f1f" },
    { bg: "#fff8e6", border: "#efd9a5", text: "#7a5308" },
    { bg: "#eef3fb", border: "#c6d4ea", text: "#1f3864" },
];
const LIGHT_SEVERITY_FALLBACK = { bg: LIGHT_PAGE_BG, border: LIGHT_RULE, text: LIGHT_INK_MUTED };

function lightExecutedColor(pct: number): string {
    if (pct >= 90) {
        return LIGHT_OUTCOME_COLORS.Passed;
    }

    if (pct < 30) {
        return LIGHT_STILL_OPEN;
    }

    return LIGHT_KPI[2].accent;
}

function lightKpiTile(value: string, kpiIndex: number, label: string): string {
    const { bg, accent } = LIGHT_KPI[kpiIndex];

    return (
        `<td width="25%" style="padding:4px;">` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${bg}" style="background-color:${bg};border-radius:6px;border-top:3px solid ${accent};">` +
        `<tr><td align="center" style="padding:10px 4px;font-family:${EMAIL_FONT_FAMILY};">` +
        `<div style="font-size:20px;font-weight:700;color:${accent};line-height:1.2;">${escapeHtml(value)}</div>` +
        `<div style="font-size:10px;letter-spacing:0.02em;text-transform:uppercase;color:${LIGHT_INK_MUTED};margin-top:2px;">${escapeHtml(label)}</div>` +
        `</td></tr></table></td>`
    );
}

// Renders a horizontal stacked bar as a single-row table, one <td> per
// segment sized by width % - the same "colored table cells" trick the
// reference OWA email itself uses, since flexbox/grid segments (as used by
// the live SuiteProgressBar/StatusReportCard components) aren't supported by
// Outlook's Word rendering engine.
function lightProgressTrack(
    segments: { color: string; pct: number }[],
    heightPx: number
): string {
    const cells = segments
        .filter((segment) => segment.pct > 0)
        .map(
            (segment) =>
                `<td width="${segment.pct}%" bgcolor="${segment.color}" style="background-color:${segment.color};font-size:1px;line-height:${heightPx}px;">&nbsp;</td>`
        )
        .join("");

    return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${LIGHT_RULE}" style="background-color:${LIGHT_RULE};border-radius:${heightPx / 2}px;">` +
        `<tr>${cells}</tr></table>`
    );
}

function lightSuiteRow(group: SuiteProgressGroup, t: TranslateFn): string {
    const { totalTestCases, outcomeCounts, label } = group;
    const executed = totalTestCases - outcomeCounts.NotRun;
    const executedPct = totalTestCases
        ? Math.round((executed / totalTestCases) * 100)
        : 0;
    const decided = outcomeCounts.Passed + outcomeCounts.Failed;
    const passRate = decided
        ? Math.round((outcomeCounts.Passed / decided) * 100)
        : 0;

    const legendEntries = EMAIL_OUTCOME_ORDER.filter(
        (outcome) => outcomeCounts[outcome] > 0
    );
    const segments = legendEntries.map((outcome) => ({
        color: LIGHT_OUTCOME_COLORS[outcome],
        pct: totalTestCases ? (outcomeCounts[outcome] / totalTestCases) * 100 : 0,
    }));

    const legendText = legendEntries
        .map(
            (outcome) =>
                `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background-color:${LIGHT_OUTCOME_COLORS[outcome]};margin-right:3px;">&nbsp;</span>` +
                `${outcomeCounts[outcome]} ${escapeHtml(t(`outcome.${outcome}`))}`
        )
        .join(`<span style="color:${LIGHT_RULE};"> | </span>`);

    return (
        `<div style="margin-top:12px;font-family:${EMAIL_FONT_FAMILY};">` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
        `<td style="font-weight:600;font-size:13px;color:${LIGHT_INK};" align="left">${escapeHtml(label)} – ${escapeHtml(t("defectManagementPage.sprintReport.statusCard.casesCount", { count: totalTestCases }))}</td>` +
        `<td style="font-size:12px;font-weight:700;color:${lightExecutedColor(executedPct)};white-space:nowrap;" align="right">${executedPct}% ${escapeHtml(t("defectManagementPage.sprintReport.statusCard.executed"))}</td>` +
        `</tr></table>` +
        `<div style="margin-top:4px;">${lightProgressTrack(segments, 9)}</div>` +
        `<div style="font-size:12px;color:${LIGHT_INK_MUTED};margin-top:4px;">${legendText}<span style="color:${LIGHT_RULE};"> | </span><strong style="color:${LIGHT_INK};">${escapeHtml(t("defectManagementPage.sprintReport.statusCard.passRate"))}: ${passRate}%</strong></div>` +
        `</div>`
    );
}

// Builds the sprint status card as genuine HTML tables with inline styles
// (rather than an html2canvas screenshot embedded via <img>, the previous
// approach), so it renders as crisp, selectable text/links in Outlook,
// Gmail, etc. Mirrors StatusReportCard.tsx's layout/math field-for-field so
// the emailed card and the on-screen preview stay visually consistent (the
// on-screen card and the PPTX export are still fixed-dark by design; only
// this emailed copy uses the light palette).
export function buildStatusReportCardEmailBodyHtml(
    data: StatusReportCardEmailData,
    t: TranslateFn
): string {
    const {
        headerTitle,
        headerSubtitle,
        suiteGroups,
        report,
        alertText,
        actionsText,
        dashboardUrl,
    } = data;

    const { datePart, timePart } = formatEmailTimestamp(new Date());

    const totalTestCases = suiteGroups.reduce(
        (sum, group) => sum + group.totalTestCases,
        0
    );
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

    const bugsClosed = report.byStatusAll.Closed ?? 0;
    const bugsClosedPct = report.total
        ? Math.round((bugsClosed / report.total) * 100)
        : 0;
    const stillOpen = report.total - bugsClosed;

    const criticalCount = Object.entries(report.bySeverity)
        .filter(([key]) => severityRank(key) === 1)
        .reduce((sum, [, count]) => sum + count, 0);

    const statusEntries = EMAIL_STATUS_ORDER.map(
        (name) => [name, report.byStatusAll[name] ?? 0] as const
    ).filter(([, count]) => count > 0);

    const severityEntries = Object.entries(report.bySeverity).sort(
        ([a], [b]) => severityRank(a) - severityRank(b)
    );

    const actionParagraphs = actionsText
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

    const bugSources = [...suiteGroups.map((group) => group.label), "DSI"].join(
        ", "
    );

    const alertHtml = alertText
        ? `<tr><td style="padding:14px 20px 0 20px;">` +
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${LIGHT_ALERT_BG}" style="background-color:${LIGHT_ALERT_BG};border-radius:6px;">` +
          `<tr><td style="border-left:4px solid ${LIGHT_ALERT_BORDER};padding:10px 12px;font-size:13px;line-height:1.4;color:${LIGHT_ALERT_TEXT};font-family:${EMAIL_FONT_FAMILY};">⚠️ ${escapeHtml(alertText)}</td></tr>` +
          `</table></td></tr>`
        : "";

    const kpiHtml =
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
        lightKpiTile(
            String(totalTestCases),
            0,
            t("defectManagementPage.sprintReport.statusCard.kpis.totalTestCases")
        ) +
        lightKpiTile(
            `${passRate}%`,
            1,
            t("defectManagementPage.sprintReport.statusCard.kpis.passRate")
        ) +
        lightKpiTile(
            `${bugsClosed}/${report.total}`,
            2,
            t("defectManagementPage.sprintReport.statusCard.kpis.bugsClosed", {
                percent: bugsClosedPct,
            })
        ) +
        lightKpiTile(
            String(criticalCount),
            3,
            t("defectManagementPage.sprintReport.statusCard.kpis.criticalBugs")
        ) +
        `</tr></table>`;

    const dashboardHtml = dashboardUrl
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px auto 0;"><tr>` +
          `<td bgcolor="${LIGHT_BUTTON_BG}" style="background-color:${LIGHT_BUTTON_BG};border-radius:6px;">` +
          `<a href="${escapeHtml(dashboardUrl)}" target="_blank" rel="noreferrer" style="display:block;padding:10px 16px;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;font-family:${EMAIL_FONT_FAMILY};">${escapeHtml(t("defectManagementPage.sprintReport.statusCard.openDashboard"))}</a>` +
          `</td></tr></table>`
        : "";

    const actionsHtml = actionParagraphs.length
        ? `<div style="font-size:14px;font-weight:600;color:${LIGHT_INK};margin-top:18px;font-family:${EMAIL_FONT_FAMILY};">${escapeHtml(t("defectManagementPage.sprintReport.statusCard.actionsTitle"))}</div>` +
          actionParagraphs
              .map((paragraph, index) => {
                  const palette =
                      LIGHT_ACTION_PALETTE[index % LIGHT_ACTION_PALETTE.length];
                  const { lead, rest } = splitEmailActionLeadIn(paragraph);

                  return (
                      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.bg}" style="background-color:${palette.bg};border-radius:6px;margin-top:8px;">` +
                      `<tr><td style="border-left:4px solid ${palette.border};padding:10px 12px;font-size:13px;line-height:1.4;color:${LIGHT_INK};font-family:${EMAIL_FONT_FAMILY};">` +
                      (lead ? `<strong>${escapeHtml(lead)}</strong> ` : "") +
                      `${escapeHtml(rest)}</td></tr></table>`
                  );
              })
              .join("")
        : "";

    const suiteProgressHtml =
        `<div style="font-size:14px;font-weight:600;color:${LIGHT_INK};margin-top:18px;font-family:${EMAIL_FONT_FAMILY};">${escapeHtml(t("defectManagementPage.sprintReport.statusCard.suiteProgressTitle"))}</div>` +
        (suiteGroups.length > 0
            ? suiteGroups.map((group) => lightSuiteRow(group, t)).join("")
            : `<div style="font-size:12px;color:${LIGHT_INK_MUTED};font-style:italic;margin-top:8px;font-family:${EMAIL_FONT_FAMILY};">${escapeHtml(t("defectManagementPage.sprintReport.statusCard.noPlanSelected"))}</div>`);

    const statusLegendHtml = statusEntries
        .map(
            ([name, count]) =>
                `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background-color:${LIGHT_STATUS_COLORS[name]};margin-right:3px;">&nbsp;</span>` +
                `${count} ${escapeHtml(t(`defectManagementPage.sprintReport.statusCard.statusLabels.${EMAIL_STATUS_LABEL_KEYS[name]}`))}`
        )
        .join(`<span style="color:${LIGHT_RULE};"> | </span>`);

    const statusSegments = statusEntries.map(([name, count]) => ({
        color: LIGHT_STATUS_COLORS[name],
        pct: report.total ? (count / report.total) * 100 : 0,
    }));

    const severityHtml = severityEntries.length
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;"><tr>` +
          severityEntries
              .map(([raw, count]) => {
                  const rank = severityRank(raw);
                  const palette =
                      LIGHT_SEVERITY_PALETTE[rank - 1] ?? LIGHT_SEVERITY_FALLBACK;
                  const width = Math.floor(100 / severityEntries.length);

                  return (
                      `<td width="${width}%" style="padding:3px;">` +
                      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.bg}" style="background-color:${palette.bg};border:1px solid ${palette.border};border-radius:6px;">` +
                      `<tr><td align="center" style="padding:8px 4px;font-family:${EMAIL_FONT_FAMILY};">` +
                      `<div style="font-size:18px;font-weight:700;color:${palette.text};">${count}</div>` +
                      `<div style="font-size:11px;color:${palette.text};">${escapeHtml(emailSeverityLabel(raw))}</div>` +
                      `</td></tr></table></td>`
                  );
              })
              .join("") +
          `</tr></table>` +
          `<div style="font-size:11px;color:${LIGHT_INK_MUTED};text-align:center;margin-top:4px;font-family:${EMAIL_FONT_FAMILY};">${escapeHtml(t("defectManagementPage.sprintReport.statusCard.severityCaption", { count: report.effectiveCount }))}</div>`
        : "";

    const bugStatusHtml =
        `<div style="margin-top:18px;font-family:${EMAIL_FONT_FAMILY};">` +
        `<div style="font-size:14px;font-weight:600;color:${LIGHT_INK};">🐛 ${escapeHtml(t("defectManagementPage.sprintReport.statusCard.bugStatusTitle"))}</div>` +
        `<div style="font-size:11px;color:${LIGHT_INK_MUTED};margin-top:2px;">${escapeHtml(t("defectManagementPage.sprintReport.statusCard.bugStatusSubtitle", { sources: bugSources }))}</div>` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;"><tr>` +
        `<td style="font-size:13px;color:${LIGHT_INK};" align="left"><strong>${escapeHtml(t("defectManagementPage.sprintReport.statusCard.bugsDetected", { count: report.total }))}</strong> – ${escapeHtml(t("defectManagementPage.sprintReport.statusCard.bugStatusSummary", { effective: report.effectiveCount, outOfScope: report.outOfScopeCount }))}</td>` +
        `<td style="font-size:13px;font-weight:700;color:${LIGHT_STILL_OPEN};white-space:nowrap;" align="right">${escapeHtml(t("defectManagementPage.sprintReport.statusCard.stillOpen", { count: stillOpen }))}</td>` +
        `</tr></table>` +
        `<div style="margin-top:6px;">${lightProgressTrack(statusSegments, 10)}</div>` +
        `<div style="font-size:12px;color:${LIGHT_INK_MUTED};margin-top:4px;">${statusLegendHtml}</div>` +
        severityHtml +
        `</div>`;

    return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${LIGHT_PAGE_BG}" style="background-color:${LIGHT_PAGE_BG};padding:16px 0;">` +
        `<tr><td align="center">` +
        `<table role="presentation" width="${EMAIL_CARD_WIDTH}" cellpadding="0" cellspacing="0" border="0" bgcolor="${LIGHT_CARD_BG}" style="width:${EMAIL_CARD_WIDTH}px;max-width:100%;background-color:${LIGHT_CARD_BG};border-radius:8px;color:${LIGHT_INK};border:1px solid ${LIGHT_RULE};">` +
        `<tr><td bgcolor="${LIGHT_HEADER_BG}" style="background-color:${LIGHT_HEADER_BG};padding:16px 20px;border-radius:7px 7px 0 0;">` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
        `<td style="font-size:17px;font-weight:700;color:#ffffff;font-family:${EMAIL_FONT_FAMILY};" align="left">${escapeHtml(headerTitle)}</td>` +
        `<td style="font-size:11px;color:${LIGHT_HEADER_SUB};white-space:nowrap;font-family:${EMAIL_FONT_FAMILY};" align="right">${escapeHtml(t("defectManagementPage.sprintReport.statusCard.updatedAt", { date: datePart, time: timePart }))}</td>` +
        `</tr><tr><td colspan="2" style="font-size:12px;color:${LIGHT_HEADER_SUB};padding-top:2px;font-family:${EMAIL_FONT_FAMILY};">${escapeHtml(headerSubtitle)}</td></tr>` +
        `</table></td></tr>` +
        alertHtml +
        `<tr><td style="padding:18px 20px;">` +
        kpiHtml +
        dashboardHtml +
        actionsHtml +
        suiteProgressHtml +
        bugStatusHtml +
        `</td></tr>` +
        `</table></td></tr></table>`
    );
}

// Wraps the fragment as a standalone document so it opens/renders correctly
// on its own (fonts, background) when the downloaded file is opened directly
// in a browser - the intended flow is: open the file, select-all, copy, then
// paste into the email client's rich-text compose box, which carries the
// table markup/inline styles over as real HTML rather than plain text.
function buildStatusReportCardEmailDocument(bodyHtml: string): string {
    return (
        `<!doctype html>` +
        `<html><head><meta charset="utf-8" />` +
        `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
        `<title>Sprint Status Card</title></head>` +
        `<body style="margin:0;padding:0;">${bodyHtml}</body></html>`
    );
}

export function downloadStatusReportCardEmailHtml(
    filename: string,
    data: StatusReportCardEmailData,
    t: TranslateFn
): void {
    const bodyHtml = buildStatusReportCardEmailBodyHtml(data, t);
    const documentHtml = buildStatusReportCardEmailDocument(bodyHtml);
    const blob = new Blob([documentHtml], { type: "text/html;charset=utf-8;" });
    downloadBlob(blob, filename);
}

// pptxgenjs colors are plain hex without the "#".
function pptxColor(hex: string): string {
    return hex.replace("#", "");
}

const PPTX_CARD_WIDTH = 7.5;
const PPTX_MARGIN = 0.35;
const PPTX_CONTENT_WIDTH = PPTX_CARD_WIDTH - PPTX_MARGIN * 2;
const PPTX_FONT = "Segoe UI";

export type StatusReportCardTheme = "dark" | "light";

interface PptxPalette {
    bg: string;
    headerBg: string;
    headerSub: string;
    ink: string;
    inkMuted: string;
    mutedCaption: string;
    alertBg: string;
    alertBorder: string;
    alertText: string;
    kpi: { bg: string; accent: string }[];
    buttonBg: string;
    actionPalette: { bg: string; border: string }[];
    trackBg: string;
    outcomeColors: Record<Outcome, string>;
    executedColor: (pct: number) => string;
    statusColors: Record<string, string>;
    stillOpen: string;
    severityPalette: { bg: string; border: string; text: string }[];
    severityFallback: { bg: string; border: string; text: string };
}

// Same shape, two instances - the dark one reuses the EMAIL_* constants the
// on-screen StatusReportCard/PPTX have always used; the light one reuses the
// LIGHT_* constants the emailed HTML card uses (see the comment above those
// for where that palette actually comes from). buildStatusReportCardPptx
// picks one by its `theme` argument rather than hardcoding colors inline.
const PPTX_DARK_PALETTE: PptxPalette = {
    bg: pptxColor("#1f1f1f"),
    headerBg: pptxColor("#3e4a68"),
    headerSub: pptxColor("#c3c9d9"),
    ink: pptxColor("#f3f2f1"),
    inkMuted: pptxColor("#c8c6c4"),
    mutedCaption: pptxColor("#8a8886"),
    alertBg: pptxColor("#3d2f14"),
    alertBorder: pptxColor("#eda100"),
    alertText: pptxColor("#f3f2f1"),
    kpi: [
        { bg: pptxColor("#2d2d2d"), accent: pptxColor("#3aa0f3") },
        { bg: pptxColor("#2d2d2d"), accent: pptxColor("#6bcf6b") },
        { bg: pptxColor("#2d2d2d"), accent: pptxColor("#f2b134") },
        { bg: pptxColor("#2d2d2d"), accent: pptxColor("#ff6b6b") },
    ],
    buttonBg: pptxColor("#0078d4"),
    actionPalette: EMAIL_ACTION_PALETTE.map((p) => ({
        bg: pptxColor(p.bg),
        border: pptxColor(p.border),
    })),
    trackBg: pptxColor("#3b3a39"),
    outcomeColors: {
        Passed: pptxColor(EMAIL_OUTCOME_COLORS.Passed),
        Failed: pptxColor(EMAIL_OUTCOME_COLORS.Failed),
        Blocked: pptxColor(EMAIL_OUTCOME_COLORS.Blocked),
        NotApplicable: pptxColor(EMAIL_OUTCOME_COLORS.NotApplicable),
        Paused: pptxColor(EMAIL_OUTCOME_COLORS.Paused),
        InProgress: pptxColor(EMAIL_OUTCOME_COLORS.InProgress),
        NotRun: pptxColor(EMAIL_OUTCOME_COLORS.NotRun),
    },
    executedColor: (pct) => pptxColor(emailExecutedColor(pct)),
    statusColors: Object.fromEntries(
        Object.entries(EMAIL_STATUS_COLORS).map(([key, value]) => [
            key,
            pptxColor(value),
        ])
    ),
    stillOpen: pptxColor("#e8746c"),
    severityPalette: EMAIL_SEVERITY_PALETTE.map((p) => ({
        bg: pptxColor(p.bg),
        border: pptxColor(p.border),
        text: pptxColor(p.text),
    })),
    severityFallback: {
        bg: pptxColor(EMAIL_SEVERITY_FALLBACK.bg),
        border: pptxColor(EMAIL_SEVERITY_FALLBACK.border),
        text: pptxColor(EMAIL_SEVERITY_FALLBACK.text),
    },
};

const PPTX_LIGHT_PALETTE: PptxPalette = {
    bg: pptxColor(LIGHT_CARD_BG),
    headerBg: pptxColor(LIGHT_HEADER_BG),
    headerSub: pptxColor(LIGHT_HEADER_SUB),
    ink: pptxColor(LIGHT_INK),
    inkMuted: pptxColor(LIGHT_INK_MUTED),
    mutedCaption: pptxColor(LIGHT_INK_MUTED),
    alertBg: pptxColor(LIGHT_ALERT_BG),
    alertBorder: pptxColor(LIGHT_ALERT_BORDER),
    alertText: pptxColor(LIGHT_ALERT_TEXT),
    kpi: LIGHT_KPI.map((k) => ({ bg: pptxColor(k.bg), accent: pptxColor(k.accent) })),
    buttonBg: pptxColor(LIGHT_BUTTON_BG),
    actionPalette: LIGHT_ACTION_PALETTE.map((p) => ({
        bg: pptxColor(p.bg),
        border: pptxColor(p.border),
    })),
    trackBg: pptxColor(LIGHT_RULE),
    outcomeColors: {
        Passed: pptxColor(LIGHT_OUTCOME_COLORS.Passed),
        Failed: pptxColor(LIGHT_OUTCOME_COLORS.Failed),
        Blocked: pptxColor(LIGHT_OUTCOME_COLORS.Blocked),
        NotApplicable: pptxColor(LIGHT_OUTCOME_COLORS.NotApplicable),
        Paused: pptxColor(LIGHT_OUTCOME_COLORS.Paused),
        InProgress: pptxColor(LIGHT_OUTCOME_COLORS.InProgress),
        NotRun: pptxColor(LIGHT_OUTCOME_COLORS.NotRun),
    },
    executedColor: (pct) => pptxColor(lightExecutedColor(pct)),
    statusColors: Object.fromEntries(
        Object.entries(LIGHT_STATUS_COLORS).map(([key, value]) => [
            key,
            pptxColor(value),
        ])
    ),
    stillOpen: pptxColor(LIGHT_STILL_OPEN),
    severityPalette: LIGHT_SEVERITY_PALETTE.map((p) => ({
        bg: pptxColor(p.bg),
        border: pptxColor(p.border),
        text: pptxColor(p.text),
    })),
    severityFallback: {
        bg: pptxColor(LIGHT_SEVERITY_FALLBACK.bg),
        border: pptxColor(LIGHT_SEVERITY_FALLBACK.border),
        text: pptxColor(LIGHT_SEVERITY_FALLBACK.text),
    },
};

// PowerPoint text boxes don't auto-size to content, so section heights are
// estimated from character count/line count instead of measured - generous
// enough for this card's typical content (2-3 suite rows, 1-2 action
// paragraphs, 3 severity chips). Everything is a native, editable shape, so
// a viewer can nudge box heights in PowerPoint if a given report's text runs
// longer than usual - the point is a real editable starting point, not a
// pixel-perfect replica.
function estimateLines(text: string, charsPerLine: number): number {
    return Math.max(1, Math.ceil(text.length / charsPerLine));
}

export async function buildStatusReportCardPptx(
    data: StatusReportCardEmailData,
    t: TranslateFn,
    theme: StatusReportCardTheme = "light"
): Promise<InstanceType<typeof PptxGenJS>> {
    const palette = theme === "light" ? PPTX_LIGHT_PALETTE : PPTX_DARK_PALETTE;

    const {
        headerTitle,
        headerSubtitle,
        suiteGroups,
        report,
        alertText,
        actionsText,
        dashboardUrl,
    } = data;

    const { datePart, timePart } = formatEmailTimestamp(new Date());

    const totalTestCases = suiteGroups.reduce(
        (sum, group) => sum + group.totalTestCases,
        0
    );
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

    const bugsClosed = report.byStatusAll.Closed ?? 0;
    const bugsClosedPct = report.total
        ? Math.round((bugsClosed / report.total) * 100)
        : 0;
    const stillOpen = report.total - bugsClosed;

    const criticalCount = Object.entries(report.bySeverity)
        .filter(([key]) => severityRank(key) === 1)
        .reduce((sum, [, count]) => sum + count, 0);

    const statusEntries = EMAIL_STATUS_ORDER.map(
        (name) => [name, report.byStatusAll[name] ?? 0] as const
    ).filter(([, count]) => count > 0);

    const severityEntries = Object.entries(report.bySeverity).sort(
        ([a], [b]) => severityRank(a) - severityRank(b)
    );

    const actionParagraphs = actionsText
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

    const bugSources = [...suiteGroups.map((group) => group.label), "DSI"].join(
        ", "
    );

    // Height is a running estimate rather than fixed, so the slide is sized
    // to fit this specific report's content (suite count, action paragraph
    // count, severity chip count) instead of clipping or leaving a lot of
    // empty canvas.
    let height = 1.02; // header
    if (alertText) {
        height += 0.2 + estimateLines(alertText, 95) * 0.16 + 0.1;
    }
    height += 0.97; // KPI row
    if (dashboardUrl) {
        height += 0.42;
    }
    if (actionParagraphs.length > 0) {
        height += 0.22;
        for (const paragraph of actionParagraphs) {
            height += 0.15 + estimateLines(paragraph, 95) * 0.16 + 0.08;
        }
    }
    height += 0.24 + suiteGroups.length * 0.54;
    height += 0.68; // bug status header + summary + track + legend
    if (severityEntries.length > 0) {
        height += 0.73;
    }
    height += PPTX_MARGIN;

    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: "STATUS_CARD", width: PPTX_CARD_WIDTH, height });
    pptx.layout = "STATUS_CARD";

    const slide = pptx.addSlide();
    slide.background = { color: palette.bg };

    let y = 0;

    // Header
    const headerHeight = 0.9;

    slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: PPTX_CARD_WIDTH,
        h: headerHeight,
        fill: { color: palette.headerBg },
        line: { type: "none" },
    });
    slide.addText(headerTitle, {
        x: PPTX_MARGIN,
        y: 0.14,
        w: PPTX_CONTENT_WIDTH - 1.6,
        h: 0.3,
        fontFace: PPTX_FONT,
        fontSize: 13,
        bold: true,
        color: "FFFFFF",
        align: "left",
        valign: "top",
        autoFit: true,
        shrinkText: true,
    });
    slide.addText(
        t("defectManagementPage.sprintReport.statusCard.updatedAt", {
            date: datePart,
            time: timePart,
        }),
        {
            x: PPTX_CARD_WIDTH - PPTX_MARGIN - 1.6,
            y: 0.15,
            w: 1.6,
            h: 0.25,
            fontFace: PPTX_FONT,
            fontSize: 8,
            color: palette.headerSub,
            align: "right",
            valign: "top",
            autoFit: true,
            shrinkText: true,
        }
    );
    slide.addText(headerSubtitle, {
        x: PPTX_MARGIN,
        y: 0.48,
        w: PPTX_CONTENT_WIDTH,
        h: 0.35,
        fontFace: PPTX_FONT,
        fontSize: 9,
        color: palette.headerSub,
        align: "left",
        valign: "top",
        autoFit: true,
        shrinkText: true,
    });
    y = headerHeight + 0.12;

    // Alert banner
    if (alertText) {
        const lines = estimateLines(alertText, 95);
        const boxH = 0.2 + lines * 0.16;

        slide.addShape(pptx.ShapeType.rect, {
            x: PPTX_MARGIN,
            y,
            w: PPTX_CONTENT_WIDTH,
            h: boxH,
            fill: { color: palette.alertBg },
            line: { type: "none" },
        });
        slide.addShape(pptx.ShapeType.rect, {
            x: PPTX_MARGIN,
            y,
            w: 0.04,
            h: boxH,
            fill: { color: palette.alertBorder },
            line: { type: "none" },
        });
        slide.addText(`⚠️ ${alertText}`, {
            x: PPTX_MARGIN + 0.12,
            y: y + 0.03,
            w: PPTX_CONTENT_WIDTH - 0.24,
            h: boxH - 0.06,
            fontFace: PPTX_FONT,
            fontSize: 9,
            color: palette.alertText,
            align: "left",
            valign: "top",
        });
        y += boxH + 0.1;
    }

    // KPI tiles
    const kpis: [string, string][] = [
        [
            String(totalTestCases),
            t("defectManagementPage.sprintReport.statusCard.kpis.totalTestCases"),
        ],
        [
            `${passRate}%`,
            t("defectManagementPage.sprintReport.statusCard.kpis.passRate"),
        ],
        [
            `${bugsClosed}/${report.total}`,
            t("defectManagementPage.sprintReport.statusCard.kpis.bugsClosed", {
                percent: bugsClosedPct,
            }),
        ],
        [
            String(criticalCount),
            t("defectManagementPage.sprintReport.statusCard.kpis.criticalBugs"),
        ],
    ];

    const kpiGap = 0.08;
    const kpiWidth = (PPTX_CONTENT_WIDTH - kpiGap * 3) / 4;
    const kpiHeight = 0.85;

    kpis.forEach(([value, label], index) => {
        const x = PPTX_MARGIN + index * (kpiWidth + kpiGap);
        const { bg, accent } = palette.kpi[index];

        slide.addShape(pptx.ShapeType.roundRect, {
            x,
            y,
            w: kpiWidth,
            h: kpiHeight,
            rectRadius: 0.06,
            fill: { color: bg },
            line: { type: "none" },
        });
        slide.addText(value, {
            x,
            y: y + 0.12,
            w: kpiWidth,
            h: 0.35,
            fontFace: PPTX_FONT,
            fontSize: 16,
            bold: true,
            color: accent,
            align: "center",
        });
        slide.addText(label.toUpperCase(), {
            x: x + 0.04,
            y: y + 0.5,
            w: kpiWidth - 0.08,
            h: 0.3,
            fontFace: PPTX_FONT,
            fontSize: 7,
            color: palette.inkMuted,
            align: "center",
            valign: "top",
        });
    });
    y += kpiHeight + 0.15;

    // Dashboard button (as a hyperlinked shape)
    if (dashboardUrl) {
        const buttonW = 2.6;

        slide.addShape(pptx.ShapeType.roundRect, {
            x: PPTX_MARGIN + (PPTX_CONTENT_WIDTH - buttonW) / 2,
            y,
            w: buttonW,
            h: 0.32,
            rectRadius: 0.05,
            fill: { color: palette.buttonBg },
            line: { type: "none" },
        });
        slide.addText(
            t("defectManagementPage.sprintReport.statusCard.openDashboard"),
            {
                x: PPTX_MARGIN + (PPTX_CONTENT_WIDTH - buttonW) / 2,
                y,
                w: buttonW,
                h: 0.32,
                fontFace: PPTX_FONT,
                fontSize: 10,
                bold: true,
                color: "FFFFFF",
                align: "center",
                valign: "middle",
                hyperlink: { url: dashboardUrl },
            }
        );
        y += 0.32 + 0.15;
    }

    // Actions Required
    if (actionParagraphs.length > 0) {
        slide.addText(
            t("defectManagementPage.sprintReport.statusCard.actionsTitle"),
            {
                x: PPTX_MARGIN,
                y,
                w: PPTX_CONTENT_WIDTH,
                h: 0.25,
                fontFace: PPTX_FONT,
                fontSize: 12,
                bold: true,
                color: palette.ink,
                align: "left",
            }
        );
        y += 0.3;

        actionParagraphs.forEach((paragraph, index) => {
            const actionColors =
                palette.actionPalette[index % palette.actionPalette.length];
            const { lead, rest } = splitEmailActionLeadIn(paragraph);
            const lines = estimateLines(paragraph, 95);
            const boxH = 0.15 + lines * 0.16;

            slide.addShape(pptx.ShapeType.rect, {
                x: PPTX_MARGIN,
                y,
                w: PPTX_CONTENT_WIDTH,
                h: boxH,
                fill: { color: actionColors.bg },
                line: { type: "none" },
            });
            slide.addShape(pptx.ShapeType.rect, {
                x: PPTX_MARGIN,
                y,
                w: 0.04,
                h: boxH,
                fill: { color: actionColors.border },
                line: { type: "none" },
            });
            slide.addText(
                lead
                    ? [
                          { text: `${lead} `, options: { bold: true } },
                          { text: rest, options: {} },
                      ]
                    : rest,
                {
                    x: PPTX_MARGIN + 0.12,
                    y: y + 0.03,
                    w: PPTX_CONTENT_WIDTH - 0.24,
                    h: boxH - 0.06,
                    fontFace: PPTX_FONT,
                    fontSize: 9,
                    color: palette.ink,
                    align: "left",
                    valign: "top",
                }
            );
            y += boxH + 0.12;
        });
    }

    // Test Execution Progress
    y += 0.15;
    slide.addText(
        t("defectManagementPage.sprintReport.statusCard.suiteProgressTitle"),
        {
            x: PPTX_MARGIN,
            y,
            w: PPTX_CONTENT_WIDTH,
            h: 0.25,
            fontFace: PPTX_FONT,
            fontSize: 12,
            bold: true,
            color: palette.ink,
            align: "left",
        }
    );
    y += 0.32;

    for (const group of suiteGroups) {
        const { totalTestCases: groupTotal, outcomeCounts, label } = group;
        const executed = groupTotal - outcomeCounts.NotRun;
        const executedPct = groupTotal
            ? Math.round((executed / groupTotal) * 100)
            : 0;
        const decided = outcomeCounts.Passed + outcomeCounts.Failed;
        const passRateForGroup = decided
            ? Math.round((outcomeCounts.Passed / decided) * 100)
            : 0;

        slide.addText(
            `${label} – ${t(
                "defectManagementPage.sprintReport.statusCard.casesCount",
                { count: groupTotal }
            )}`,
            {
                x: PPTX_MARGIN,
                y,
                w: PPTX_CONTENT_WIDTH - 1.4,
                h: 0.2,
                fontFace: PPTX_FONT,
                fontSize: 9,
                bold: true,
                color: palette.ink,
                align: "left",
            }
        );
        slide.addText(
            `${executedPct}% ${t("defectManagementPage.sprintReport.statusCard.executed")}`,
            {
                x: PPTX_CARD_WIDTH - PPTX_MARGIN - 1.4,
                y,
                w: 1.4,
                h: 0.2,
                fontFace: PPTX_FONT,
                fontSize: 9,
                bold: true,
                color: palette.executedColor(executedPct),
                align: "right",
            }
        );
        y += 0.22;

        const trackY = y;
        const trackH = 0.09;

        slide.addShape(pptx.ShapeType.roundRect, {
            x: PPTX_MARGIN,
            y: trackY,
            w: PPTX_CONTENT_WIDTH,
            h: trackH,
            rectRadius: 0.02,
            fill: { color: palette.trackBg },
            line: { type: "none" },
        });

        const legendEntries = EMAIL_OUTCOME_ORDER.filter(
            (outcome) => outcomeCounts[outcome] > 0
        );
        let segX = PPTX_MARGIN;

        for (const outcome of legendEntries) {
            const segW = groupTotal
                ? (outcomeCounts[outcome] / groupTotal) * PPTX_CONTENT_WIDTH
                : 0;

            if (segW > 0) {
                slide.addShape(pptx.ShapeType.rect, {
                    x: segX,
                    y: trackY,
                    w: segW,
                    h: trackH,
                    fill: { color: palette.outcomeColors[outcome] },
                    line: { type: "none" },
                });
            }

            segX += segW;
        }
        y += trackH + 0.06;

        const legendText = legendEntries
            .map((outcome) => `${outcomeCounts[outcome]} ${t(`outcome.${outcome}`)}`)
            .concat(
                `${t("defectManagementPage.sprintReport.statusCard.passRate")}: ${passRateForGroup}%`
            )
            .join("   ·   ");

        slide.addText(legendText, {
            x: PPTX_MARGIN,
            y,
            w: PPTX_CONTENT_WIDTH,
            h: 0.2,
            fontFace: PPTX_FONT,
            fontSize: 8,
            color: palette.inkMuted,
            align: "left",
        });
        y += 0.28;
    }

    // Bug Status
    y += 0.1;
    slide.addText(
        `🐛 ${t("defectManagementPage.sprintReport.statusCard.bugStatusTitle")}`,
        {
            x: PPTX_MARGIN,
            y,
            w: PPTX_CONTENT_WIDTH,
            h: 0.25,
            fontFace: PPTX_FONT,
            fontSize: 12,
            bold: true,
            color: palette.ink,
            align: "left",
        }
    );
    y += 0.25;
    slide.addText(
        t("defectManagementPage.sprintReport.statusCard.bugStatusSubtitle", {
            sources: bugSources,
        }),
        {
            x: PPTX_MARGIN,
            y,
            w: PPTX_CONTENT_WIDTH,
            h: 0.2,
            fontFace: PPTX_FONT,
            fontSize: 8,
            color: palette.mutedCaption,
            align: "left",
        }
    );
    y += 0.28;

    slide.addText(
        [
            {
                text: t(
                    "defectManagementPage.sprintReport.statusCard.bugsDetected",
                    { count: report.total }
                ) + " – ",
                options: { bold: true },
            },
            {
                text: t(
                    "defectManagementPage.sprintReport.statusCard.bugStatusSummary",
                    {
                        effective: report.effectiveCount,
                        outOfScope: report.outOfScopeCount,
                    }
                ),
                options: {},
            },
        ],
        {
            x: PPTX_MARGIN,
            y,
            w: PPTX_CONTENT_WIDTH - 1.4,
            h: 0.22,
            fontFace: PPTX_FONT,
            fontSize: 9,
            color: palette.ink,
            align: "left",
        }
    );
    slide.addText(
        t("defectManagementPage.sprintReport.statusCard.stillOpen", {
            count: stillOpen,
        }),
        {
            x: PPTX_CARD_WIDTH - PPTX_MARGIN - 1.4,
            y,
            w: 1.4,
            h: 0.22,
            fontFace: PPTX_FONT,
            fontSize: 9,
            bold: true,
            color: palette.stillOpen,
            align: "right",
        }
    );
    y += 0.28;

    const bugTrackH = 0.1;

    slide.addShape(pptx.ShapeType.roundRect, {
        x: PPTX_MARGIN,
        y,
        w: PPTX_CONTENT_WIDTH,
        h: bugTrackH,
        rectRadius: 0.02,
        fill: { color: palette.trackBg },
        line: { type: "none" },
    });

    let statusSegX = PPTX_MARGIN;

    for (const [name, count] of statusEntries) {
        const segW = report.total
            ? (count / report.total) * PPTX_CONTENT_WIDTH
            : 0;

        if (segW > 0) {
            slide.addShape(pptx.ShapeType.rect, {
                x: statusSegX,
                y,
                w: segW,
                h: bugTrackH,
                fill: { color: palette.statusColors[name] },
                line: { type: "none" },
            });
        }

        statusSegX += segW;
    }
    y += bugTrackH + 0.08;

    const statusLegendText = statusEntries
        .map(
            ([name, count]) =>
                `${count} ${t(
                    `defectManagementPage.sprintReport.statusCard.statusLabels.${EMAIL_STATUS_LABEL_KEYS[name]}`
                )}`
        )
        .join("   ·   ");

    slide.addText(statusLegendText, {
        x: PPTX_MARGIN,
        y,
        w: PPTX_CONTENT_WIDTH,
        h: 0.35,
        fontFace: PPTX_FONT,
        fontSize: 8,
        color: palette.inkMuted,
        align: "left",
        valign: "top",
    });
    y += 0.4;

    // Severity chips
    if (severityEntries.length > 0) {
        const chipGap = 0.08;
        const chipWidth =
            (PPTX_CONTENT_WIDTH - chipGap * (severityEntries.length - 1)) /
            severityEntries.length;
        const chipHeight = 0.55;

        severityEntries.forEach(([raw, count], index) => {
            const rank = severityRank(raw);
            const chipColors =
                palette.severityPalette[rank - 1] ?? palette.severityFallback;
            const x = PPTX_MARGIN + index * (chipWidth + chipGap);

            slide.addShape(pptx.ShapeType.roundRect, {
                x,
                y,
                w: chipWidth,
                h: chipHeight,
                rectRadius: 0.05,
                fill: { color: chipColors.bg },
                line: { color: chipColors.border, width: 0.75 },
            });
            slide.addText(String(count), {
                x,
                y: y + 0.06,
                w: chipWidth,
                h: 0.28,
                fontFace: PPTX_FONT,
                fontSize: 14,
                bold: true,
                color: chipColors.text,
                align: "center",
            });
            slide.addText(emailSeverityLabel(raw), {
                x,
                y: y + 0.34,
                w: chipWidth,
                h: 0.2,
                fontFace: PPTX_FONT,
                fontSize: 8,
                color: chipColors.text,
                align: "center",
            });
        });
        y += chipHeight + 0.1;

        slide.addText(
            t("defectManagementPage.sprintReport.statusCard.severityCaption", {
                count: report.effectiveCount,
            }),
            {
                x: PPTX_MARGIN,
                y,
                w: PPTX_CONTENT_WIDTH,
                h: 0.2,
                fontFace: PPTX_FONT,
                fontSize: 7,
                color: palette.mutedCaption,
                align: "center",
            }
        );
    }

    return pptx;
}

export async function downloadStatusReportCardPptx(
    filename: string,
    data: StatusReportCardEmailData,
    t: TranslateFn,
    theme: StatusReportCardTheme = "light"
): Promise<void> {
    const pptx = await buildStatusReportCardPptx(data, t, theme);
    const blob = (await pptx.write({ outputType: "blob" })) as Blob;
    downloadBlob(blob, filename);
}

export async function buildStatusReportCardEmailPayload(
    element: HTMLElement | null,
    links: StatusReportCardLink[],
    data: StatusReportCardEmailData,
    t: TranslateFn
): Promise<{ pdfBase64: string; bodyHtml: string } | null> {
    // The email body already carries the full card as real HTML (see
    // buildStatusReportCardEmailBodyHtml), so the PDF attachment here is a
    // secondary "as-viewed" copy - a smaller, JPEG-encoded capture keeps the
    // whole message safely under mail-relay size caps (e.g. Mailtrap's
    // default 5MB) without needing scale-2 PNG fidelity.
    const capture = await captureFullCanvas(element, {
        scale: 1,
        jpegQuality: 0.85,
    });

    if (!capture || !element) {
        return null;
    }

    const doc = buildStatusReportCardPdfDoc(capture, element, links);

    return {
        pdfBase64: pdfDocToBase64(doc),
        bodyHtml: buildStatusReportCardEmailBodyHtml(data, t),
    };
}

export function exportPlanProgressToPdf(
    planTitle: string,
    counts: TestPlanProgressCounts,
    bugs: BugInfo[],
    labels: PlanProgressPdfLabels,
    charts: ChartImage[] = []
): void {
    const doc = buildPlanProgressPdfDocument(
        planTitle,
        counts,
        bugs,
        labels,
        charts
    );
    doc.save(buildPlanProgressFilename(planTitle));
}

export function buildPlanProgressPdfBase64(
    planTitle: string,
    counts: TestPlanProgressCounts,
    bugs: BugInfo[],
    labels: PlanProgressPdfLabels,
    charts: ChartImage[] = []
): string {
    const doc = buildPlanProgressPdfDocument(
        planTitle,
        counts,
        bugs,
        labels,
        charts
    );
    return pdfDocToBase64(doc);
}
