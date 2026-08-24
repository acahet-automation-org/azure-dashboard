import type { FluentIcon } from "@fluentui/react-icons";
import {
    FolderRegular,
    GridRegular,
    HistoryRegular,
    ClipboardTaskListLtrRegular,
    DocumentBulletListRegular,
    ArrowTrendingRegular,
    PlayRegular,
    BugRegular,
    DocumentTextRegular,
    PersonRegular,
    DeleteRegular,
    GaugeRegular,
    ErrorCircleRegular,
} from "@fluentui/react-icons";

export interface NavItemConfig {
    key: string;
    labelKey: string;
    path: string;
    enabled: boolean;
    end?: boolean;
    icon: FluentIcon;
}

export const NAV_ITEMS: NavItemConfig[] = [
    {
        key: "suites",
        labelKey: "nav.suites",
        path: "/",
        enabled: false,
        end: true,
        icon: FolderRegular,
    },
    {
        key: "dashboard",
        labelKey: "nav.dashboard",
        path: "/dashboard",
        enabled: true,
        icon: GridRegular,
    },
    {
        key: "runs",
        labelKey: "nav.runs",
        path: "/last-10-runs",
        enabled: false,
        icon: HistoryRegular,
    },
    {
        key: "plans",
        labelKey: "nav.plans",
        path: "/plans",
        enabled: true,
        icon: ClipboardTaskListLtrRegular,
    },
    {
        key: "plan-overview",
        labelKey: "nav.planOverview",
        path: "/plan-overview",
        enabled: false,
        icon: DocumentBulletListRegular,
    },
    {
        key: "plan-progress",
        labelKey: "nav.planProgress",
        path: "/plan-progress",
        enabled: false,
        icon: ArrowTrendingRegular,
    },
    {
        key: "execution",
        labelKey: "nav.execution",
        path: "/test-execution",
        enabled: false,
        icon: PlayRegular,
    },
    {
        key: "defects",
        labelKey: "nav.defects",
        path: "/defects",
        enabled: true,
        icon: BugRegular,
    },
    {
        key: "dynamic-sprint-report",
        labelKey: "nav.dynamicSprintReport",
        path: "/dynamic-sprint-report",
        enabled: true,
        icon: DocumentTextRegular,
    },
    {
        key: "my-work-items",
        labelKey: "nav.myWorkItems",
        path: "/my-work-items",
        enabled: true,
        icon: PersonRegular,
    },
    {
        key: "remove-test-cases",
        labelKey: "nav.removeTestCases",
        path: "/remove-test-cases",
        enabled: false,
        icon: DeleteRegular,
    },
];

export const AUTOMATION_ITEMS: NavItemConfig[] = [
    {
        key: "automation-dashboard",
        labelKey: "nav.automationDashboard",
        path: "/automation-dashboard",
        enabled: true,
        icon: GaugeRegular,
    },
    {
        key: "common-errors",
        labelKey: "nav.commonErrors",
        path: "/common-errors",
        enabled: false,
        icon: ErrorCircleRegular,
    },
];
