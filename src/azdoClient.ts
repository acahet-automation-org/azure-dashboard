import type { AxiosInstance } from "axios";
import type { Request } from "express";
import { createAzdoClient, devAzdoClient } from "./azdo.js";
import { getAzdoToken } from "./obo.js";

export async function getAzdoClientForRequest(
    req: Request
): Promise<AxiosInstance> {
    if (process.env.SKIP_AUTH === "true") {
        return devAzdoClient;
    }

    const azdoToken = await getAzdoToken(req.userToken!);

    return createAzdoClient(azdoToken);
}
