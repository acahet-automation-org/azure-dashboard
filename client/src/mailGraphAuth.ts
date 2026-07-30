import type { AuthenticationResult } from "@azure/msal-browser";
import { mailMsalInstance, ensureMailMsalInitialized } from "./mailMsalInstance";
import { mailLoginRequest } from "./mailAuthConfig";

// Shared by every frontend-delegated Graph mail sender (TestGraphMailButton,
// the report "Send by email" button) - all authenticate against the same
// app registration (see mailAuthConfig.ts) via an interactive popup, since
// this app's SMTP is blocked outbound on the network it runs on.
export async function acquireMailToken(): Promise<AuthenticationResult> {
    await ensureMailMsalInitialized();

    const loginResponse = await mailMsalInstance.loginPopup(mailLoginRequest);
    mailMsalInstance.setActiveAccount(loginResponse.account);

    return loginResponse;
}
