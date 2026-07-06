import {
    getAllBugFields,
    getWorkItemRevisions,
    getStoryCount,
    getStoriesWithFields,
    getWorkItem,
    getWorkItems,
    extractWorkItemIds,
    buildWorkItemUrl,
    getAvailableProjects,
    resolveProject,
} from "./azdo.js";
import { getDashboardData } from "./dashboardData.js";
import type {
    DefectRecord,
    DefectStats,
    DefectTrendPoint,
    BacklogTrendPoint,
    AgingBucket,
    DefectSummary,
    BacklogDirection,
    DefectFilterParams,
    DefectFilterOptions,
} from "./types.js";

// Keyed by project name, since Defect Management can point at either
// AZDO_PROJECT or AZDO_PROJECT_2 and each needs its own cached snapshot.
const defectCacheByProject = new Map<
    string,
    { data: DefectRecord[]; timestamp: number }
>();

const CACHE_DURATION_MS = 5 * 60 * 1000;

const REOPENED_FROM_STATES = ["Resolved", "Closed"];
const REOPENED_TO_STATES = ["Active", "New"];

// Seeded with the canonical VSTS/Agile rejection reasons. Whether these
// actually appear depends on the project's process template - some
// processes (e.g. ours) track System.Reason as workflow transitions
// instead of a rejection judgement, in which case this legitimately
// computes to 0% rather than "not configured" (same as duplicateRate).
const REJECTED_REASONS = new Set([
    "Not a Bug",
    "Cannot Reproduce",
    "As Designed",
    "Won't Fix",
    "Invalid",
]);

// Days a bug may stay open before it's flagged in the High Attention list.
// Keyed by the exact Microsoft.VSTS.Common.Severity label used in this
// project; "default" covers severities not explicitly listed.
const SLA_THRESHOLD_DAYS: Record<string, number> = {
    "1 - Critical": 1,
    "2 - High": 5,
    "3 - Medium": 10,
    "4 - Low": 30,
    default: 30,
};

export function getDefectCacheTimestamp(
    project: string = process.env.AZDO_PROJECT!
): number {
    return defectCacheByProject.get(project)?.timestamp ?? 0;
}

function countReopenings(revisions: any[]): number {
    let count = 0;

    for (let i = 1; i < revisions.length; i++) {
        const prevState =
            revisions[i - 1].fields?.[
            "System.State"
            ];
        const currState =
            revisions[i].fields?.[
            "System.State"
            ];

        if (
            REOPENED_FROM_STATES.includes(
                prevState
            ) &&
            REOPENED_TO_STATES.includes(currState)
        ) {
            count++;
        }
    }

    return count;
}

// Returns the IDs of Test Cases linked to this bug, read directly off the
// bug's own relations. This is the bug-centric direction (bug -> test case),
// as opposed to the dashboard's test-case-centric direction (test case ->
// bug) used below - keeping both directions independent means a bug that's
// confirmed linked here won't silently fall back to "no test case" just
// because the reverse crawl in buildDashboard() didn't happen to surface it.
async function getLinkedTestCaseIds(
    bugId: number,
    project: string
): Promise<number[]> {
    const workItem = await getWorkItem(bugId, project);

    const linkedIds = extractWorkItemIds(
        workItem.relations
    );

    const linkedItems = await getWorkItems(
        linkedIds,
        undefined,
        project
    );

    return linkedItems
        .filter(
            (item: any) =>
                item.fields["System.WorkItemType"] ===
                "Test Case"
        )
        .map((item: any) => item.id);
}

// Bugs are rarely tagged with a real sprint themselves (System.IterationPath
// mostly defaults to the project/team root), so the sprint shown for a bug
// is instead borrowed from the Test Plan of the test case it's linked to -
// that's where this project's actual sprint assignments live. The same
// borrowing applies to the test suite. That mapping only exists for the
// default project's Test Plans, so other projects get no sprint/suite data
// this way (their bugs fall back to no iteration/suite shown).
//
// Keyed by test case ID rather than bug ID so lookups can be driven off the
// bug's own confirmed test case links (see getLinkedTestCaseIds) instead of
// requiring the bug to also turn up in the dashboard's own test-case-to-bug
// crawl.
async function getTestCaseIterationAndSuiteMaps(
    project: string
): Promise<{
    iterationByTestCase: Map<number, string>;
    suiteByTestCase: Map<number, string>;
}> {
    const iterationByTestCase = new Map<number, string>();
    const suiteByTestCase = new Map<number, string>();

    if (project !== process.env.AZDO_PROJECT) {
        return { iterationByTestCase, suiteByTestCase };
    }

    const testCases = await getDashboardData();

    for (const tc of testCases) {
        if (tc.iteration && !iterationByTestCase.has(tc.testCaseId)) {
            iterationByTestCase.set(
                tc.testCaseId,
                tc.iteration
            );
        }

        if (tc.suiteName && !suiteByTestCase.has(tc.testCaseId)) {
            suiteByTestCase.set(
                tc.testCaseId,
                tc.suiteName
            );
        }
    }

    return { iterationByTestCase, suiteByTestCase };
}

async function buildDefectRecord(
    bug: any,
    iterationByTestCase: Map<number, string>,
    suiteByTestCase: Map<number, string>,
    project: string
): Promise<DefectRecord> {
    const [revisions, linkedTestCaseIds] =
        await Promise.all([
            getWorkItemRevisions(bug.id, project),
            getLinkedTestCaseIds(bug.id, project),
        ]);

    let iterationPath: string | undefined;
    const suiteNames = new Set<string>();

    for (const tcId of linkedTestCaseIds) {
        iterationPath ??= iterationByTestCase.get(tcId);

        const suite = suiteByTestCase.get(tcId);

        if (suite) {
            suiteNames.add(suite);
        }
    }

    return {
        id: bug.id,
        title: bug.fields["System.Title"],
        state: bug.fields["System.State"],
        reason: bug.fields["System.Reason"],
        severity:
            bug.fields[
            "Microsoft.VSTS.Common.Severity"
            ],
        priority:
            bug.fields[
            "Microsoft.VSTS.Common.Priority"
            ],
        areaPath: bug.fields["System.AreaPath"],
        iterationPath,
        suiteNames: suiteNames.size
            ? [...suiteNames]
            : undefined,
        environment:
            bug.fields["Microsoft.VSTS.Build.FoundIn"],
        createdDate:
            bug.fields["System.CreatedDate"],
        closedDate:
            bug.fields[
            "Microsoft.VSTS.Common.ClosedDate"
            ],
        changedDate:
            bug.fields["System.ChangedDate"],
        reopenedCount: countReopenings(revisions),
        hasLinkedTestCase: linkedTestCaseIds.length > 0,
        url: buildWorkItemUrl(bug.id, project),
        creator: bug.fields["System.CreatedBy"]?.displayName,
    };
}

export async function buildDefectRecords(
    project: string = process.env.AZDO_PROJECT!
): Promise<DefectRecord[]> {
    const [bugs, { iterationByTestCase, suiteByTestCase }] = await Promise.all([
        getAllBugFields(project),
        getTestCaseIterationAndSuiteMaps(project),
    ]);

    return Promise.all(
        bugs.map((bug) =>
            buildDefectRecord(bug, iterationByTestCase, suiteByTestCase, project)
        )
    );
}

export async function getDefectData(
    project: string = process.env.AZDO_PROJECT!
): Promise<DefectRecord[]> {
    const now = Date.now();
    const cached = defectCacheByProject.get(project);

    if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
        return cached.data;
    }

    const data = await buildDefectRecords(project);

    defectCacheByProject.set(project, {
        data,
        timestamp: now,
    });

    return data;
}

export function clearDefectCache(): void {
    defectCacheByProject.clear();
    storyPointsCacheByProject.clear();
    suiteNamesCacheByProject.clear();
}

function groupCount(
    records: DefectRecord[],
    keyFn: (r: DefectRecord) => string | undefined
): Record<string, number> {
    const result: Record<string, number> = {};

    for (const record of records) {
        const key = keyFn(record) ?? "Unspecified";

        result[key] = (result[key] ?? 0) + 1;
    }

    return result;
}

// Like groupCount, but seeded with every known suite name at 0 first, so
// suites with no bugs still show up in the chart instead of being omitted.
// A bug linked to test cases in multiple suites counts once toward each of
// its suites, since it genuinely affects all of them.
function computeByTestSuite(
    records: DefectRecord[],
    allSuiteNames: string[]
): Record<string, number> {
    const result: Record<string, number> = {};

    for (const suite of allSuiteNames) {
        result[suite] = 0;
    }

    for (const record of records) {
        const keys = record.suiteNames?.length
            ? record.suiteNames
            : ["Unspecified"];

        for (const key of keys) {
            result[key] = (result[key] ?? 0) + 1;
        }
    }

    return result;
}

function computeTrend(
    records: DefectRecord[]
): DefectTrendPoint[] {
    const weekStart = (date: Date): string => {
        const d = new Date(date);
        const day = d.getUTCDay();
        const diff = (day + 6) % 7;

        d.setUTCDate(d.getUTCDate() - diff);

        return d.toISOString().slice(0, 10);
    };

    const twelveWeeksAgo = new Date();

    twelveWeeksAgo.setUTCDate(
        twelveWeeksAgo.getUTCDate() - 12 * 7
    );

    const buckets = new Map<
        string,
        { opened: number; closed: number }
    >();

    for (const record of records) {
        const createdWeek = weekStart(
            new Date(record.createdDate)
        );
        const createdBucket = buckets.get(
            createdWeek
        ) ?? { opened: 0, closed: 0 };

        createdBucket.opened++;
        buckets.set(createdWeek, createdBucket);

        if (record.closedDate) {
            const closedWeek = weekStart(
                new Date(record.closedDate)
            );
            const closedBucket = buckets.get(
                closedWeek
            ) ?? { opened: 0, closed: 0 };

            closedBucket.closed++;
            buckets.set(closedWeek, closedBucket);
        }
    }

    const sortedWeeks = [...buckets.keys()]
        .filter(
            (week) =>
                new Date(week) >= twelveWeeksAgo
        )
        .sort();

    let openTotal = 0;

    return sortedWeeks.map((week): DefectTrendPoint => {
        const bucket = buckets.get(week)!;

        openTotal += bucket.opened - bucket.closed;

        return {
            weekStart: week,
            opened: bucket.opened,
            closed: bucket.closed,
            openTotal,
        };
    });
}

function computeMttrDays(
    records: DefectRecord[]
): number | null {
    const resolutionTimes = records
        .filter((r) => r.closedDate)
        .map(
            (r) =>
                (new Date(r.closedDate!).getTime() -
                    new Date(
                        r.createdDate
                    ).getTime()) /
                (1000 * 60 * 60 * 24)
        );

    if (resolutionTimes.length === 0) {
        return null;
    }

    const total = resolutionTimes.reduce(
        (sum, days) => sum + days,
        0
    );

    return (
        Math.round(
            (total / resolutionTimes.length) * 10
        ) / 10
    );
}

function computeAgingBuckets(
    records: DefectRecord[]
): AgingBucket[] {
    const now = Date.now();

    const bucketDefs = [
        { bucket: "0-7 days", min: 0, max: 7 },
        { bucket: "8-14 days", min: 8, max: 14 },
        { bucket: "15-30 days", min: 15, max: 30 },
        {
            bucket: "31+ days",
            min: 31,
            max: Infinity,
        },
    ];

    const counts = bucketDefs.map((def) => ({
        bucket: def.bucket,
        count: 0,
    }));

    for (const record of records) {
        if (record.state === "Closed") {
            continue;
        }

        const ageDays =
            (now -
                new Date(
                    record.createdDate
                ).getTime()) /
            (1000 * 60 * 60 * 24);

        const index = bucketDefs.findIndex(
            (def) =>
                ageDays >= def.min &&
                ageDays <= def.max
        );

        if (index >= 0) {
            counts[index].count++;
        }
    }

    return counts;
}

function computeRejectionRate(
    records: DefectRecord[]
): number {
    if (records.length === 0) {
        return 0;
    }

    const rejectedCount = records.filter(
        (r) => r.reason && REJECTED_REASONS.has(r.reason)
    ).length;

    return (
        Math.round(
            (rejectedCount / records.length) * 1000
        ) / 10
    );
}

function computeRejectionReasons(
    records: DefectRecord[]
): Record<string, number> {
    return groupCount(
        records.filter(
            (r) =>
                r.reason && REJECTED_REASONS.has(r.reason)
        ),
        (r) => r.reason
    );
}

function computeFirstTimeFixRate(
    records: DefectRecord[]
): number | null {
    const resolved = records.filter(
        (r) => r.closedDate
    );

    if (resolved.length === 0) {
        return null;
    }

    const fixedFirstTry = resolved.filter(
        (r) => r.reopenedCount === 0
    ).length;

    return (
        Math.round(
            (fixedFirstTry / resolved.length) * 1000
        ) / 10
    );
}

function computeLeakageRate(
    records: DefectRecord[]
): number | null {
    const withEnvironment = records.filter(
        (r) => r.environment
    );

    if (withEnvironment.length === 0) {
        return null;
    }

    const foundInProd = withEnvironment.filter((r) =>
        r.environment!.toLowerCase().includes("prod")
    ).length;

    return (
        Math.round(
            (foundInProd / withEnvironment.length) * 1000
        ) / 10
    );
}

function computeDensityByComponent(
    records: DefectRecord[],
    storyPointsByArea: Record<string, number>
): Record<string, number | null> {
    const bugCounts = groupCount(
        records,
        (r) => r.areaPath
    );
    const result: Record<string, number | null> = {};

    for (const [area, count] of Object.entries(
        bugCounts
    )) {
        const points = storyPointsByArea[area];

        result[area] =
            points && points > 0
                ? Math.round((count / points) * 100) /
                100
                : null;
    }

    return result;
}

function computeSlaBreaches(
    records: DefectRecord[]
): DefectSummary[] {
    const now = Date.now();

    return records
        .filter((r) => r.state !== "Closed")
        .map((r) => {
            const ageDays =
                (now -
                    new Date(
                        r.createdDate
                    ).getTime()) /
                (1000 * 60 * 60 * 24);
            const threshold =
                SLA_THRESHOLD_DAYS[r.severity ?? ""] ??
                SLA_THRESHOLD_DAYS.default;

            return { record: r, ageDays, threshold };
        })
        .filter(({ ageDays, threshold }) => ageDays > threshold)
        .sort(
            (a, b) =>
                (b.ageDays - b.threshold) -
                (a.ageDays - a.threshold)
        )
        .map(({ record, ageDays }) => ({
            id: record.id,
            title: record.title,
            state: record.state,
            priority: record.priority,
            severity: record.severity,
            ageDays: Math.round(ageDays),
            url: record.url,
            creator: record.creator,
        }));
}

function computeBacklogTrend(
    trend: DefectTrendPoint[]
): BacklogTrendPoint[] {
    return trend.map((point) => ({
        ...point,
        delta: point.opened - point.closed,
    }));
}

function computeBacklogDirection(
    backlogTrend: BacklogTrendPoint[]
): BacklogDirection {
    const recent = backlogTrend.slice(-4);

    if (recent.length === 0) {
        return "stable";
    }

    const avgDelta =
        recent.reduce((sum, p) => sum + p.delta, 0) /
        recent.length;

    if (avgDelta > 0.5) {
        return "growing";
    }

    if (avgDelta < -0.5) {
        return "shrinking";
    }

    return "stable";
}

function computeStoryPointsByArea(
    stories: any[]
): Record<string, number> {
    const result: Record<string, number> = {};

    for (const story of stories) {
        const area = story.fields["System.AreaPath"];
        const points =
            story.fields[
            "Microsoft.VSTS.Scheduling.StoryPoints"
            ];

        if (!area || !points) {
            continue;
        }

        result[area] = (result[area] ?? 0) + points;
    }

    return result;
}

export function filterRecords(
    records: DefectRecord[],
    params: DefectFilterParams
): DefectRecord[] {
    return records.filter((r) => {
        if (
            params.iteration &&
            r.iterationPath !== params.iteration
        ) {
            return false;
        }

        if (
            params.area &&
            r.areaPath !== params.area
        ) {
            return false;
        }

        if (
            params.environment &&
            r.environment !== params.environment
        ) {
            return false;
        }

        if (
            params.suite &&
            !r.suiteNames?.includes(params.suite)
        ) {
            return false;
        }

        return true;
    });
}

function computeAvailableFilters(
    records: DefectRecord[],
    allSuiteNames: string[] = []
): DefectFilterOptions {
    const iterations = new Set<string>();
    const areas = new Set<string>();
    const environments = new Set<string>();
    const suites = new Set<string>(allSuiteNames);

    for (const r of records) {
        if (r.iterationPath) {
            iterations.add(r.iterationPath);
        }

        if (r.areaPath) {
            areas.add(r.areaPath);
        }

        if (r.environment) {
            environments.add(r.environment);
        }

        for (const suite of r.suiteNames ?? []) {
            suites.add(suite);
        }
    }

    return {
        iterations: [...iterations].sort(),
        areas: [...areas].sort(),
        environments: [...environments].sort(),
        targetVersions: [],
        suites: [...suites].sort(),
    };
}

const storyPointsCacheByProject = new Map<
    string,
    { data: Record<string, number>; timestamp: number }
>();

export async function getStoryPointsByArea(
    project: string = process.env.AZDO_PROJECT!
): Promise<Record<string, number>> {
    const now = Date.now();
    const cached = storyPointsCacheByProject.get(project);

    if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
        return cached.data;
    }

    const stories = await getStoriesWithFields(project);
    const data = computeStoryPointsByArea(stories);

    storyPointsCacheByProject.set(project, {
        data,
        timestamp: now,
    });

    return data;
}

const suiteNamesCacheByProject = new Map<
    string,
    { data: string[]; timestamp: number }
>();

// Full set of test suite names for the project, independent of whether any
// bug is currently linked to them - needed so suites with zero bugs still
// render as a zero bar instead of disappearing from the chart. Same
// default-project-only limitation as the iteration/suite mapping above.
export async function getAllSuiteNames(
    project: string = process.env.AZDO_PROJECT!
): Promise<string[]> {
    const now = Date.now();
    const cached = suiteNamesCacheByProject.get(project);

    if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
        return cached.data;
    }

    const suites = new Set<string>();

    if (project === process.env.AZDO_PROJECT) {
        const testCases = await getDashboardData();

        for (const tc of testCases) {
            if (tc.suiteName) {
                suites.add(tc.suiteName);
            }
        }
    }

    const data = [...suites].sort();

    suiteNamesCacheByProject.set(project, {
        data,
        timestamp: now,
    });

    return data;
}

export function computeDefectStats(
    records: DefectRecord[],
    storyCount: number,
    storyPointsByArea: Record<string, number> = {},
    allRecordsForFilterOptions: DefectRecord[] = records,
    allSuiteNames: string[] = []
): DefectStats {
    const totalClosed = records.filter(
        (r) => r.state === "Closed"
    ).length;

    const totalOpen = records.length - totalClosed;

    const duplicateCount = records.filter(
        (r) => r.state === "Duplicate"
    ).length;

    const reopenedBugCount = records.filter(
        (r) => r.reopenedCount > 0
    ).length;

    const defectsWithoutLinkedTestCase: DefectSummary[] =
        records
            .filter((r) => !r.hasLinkedTestCase)
            .map((r) => ({
                id: r.id,
                title: r.title,
                state: r.state,
                priority: r.priority,
                url: r.url,
                creator: r.creator,
            }))
            .sort((a, b) => {
                if (a.priority == null) {
                    return b.priority == null ? 0 : 1;
                }

                if (b.priority == null) {
                    return -1;
                }

                return a.priority - b.priority;
            });

    const trend = computeTrend(records);
    const backlogTrend = computeBacklogTrend(trend);

    return {
        totalOpen,
        totalClosed,
        bySeverity: groupCount(
            records,
            (r) => r.severity
        ),
        byPriority: groupCount(records, (r) =>
            r.priority != null
                ? String(r.priority)
                : undefined
        ),
        byComponent: groupCount(
            records,
            (r) => r.areaPath
        ),
        byTeam: groupCount(
            records,
            (r) => r.areaPath
        ),
        byTestSuite: computeByTestSuite(
            records,
            allSuiteNames
        ),
        trend,
        mttrDays: computeMttrDays(records),
        agingBuckets: computeAgingBuckets(records),
        reopenedBugCount,
        duplicateRate: records.length
            ? Math.round(
                (duplicateCount / records.length) *
                1000
            ) / 10
            : 0,
        bugsPerStory: storyCount
            ? Math.round(
                (records.length / storyCount) * 100
            ) / 100
            : null,
        defectsWithoutLinkedTestCase,
        defectLeakageRate: computeLeakageRate(records),
        defectRejectionRate: computeRejectionRate(records),
        rejectionReasons: computeRejectionReasons(records),
        firstTimeFixRate: computeFirstTimeFixRate(records),
        densityByComponent: computeDensityByComponent(
            records,
            storyPointsByArea
        ),
        backlogTrend,
        backlogDirection: computeBacklogDirection(backlogTrend),
        slaBreaches: computeSlaBreaches(records),
        availableFilters: computeAvailableFilters(
            allRecordsForFilterOptions,
            allSuiteNames
        ),
    };
}

export { getStoryCount, getAvailableProjects, resolveProject };
