import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Tab, TabList, Button, makeStyles, tokens } from "@fluentui/react-components";
import { ArrowDownloadRegular } from "@fluentui/react-icons";
import { PageLayout } from "../components/PageLayout";
import { LoadingCardGrid } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { DefectFilterBar } from "../components/DefectFilterBar";
import { DefectOverviewTab } from "../components/DefectOverviewTab";
import { DefectQualityTab } from "../components/DefectQualityTab";
import { DefectResourceTab } from "../components/DefectResourceTab";
import { SprintDefectReportTab } from "../components/SprintDefectReportTab";
import { fetchDefects } from "../api/client";
import {
    captureChartImage,
    exportSprintDefectReportToPdf,
} from "../utils/export";
import type { ChartImage, SprintDefectReportPdfLabels } from "../utils/export";
import type { DefectFilters } from "../types";

type DefectTab = "overview" | "quality" | "resource" | "sprintReport";

const useStyles = makeStyles({
    toolbar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.spacingHorizontalM,
        flexWrap: "wrap",
    },
});

const EMPTY_FILTERS: DefectFilters = {
    iteration: "",
    area: "",
    environment: "",
    targetVersion: "",
    suites: [],
};

export function DefectManagementPage() {
    const { t } = useTranslation();
    const styles = useStyles();
    const [filters, setFilters] = useState<DefectFilters>(EMPTY_FILTERS);
    const [tab, setTab] = useState<DefectTab>("overview");
    const [isExporting, setIsExporting] = useState(false);

    const originChartRef = useRef<HTMLDivElement>(null);
    const statusChartRef = useRef<HTMLDivElement>(null);
    const severityChartRef = useRef<HTMLDivElement>(null);

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["defects", filters],
        queryFn: () => fetchDefects(filters),
    });

    const handleExportSprintReportPdf = async () => {
        if (!data) {
            return;
        }

        setIsExporting(true);

        try {
            const charts = (
                await Promise.all([
                    captureChartImage(
                        originChartRef.current,
                        t("defectManagementPage.sprintReport.charts.byOrigin")
                    ),
                    captureChartImage(
                        statusChartRef.current,
                        t("defectManagementPage.sprintReport.charts.byStatus")
                    ),
                    captureChartImage(
                        severityChartRef.current,
                        t("defectManagementPage.sprintReport.charts.bySeverity")
                    ),
                ])
            ).filter((chart): chart is ChartImage => chart !== null);

            const labels: SprintDefectReportPdfLabels = {
                title: t("defectManagementPage.sprintReport.title"),
                total: t("defectManagementPage.sprintReport.stats.total"),
                effective: t(
                    "defectManagementPage.sprintReport.stats.effective"
                ),
                outOfScope: t(
                    "defectManagementPage.sprintReport.stats.outOfScope"
                ),
                byOrigin: t(
                    "defectManagementPage.sprintReport.charts.byOrigin"
                ),
                byStatus: t(
                    "defectManagementPage.sprintReport.charts.byStatus"
                ),
                bySeverity: t(
                    "defectManagementPage.sprintReport.charts.bySeverity"
                ),
                countColumn: t(
                    "defectManagementPage.sprintReport.pdf.countColumn"
                ),
            };

            exportSprintDefectReportToPdf(
                t("defectManagementPage.sprintReport.pdf.filename"),
                data.stats.sprintDefectReport,
                labels,
                charts
            );
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <PageLayout title={t("defectManagementPage.title")}>
            {isLoading && <LoadingCardGrid />}

            {isError && (
                <ErrorState message={error.message} onRetry={refetch} />
            )}

            {data && (
                <>
                    <DefectFilterBar
                        availableFilters={data.stats.availableFilters}
                        filters={filters}
                        onChange={setFilters}
                    />

                    <div className={styles.toolbar}>
                        <TabList
                            selectedValue={tab}
                            onTabSelect={(_, item) =>
                                setTab(item.value as DefectTab)
                            }
                        >
                            <Tab value="overview">
                                {t("defectManagementPage.tabs.overview")}
                            </Tab>
                            <Tab value="quality">
                                {t("defectManagementPage.tabs.quality")}
                            </Tab>
                            <Tab value="resource">
                                {t("defectManagementPage.tabs.resource")}
                            </Tab>
                            <Tab value="sprintReport">
                                {t("defectManagementPage.tabs.sprintReport")}
                            </Tab>
                        </TabList>

                        {tab === "sprintReport" && (
                            <Button
                                appearance="secondary"
                                icon={<ArrowDownloadRegular />}
                                disabled={isExporting}
                                onClick={handleExportSprintReportPdf}
                            >
                                {isExporting
                                    ? t("planOverviewPage.exporting")
                                    : t("planOverviewPage.exportPdf")}
                            </Button>
                        )}
                    </div>

                    {tab === "overview" && (
                        <DefectOverviewTab stats={data.stats} />
                    )}
                    {tab === "quality" && (
                        <DefectQualityTab stats={data.stats} />
                    )}
                    {tab === "resource" && (
                        <DefectResourceTab stats={data.stats} />
                    )}
                    {tab === "sprintReport" && (
                        <SprintDefectReportTab
                            stats={data.stats}
                            originChartRef={originChartRef}
                            statusChartRef={statusChartRef}
                            severityChartRef={severityChartRef}
                        />
                    )}
                </>
            )}
        </PageLayout>
    );
}
