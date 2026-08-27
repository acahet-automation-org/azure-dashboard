import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider, webDarkTheme } from "@fluentui/react-components";
import "./i18n";
import { StatusReportCard } from "./components/StatusReportCard";
import type { SprintDefectReport } from "./types";

const STATUS_CARD_WIDTH = 900;

const mockReport: SprintDefectReport = {
    total: 42,
    effectiveCount: 38,
    outOfScopeCount: 4,
    byOrigin: { "Test Factory": 20, DSI: 10 },
    byOriginDetected: { "Test Factory": 22, DSI: 12, Business: 4 },
    byStatus: { Closed: 18, "Da verificare": 5, "In verifica": 3, "In Progress": 6, New: 3, Reopened: 1 },
    byStatusAll: { Closed: 22, "Da verificare": 5, "In verifica": 3, "In Progress": 6, New: 3, Reopened: 1, "Not Applicable": 2 },
    bySeverity: { "1 - Critical": 3, "2 - High": 10, "3 - Medium": 20, "4 - Low": 5 },
    testFactoryBySuite: { "Suite A": 8, "Suite B": 6 },
    testAgentiBySuite: {},
    testBusinessBySuite: {},
    effectiveDefects: [],
    reopenedCount: 1,
    mttrDays: 4.2,
    withoutResolutionDateCount: 2,
};

const mockSuiteGroups = [
    {
        label: "Suite A",
        totalTestCases: 100,
        outcomeCounts: {
            Passed: 60,
            Failed: 10,
            Blocked: 5,
            Paused: 0,
            InProgress: 0,
            NotApplicable: 15,
            NotRun: 10,
        },
    },
];

function Harness() {
    const statusCardRef = useRef<HTMLDivElement>(null);
    const statusCardPreviewRef = useRef<HTMLDivElement>(null);
    const [previewWidth, setPreviewWidth] = useState(0);
    const [cardHeight, setCardHeight] = useState(0);

    useEffect(() => {
        const previewEl = statusCardPreviewRef.current;
        if (!previewEl) return;
        const observer = new ResizeObserver(([entry]) => {
            setPreviewWidth(entry.contentRect.width);
        });
        observer.observe(previewEl);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const cardEl = statusCardRef.current;
        if (!cardEl) return;
        const observer = new ResizeObserver(([entry]) => {
            setCardHeight(entry.contentRect.height);
        });
        observer.observe(cardEl);
        return () => observer.disconnect();
    }, []);

    const previewScale = previewWidth ? Math.min(1, previewWidth / STATUS_CARD_WIDTH) : 1;

    return (
        <div id="preview-row" style={{ display: "flex", justifyContent: "center", overflowX: "auto", padding: 8 }} ref={statusCardPreviewRef}>
            <div
                id="scale-outer"
                style={{
                    width: STATUS_CARD_WIDTH * previewScale,
                    height: cardHeight ? cardHeight * previewScale : undefined,
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        width: STATUS_CARD_WIDTH,
                        transform: `scale(${previewScale})`,
                        transformOrigin: "top left",
                    }}
                >
                    <StatusReportCard
                        ref={statusCardRef}
                        headerTitle="Harness Report"
                        headerSubtitle="Verification run"
                        suiteGroups={mockSuiteGroups as any}
                        report={mockReport}
                        alertText=""
                        actionsText=""
                        includeDsiSource
                    />
                </div>
            </div>
        </div>
    );
}

createRoot(document.getElementById("root")!).render(
    <FluentProvider theme={webDarkTheme}>
        <Harness />
    </FluentProvider>
);
