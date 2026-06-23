import axios from "axios";
import "dotenv/config";

const auth = Buffer.from(
    `:${process.env.AZDO_PAT}`
).toString("base64");

export const azdo = axios.create({
    baseURL: `https://dev.azure.com/${process.env.AZDO_ORG}/${encodeURIComponent(
        process.env.AZDO_PROJECT!
    )}/_apis`,
    headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
    },
});
export async function getTestPlans() {
    const response = await azdo.get(
        "/testplan/plans?api-version=7.1"
    );

    return response.data.value;
}

export async function getSuites(planId: number) {
    const response = await azdo.get(
        `/testplan/plans/${planId}/suites?api-version=7.1`
    );

    return response.data.value;
}

export async function getTestCases(
    planId: number,
    suiteId: number
) {
    const response = await azdo.get(
        `/testplan/plans/${planId}/suites/${suiteId}/testcase?api-version=7.1`
    );

    return response.data.value;
}

export async function getTestPoints(
    planId: number,
    suiteId: number
) {
    const response = await azdo.get(
        `/testplan/plans/${planId}/suites/${suiteId}/testpoint?api-version=7.1`
    );

    return response.data.value;
}

export async function getTestRuns() {
    const response = await azdo.get(
        "/test/runs?api-version=7.1&$top=50&includeRunDetails=true"
    );

    return response.data.value;
}

export async function getTestRunStatistics(
    runId: number
) {
    const response = await azdo.get(
        `/test/runs/${runId}/statistics?api-version=7.1`
    );

    return response.data.runStatistics;
}

export async function getTestRunResults(
    runId: number
) {
    const response = await azdo.get(
        `/test/Runs/${runId}/results?api-version=7.1`
    );

    return response.data.value;
}

export async function getActiveBugIds(): Promise<number[]> {
    const response = await azdo.post(
        "/wit/wiql?api-version=7.1",
        {
            query: `
        SELECT [System.Id]
        FROM WorkItems
        WHERE [System.WorkItemType] = 'Bug'
      `,
        }
    );

    return response.data.workItems.map(
        (w: { id: number }) => w.id
    );
}

export async function getWorkItem(id: number) {
    const response = await azdo.get(
        `/wit/workitems/${id}?$expand=relations&api-version=7.1`
    );

    return response.data;
}

export async function getWorkItems(
    ids: number[],
    fields?: string[]
) {
    if (!ids.length) {
        return [];
    }

    const chunks: number[][] = [];

    for (let i = 0; i < ids.length; i += 200) {
        chunks.push(ids.slice(i, i + 200));
    }

    const fieldsParam = fields?.length
        ? `&fields=${fields.join(",")}`
        : "";

    const results = await Promise.all(
        chunks.map(async (chunk) => {
            const response = await azdo.get(
                `/wit/workitems?ids=${chunk.join(
                    ","
                )}${fieldsParam}&api-version=7.1`
            );

            return response.data.value;
        })
    );

    return results.flat();
}

const BUG_FIELDS = [
    "System.Id",
    "System.Title",
    "System.State",
    "System.Reason",
    "System.AreaPath",
    "System.CreatedDate",
    "System.ChangedDate",
    "Microsoft.VSTS.Common.Priority",
    "Microsoft.VSTS.Common.Severity",
    "Microsoft.VSTS.Common.ClosedDate",
];

export async function getAllBugFields(): Promise<
    any[]
> {
    const ids = await getActiveBugIds();

    return getWorkItems(ids, BUG_FIELDS);
}

export async function getWorkItemRevisions(
    id: number
): Promise<any[]> {
    const response = await azdo.get(
        `/wit/workitems/${id}/revisions?api-version=7.1`
    );

    return response.data.value;
}

export async function getStoryCount(): Promise<number> {
    const response = await azdo.post(
        "/wit/wiql?api-version=7.1",
        {
            query: `
        SELECT [System.Id]
        FROM WorkItems
        WHERE [System.WorkItemType] IN ('User Story', 'Product Backlog Item', 'Requirement')
      `,
        }
    );

    return response.data.workItems.length;
}

// @Me is deliberately not used in the normal (logged-in) path: this client
// authenticates to Azure DevOps with a shared PAT (see top of file), so @Me
// would resolve to the PAT's identity for every caller, not the signed-in
// user. Callers must filter by the real user's identity themselves once
// System.AssignedTo is returned. The one exception is SKIP_AUTH dev mode,
// where there is no signed-in user to filter by and the PAT genuinely is the
// one developer's own personal token, so @Me correctly means "me".
export async function getActiveWorkItemIds(
    type: "Task" | "Bug"
): Promise<number[]> {
    const assignedToMe =
        process.env.SKIP_AUTH === "true"
            ? "AND [System.AssignedTo] = @Me\n          "
            : "";

    const response = await azdo.post(
        "/wit/wiql?api-version=7.1",
        {
            query: `
        SELECT [System.Id]
        FROM WorkItems
        WHERE [System.WorkItemType] = '${type}'
          ${assignedToMe}AND [System.State] <> 'Removed'
        ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.ChangedDate] DESC
      `,
        }
    );

    return response.data.workItems.map(
        (w: { id: number }) => w.id
    );
}

export function buildWorkItemUrl(id: number): string {
    const org = process.env.AZDO_ORG;
    const project = encodeURIComponent(
        process.env.AZDO_PROJECT!
    );

    return `https://dev.azure.com/${org}/${project}/_workitems/edit/${id}`;
}

export function buildTestRunUrl(runId: number): string {
    const org = process.env.AZDO_ORG;
    const project = encodeURIComponent(
        process.env.AZDO_PROJECT!
    );

    return `https://dev.azure.com/${org}/${project}/_TestManagement/Runs?runId=${runId}&_a=runCharts`;
}

export function extractWorkItemIds(
    relations: any[] = []
): number[] {
    return relations
        .filter(
            (r) =>
                typeof r.url === "string" &&
                r.url.includes("/workItems/")
        )
        .map((r) => {
            const match =
                r.url.match(/workItems\/(\d+)$/);

            return match
                ? Number.parseInt(match[1], 10)
                : null;
        })
        .filter(
            (id): id is number =>
                id !== null && Number.isInteger(id)
        );
}