import { ConfidentialClientApplication } from "@azure/msal-node";
import "dotenv/config";

const AZURE_DEVOPS_RESOURCE_APP_ID = "499b84ac-1321-427f-aa17-267ca6975798";

let cca: ConfidentialClientApplication | undefined;

// Constructed lazily so that dev setups with SKIP_AUTH=true (and no
// ENTRA_CLIENT_SECRET set) can still boot; this only runs once OBO is
// actually needed.
function getConfidentialClient(): ConfidentialClientApplication {
    if (!cca) {
        cca = new ConfidentialClientApplication({
            auth: {
                clientId: process.env.ENTRA_CLIENT_ID!,
                clientSecret: process.env.ENTRA_CLIENT_SECRET!,
                authority: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}`,
            },
        });
    }

    return cca;
}

export async function getAzdoToken(
    userAssertion: string
): Promise<string> {
    const result = await getConfidentialClient().acquireTokenOnBehalfOf({
        oboAssertion: userAssertion,
        scopes: [`${AZURE_DEVOPS_RESOURCE_APP_ID}/.default`],
    });

    if (!result?.accessToken) {
        throw new Error("Failed to acquire Azure DevOps token");
    }

    return result.accessToken;
}
