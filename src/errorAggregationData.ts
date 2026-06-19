import {
    getTestRuns,
    getTestRunResults,
} from "./azdo.js";
import type {
    ErrorSummary,
    AffectedTestCase,
} from "./types.js";

let commonErrorsCache: ErrorSummary[] | null = null;
let totalFailedResultsCache = 0;
let cacheTimestamp = 0;

const CACHE_DURATION_MS = 5 * 60 * 1000;
const TOP_N = 20;

export function getCommonErrorsCacheTimestamp(): number {
    return cacheTimestamp;
}

export function clearCommonErrorsCache(): void {
    commonErrorsCache = null;
    totalFailedResultsCache = 0;
    cacheTimestamp = 0;
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

// TODO: the test/Runs/{runId}/results endpoint supports paging via
// $top/continuationToken; not handled here, consistent with the rest
// of this codebase not handling Azure DevOps paging either.
async function buildCommonErrors(): Promise<{
    errors: ErrorSummary[];
    totalFailedResults: number;
}> {
    const runs = await getTestRuns();

    const resultsByRun = await Promise.all(
        runs.map((run: any) =>
            getTestRunResults(run.id)
        )
    );

    const allResults = resultsByRun.flat();

    const failedResults = allResults.filter(
        (r: any) =>
            typeof r.errorMessage === "string" &&
            r.errorMessage.trim().length > 0
    );

    const grouped = new Map<
        string,
        {
            sampleMessage: string;
            count: number;
            testCases: Map<number, string>;
            lastOccurred?: string;
        }
    >();

    for (const result of failedResults) {
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
        totalFailedResults: failedResults.length,
    };
}

export async function getCommonErrorsData(): Promise<{
    errors: ErrorSummary[];
    totalFailedResults: number;
}> {
    const now = Date.now();

    if (
        commonErrorsCache &&
        now - cacheTimestamp <
            CACHE_DURATION_MS
    ) {
        console.log("CACHE HIT");

        return {
            errors: commonErrorsCache,
            totalFailedResults:
                totalFailedResultsCache,
        };
    }

    console.log("CACHE MISS");

    const { errors, totalFailedResults } =
        await buildCommonErrors();

    commonErrorsCache = errors;
    totalFailedResultsCache = totalFailedResults;
    cacheTimestamp = now;

    return { errors, totalFailedResults };
}
