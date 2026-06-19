import {
    getAllBugFields,
    getWorkItemRevisions,
    getStoryCount,
} from "./azdo.js";
import type {
    DefectRecord,
    DefectStats,
    DefectTrendPoint,
    AgingBucket,
} from "./types.js";

let defectCache: DefectRecord[] | null = null;
let cacheTimestamp = 0;

const CACHE_DURATION_MS = 5 * 60 * 1000;

const REOPENED_FROM_STATES = ["Resolved", "Closed"];
const REOPENED_TO_STATES = ["Active", "New"];

export function getDefectCacheTimestamp(): number {
    return cacheTimestamp;
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

async function buildDefectRecord(
    bug: any
): Promise<DefectRecord> {
    const revisions = await getWorkItemRevisions(
        bug.id
    );

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
        createdDate:
            bug.fields["System.CreatedDate"],
        closedDate:
            bug.fields[
            "Microsoft.VSTS.Common.ClosedDate"
            ],
        changedDate:
            bug.fields["System.ChangedDate"],
        reopenedCount: countReopenings(revisions),
        url: bug._links?.html?.href,
    };
}

export async function buildDefectRecords(): Promise<
    DefectRecord[]
> {
    const bugs = await getAllBugFields();

    return Promise.all(
        bugs.map((bug) => buildDefectRecord(bug))
    );
}

export async function getDefectData(): Promise<
    DefectRecord[]
> {
    const now = Date.now();

    if (
        defectCache &&
        now - cacheTimestamp < CACHE_DURATION_MS
    ) {
        return defectCache;
    }

    defectCache = await buildDefectRecords();
    cacheTimestamp = now;

    return defectCache;
}

export function clearDefectCache(): void {
    defectCache = null;
    cacheTimestamp = 0;
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

export function computeDefectStats(
    records: DefectRecord[],
    storyCount: number
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
        trend: computeTrend(records),
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
    };
}

export { getStoryCount };
