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
        "/test/runs?api-version=7.1&$top=50"
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

export async function getWorkItems(ids: number[]) {
    if (!ids.length) {
        return [];
    }

    const response = await azdo.get(
        `/wit/workitems?ids=${ids.join(
            ","
        )}&api-version=7.1`
    );

    return response.data.value;
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