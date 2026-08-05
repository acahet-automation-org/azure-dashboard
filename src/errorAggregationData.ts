import {
    getTestRuns,
    getTestRunResults,
    getWorkItems,
} from "./azdo.js";
import type {
    ErrorSummary,
    AffectedTestCase,
} from "./types.js";

// Keyed by resolved project rather than a single global entry, mirroring
// dashboardData.ts's dashboardCache/defectData.ts's defectCache fix.
const commonErrorsCache = new Map<
    string,
    { errors: ErrorSummary[]; totalFailedResults: number; timestamp: number }
>();

const CACHE_DURATION_MS = 5 * 60 * 1000;
const TOP_N = 20;
const AUTOMATION_STATUS_FIELD = "Microsoft.VSTS.TCM.AutomationStatus";

function resolveProjectKey(project?: string): string {
    return project ?? process.env.AZDO_PROJECT!;
}

export function getCommonErrorsCacheTimestamp(project?: string): number {
    return commonErrorsCache.get(resolveProjectKey(project))?.timestamp ?? 0;
}

export function clearCommonErrorsCache(): void {
    commonErrorsCache.clear();
}

const URL_PATTERN = /https?:\/\/\S+/g;
const FILE_LOCATION_PATTERN =
    /[\w./-]+\.\w+:\d+:\d+/g;
const ISO_DATE_PATTERN =
    /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/g;
const GUID_PATTERN =
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
const LONG_NUMBER_PATTERN = /\d{4,}/g;

export function normalizeErrorSignature(
    errorMessage: string
): string {
    const firstLine =
        errorMessage.split(/\r?\n/)[0] ?? "";

    return firstLine
        .replace(URL_PATTERN, "<url>")
        .replace(FILE_LOCATION_PATTERN, "<location>")
        .replace(ISO_DATE_PATTERN, "<timestamp>")
        .replace(GUID_PATTERN, "<guid>")
        .replace(LONG_NUMBER_PATTERN, "<n>")
        .replace(/\s+/g, " ")
        .trim();
}

function extractTestCaseId(
    result: any
): number | undefined {
    return (
        result.testCase?.id ??
        result.automatedTestId ??
        result.id
    );
}

function extractTestCaseTitle(
    result: any
): string {
    return (
        result.testCase?.name ??
        result.testCaseTitle ??
        result.automatedTestName ??
        `Result #${result.id}`
    );
}

async function filterToAutomatedResults(
    results: any[],
    project?: string
): Promise<any[]> {
    const testCaseIds = [
        ...new Set(
            results
                .map((r: any) => r.testCase?.id)
                .filter(
                    (id: any): id is number =>
                        typeof id === "number"
                )
        ),
    ];

    const testCases = await getWorkItems(testCaseIds, [
        AUTOMATION_STATUS_FIELD,
    ], project);

    const automationStatusById = new Map<
        number,
        string
    >(
        testCases.map((tc: any) => [
            tc.id,
            tc.fields?.[AUTOMATION_STATUS_FIELD],
        ])
    );

    return results.filter(
        (r: any) =>
            automationStatusById.get(
                r.testCase?.id
            ) === "Automated"
    );
}

// TODO: the test/Runs/{runId}/results endpoint supports paging via
// $top/continuationToken; not handled here, consistent with the rest
// of this codebase not handling Azure DevOps paging either.
async function buildCommonErrors(project?: string): Promise<{
    errors: ErrorSummary[];
    totalFailedResults: number;
}> {
    const runs = await getTestRuns(project);

    const resultsByRun = await Promise.all(
        runs.map((run: any) =>
            getTestRunResults(run.id, project)
        )
    );

    const allResults = resultsByRun.flat();

    const failedResults = allResults.filter(
        (r: any) =>
            typeof r.errorMessage === "string" &&
            r.errorMessage.trim().length > 0
    );

    const automatedFailedResults =
        await filterToAutomatedResults(failedResults, project);

    const grouped = new Map<
        string,
        {
            sampleMessage: string;
            count: number;
            testCases: Map<number, string>;
            lastOccurred?: string;
        }
    >();

    for (const result of automatedFailedResults) {
        const signature = normalizeErrorSignature(
            result.errorMessage
        );

        const bucket =
            grouped.get(signature) ?? {
                sampleMessage: result.errorMessage,
                count: 0,
                testCases: new Map<
                    number,
                    string
                >(),
                lastOccurred: undefined,
            };

        bucket.count++;

        const tcId = extractTestCaseId(result);

        if (tcId != null) {
            bucket.testCases.set(
                tcId,
                extractTestCaseTitle(result)
            );
        }

        const completedDate =
            result.completedDate;

        if (
            completedDate &&
            (!bucket.lastOccurred ||
                new Date(
                    completedDate
                ).getTime() >
                    new Date(
                        bucket.lastOccurred
                    ).getTime())
        ) {
            bucket.lastOccurred = completedDate;
        }

        grouped.set(signature, bucket);
    }

    const errors: ErrorSummary[] = [
        ...grouped.entries(),
    ]
        .map(
            ([
                signature,
                bucket,
            ]): ErrorSummary => ({
                signature,
                sampleMessage: bucket.sampleMessage,
                count: bucket.count,
                affectedTestCases: [
                    ...bucket.testCases.entries(),
                ].map(
                    ([
                        id,
                        title,
                    ]): AffectedTestCase => ({
                        id,
                        title,
                    })
                ),
                lastOccurred: bucket.lastOccurred,
            })
        )
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_N);

    return {
        errors,
        totalFailedResults: automatedFailedResults.length,
    };
}

export async function getCommonErrorsData(project?: string): Promise<{
    errors: ErrorSummary[];
    totalFailedResults: number;
}> {
    const projectKey = resolveProjectKey(project);
    const now = Date.now();
    const cached = commonErrorsCache.get(projectKey);

    if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
        return {
            errors: cached.errors,
            totalFailedResults: cached.totalFailedResults,
        };
    }

    const { errors, totalFailedResults } =
        await buildCommonErrors(project);

    commonErrorsCache.set(projectKey, {
        errors,
        totalFailedResults,
        timestamp: now,
    });

    return { errors, totalFailedResults };
}
