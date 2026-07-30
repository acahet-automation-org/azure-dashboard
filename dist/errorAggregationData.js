import { getTestRuns, getTestRunResults, getWorkItems, } from "./azdo.js";
let commonErrorsCache = null;
let totalFailedResultsCache = 0;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000;
const TOP_N = 20;
const AUTOMATION_STATUS_FIELD = "Microsoft.VSTS.TCM.AutomationStatus";
export function getCommonErrorsCacheTimestamp() {
    return cacheTimestamp;
}
export function clearCommonErrorsCache() {
    commonErrorsCache = null;
    totalFailedResultsCache = 0;
    cacheTimestamp = 0;
}
const URL_PATTERN = /https?:\/\/\S+/g;
const FILE_LOCATION_PATTERN = /[\w./-]+\.\w+:\d+:\d+/g;
const ISO_DATE_PATTERN = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/g;
const GUID_PATTERN = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
const LONG_NUMBER_PATTERN = /\d{4,}/g;
export function normalizeErrorSignature(errorMessage) {
    const firstLine = errorMessage.split(/\r?\n/)[0] ?? "";
    return firstLine
        .replace(URL_PATTERN, "<url>")
        .replace(FILE_LOCATION_PATTERN, "<location>")
        .replace(ISO_DATE_PATTERN, "<timestamp>")
        .replace(GUID_PATTERN, "<guid>")
        .replace(LONG_NUMBER_PATTERN, "<n>")
        .replace(/\s+/g, " ")
        .trim();
}
function extractTestCaseId(result) {
    return (result.testCase?.id ??
        result.automatedTestId ??
        result.id);
}
function extractTestCaseTitle(result) {
    return (result.testCase?.name ??
        result.testCaseTitle ??
        result.automatedTestName ??
        `Result #${result.id}`);
}
async function filterToAutomatedResults(results) {
    const testCaseIds = [
        ...new Set(results
            .map((r) => r.testCase?.id)
            .filter((id) => typeof id === "number")),
    ];
    const testCases = await getWorkItems(testCaseIds, [
        AUTOMATION_STATUS_FIELD,
    ]);
    const automationStatusById = new Map(testCases.map((tc) => [
        tc.id,
        tc.fields?.[AUTOMATION_STATUS_FIELD],
    ]));
    return results.filter((r) => automationStatusById.get(r.testCase?.id) === "Automated");
}
// TODO: the test/Runs/{runId}/results endpoint supports paging via
// $top/continuationToken; not handled here, consistent with the rest
// of this codebase not handling Azure DevOps paging either.
async function buildCommonErrors() {
    const runs = await getTestRuns();
    const resultsByRun = await Promise.all(runs.map((run) => getTestRunResults(run.id)));
    const allResults = resultsByRun.flat();
    const failedResults = allResults.filter((r) => typeof r.errorMessage === "string" &&
        r.errorMessage.trim().length > 0);
    const automatedFailedResults = await filterToAutomatedResults(failedResults);
    const grouped = new Map();
    for (const result of automatedFailedResults) {
        const signature = normalizeErrorSignature(result.errorMessage);
        const bucket = grouped.get(signature) ?? {
            sampleMessage: result.errorMessage,
            count: 0,
            testCases: new Map(),
            lastOccurred: undefined,
        };
        bucket.count++;
        const tcId = extractTestCaseId(result);
        if (tcId != null) {
            bucket.testCases.set(tcId, extractTestCaseTitle(result));
        }
        const completedDate = result.completedDate;
        if (completedDate &&
            (!bucket.lastOccurred ||
                new Date(completedDate).getTime() >
                    new Date(bucket.lastOccurred).getTime())) {
            bucket.lastOccurred = completedDate;
        }
        grouped.set(signature, bucket);
    }
    const errors = [
        ...grouped.entries(),
    ]
        .map(([signature, bucket,]) => ({
        signature,
        sampleMessage: bucket.sampleMessage,
        count: bucket.count,
        affectedTestCases: [
            ...bucket.testCases.entries(),
        ].map(([id, title,]) => ({
            id,
            title,
        })),
        lastOccurred: bucket.lastOccurred,
    }))
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_N);
    return {
        errors,
        totalFailedResults: automatedFailedResults.length,
    };
}
export async function getCommonErrorsData() {
    const now = Date.now();
    if (commonErrorsCache &&
        now - cacheTimestamp <
            CACHE_DURATION_MS) {
        console.log("CACHE HIT");
        return {
            errors: commonErrorsCache,
            totalFailedResults: totalFailedResultsCache,
        };
    }
    console.log("CACHE MISS");
    const { errors, totalFailedResults } = await buildCommonErrors();
    commonErrorsCache = errors;
    totalFailedResultsCache = totalFailedResults;
    cacheTimestamp = now;
    return { errors, totalFailedResults };
}
