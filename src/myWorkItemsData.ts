import type { AxiosInstance } from "axios";
import {
    getActiveWorkItemIds,
    getWorkItems,
    buildWorkItemUrl,
} from "./azdo.js";
import type { WorkItemSummary } from "./types.js";

const MY_WORK_ITEM_FIELDS = [
    "System.Id",
    "System.Title",
    "System.WorkItemType",
    "System.State",
    "Microsoft.VSTS.Common.Priority",
    "System.ChangedDate",
    "System.AssignedTo",
];

export async function getMyWorkItems(
    azdo: AxiosInstance,
    type: "Task" | "Bug"
): Promise<WorkItemSummary[]> {
    const ids = await getActiveWorkItemIds(azdo, type);
    const items = await getWorkItems(azdo, ids, MY_WORK_ITEM_FIELDS);

    return items.map((wi: any) => ({
        id: wi.id,
        title: wi.fields["System.Title"],
        type: wi.fields["System.WorkItemType"],
        state: wi.fields["System.State"],
        priority: wi.fields["Microsoft.VSTS.Common.Priority"],
        changedDate: wi.fields["System.ChangedDate"],
        url: buildWorkItemUrl(wi.id),
        assignee: wi.fields["System.AssignedTo"]
            ? {
                  displayName: wi.fields["System.AssignedTo"].displayName,
                  uniqueName: wi.fields["System.AssignedTo"].uniqueName,
              }
            : undefined,
    }));
}
