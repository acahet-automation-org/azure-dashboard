import { useMsal } from "@azure/msal-react";

// "Plan Progress" and "Remove Test Cases" are still fully functional pages,
// just not ready for general use yet - only this account should be able to
// reach them (nav link and direct URL) until then.
const RESTRICTED_OWNER_EMAIL = "anderson.cahet@finconsgroup.com";

// The restriction only means anything when there's a signed-in identity to
// check against. Now that the app has no sign-in wall (see App.tsx), this is
// shipped as "true" in .env/.env.example (same pattern as the old
// SKIP_AUTH) so these pages are open to everyone by default - set it to
// "false" only once sign-in is actually working again.
const skipOwnerCheck = import.meta.env.VITE_SKIP_OWNER_CHECK === "true";

export function useIsRestrictedOwner(): boolean {
    const { instance, accounts } = useMsal();
    const activeAccount = instance.getActiveAccount() ?? accounts[0];

    if (skipOwnerCheck) {
        return true;
    }

    return activeAccount?.username?.toLowerCase() === RESTRICTED_OWNER_EMAIL;
}
