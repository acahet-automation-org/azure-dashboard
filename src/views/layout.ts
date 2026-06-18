export type ActiveNav = "suites" | "dashboard" | "runs";

function navLink(
    href: string,
    label: string,
    active: boolean
): string {
    return active
        ? `<strong>${label}</strong>`
        : `<a href="${href}">${label}</a>`;
}

export function renderNav(
    active: ActiveNav
): string {
    return `
<p>
${navLink("/", "Browse by Suite", active === "suites")}
&nbsp;|&nbsp;
${navLink("/dashboard", "Full Dashboard", active === "dashboard")}
&nbsp;|&nbsp;
${navLink("/last-10-runs", "Last 10 Runs", active === "runs")}
&nbsp;|&nbsp;
<a href="/refresh">Refresh Now</a>
</p>
`;
}

export function renderPage(
    title: string,
    activeNav: ActiveNav,
    bodyHtml: string
): string {
    return `
<!DOCTYPE html>
<html>
<head>

<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="/styles.css">

</head>

<body>

<h1>${title}</h1>

${renderNav(activeNav)}

${bodyHtml}

</body>
</html>
`;
}
