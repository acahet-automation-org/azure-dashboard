// "Plan Progress" and "Remove Test Cases" are restricted to a single owner
// account (see useIsRestrictedOwner.ts) - shared between Sidebar.tsx (which
// filters the rendered nav) and SettingsPanel.tsx (which must omit these
// rows entirely for non-restricted users, not just show them disabled).
export const RESTRICTED_ITEM_KEYS = new Set(["plan-progress", "remove-test-cases"]);
