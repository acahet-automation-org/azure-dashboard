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
    descriptionKey: string;
}

export const NAV_ITEMS: NavItemConfig[] = [
    {
        key: "suites",
        labelKey: "nav.suites",
        path: "/",
        enabled: false,
        end: true,
        icon: FolderRegular,
        descriptionKey: "onboardingGuide.navSections.suites",
    },
    {
        key: "dashboard",
        labelKey: "nav.dashboard",
        path: "/dashboard",
        enabled: true,
        icon: GridRegular,
        descriptionKey: "onboardingGuide.navSections.dashboard",
    },
    {
        key: "runs",
        labelKey: "nav.runs",
        path: "/last-10-runs",
        enabled: false,
        icon: HistoryRegular,
        descriptionKey: "onboardingGuide.navSections.runs",
    },
    {
        key: "plans",
        labelKey: "nav.plans",
        path: "/plans",
        enabled: true,
        icon: ClipboardTaskListLtrRegular,
        descriptionKey: "onboardingGuide.navSections.plans",
    },
    {
        key: "plan-overview",
        labelKey: "nav.planOverview",
        path: "/plan-overview",
        enabled: false,
        icon: DocumentBulletListRegular,
        descriptionKey: "onboardingGuide.navSections.plan-overview",
    },
    {
        key: "plan-progress",
        labelKey: "nav.planProgress",
        path: "/plan-progress",
        enabled: false,
        icon: ArrowTrendingRegular,
        descriptionKey: "onboardingGuide.navSections.plan-progress",
    },
    {
        key: "execution",
        labelKey: "nav.execution",
        path: "/test-execution",
        enabled: false,
        icon: PlayRegular,
        descriptionKey: "onboardingGuide.navSections.execution",
    },
    {
        key: "defects",
        labelKey: "nav.defects",
        path: "/defects",
        enabled: true,
        icon: BugRegular,
        descriptionKey: "onboardingGuide.navSections.defects",
    },
    {
        key: "dynamic-sprint-report",
        labelKey: "nav.dynamicSprintReport",
        path: "/dynamic-sprint-report",
        enabled: true,
        icon: DocumentTextRegular,
        descriptionKey: "onboardingGuide.navSections.dynamic-sprint-report",
    },
    {
        key: "my-work-items",
        labelKey: "nav.myWorkItems",
        path: "/my-work-items",
        enabled: true,
        icon: PersonRegular,
        descriptionKey: "onboardingGuide.navSections.my-work-items",
    },
    {
        key: "remove-test-cases",
        labelKey: "nav.removeTestCases",
        path: "/remove-test-cases",
        enabled: false,
        icon: DeleteRegular,
        descriptionKey: "onboardingGuide.navSections.remove-test-cases",
    },
];

export const AUTOMATION_ITEMS: NavItemConfig[] = [
    {
        key: "automation-dashboard",
        labelKey: "nav.automationDashboard",
        path: "/automation-dashboard",
        enabled: true,
        icon: GaugeRegular,
        descriptionKey: "onboardingGuide.navSections.automation-dashboard",
    },
    {
        key: "common-errors",
        labelKey: "nav.commonErrors",
        path: "/common-errors",
        enabled: false,
        icon: ErrorCircleRegular,
        descriptionKey: "onboardingGuide.navSections.common-errors",
    },
];
