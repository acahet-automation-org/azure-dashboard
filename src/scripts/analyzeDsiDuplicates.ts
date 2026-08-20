// Fetches all bugs for Sprint 2, splits them into DSI (Custom.Suite = 'Test DSI')
// and ours (everything else), then ranks each DSI bug against ours by text
// similarity so you can spot duplicates and functionally-overlapping reports.
// Writes a self-contained HTML report to sprint-dsi-analysis.html.
// Run with: npm run analyze:dsi-duplicates
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { azdo, getWorkItems } from "../azdo.js";

// ── Config ────────────────────────────────────────────────────────────────────

const SPRINT_FILTER = process.env.SPRINT_FILTER ?? "Sprint 2";
const DSI_SUITE = "Test DSI";

// Jaccard thresholds (title + body tokens combined)
const DUPLICATE_THRESHOLD = 0.40;   // almost certainly the same defect
const SIMILAR_THRESHOLD   = 0.10;   // functionally overlapping

// How many "our" matches to show per DSI bug
const TOP_N = 6;

// Functional area definitions: label → keywords that map a bug to that area.
// A bug belongs to the first area whose keywords appear in its normalised title.
const AREAS: Array<{ label: string; keywords: string[] }> = [
    { label: "Documenti",            keywords: ["document", "doc", "caricamento", "upload", "scarica", "precontrattual", "patente", "nota"] },
    { label: "Censimento Anagrafica",keywords: ["anagrafica", "censimento", "residenza", "indirizzo", "civico", "normalizzazion", "pep", "aire", "codicefiscale", "cf", "nominativo", "plurifond", "bullet", "forzatura"] },
    { label: "Contatti & Recapiti",  keywords: ["contatt", "recapit", "email", "tag", "telefon", "iban", "account", "person", "colleg"] },
    { label: "Consensi & Privacy",   keywords: ["consens", "privacy", "fea", "firma", "trasmission", "digital"] },
    { label: "Homepage Cliente",     keywords: ["homepage", "riepilog", "situazion", "refresh"] },
    { label: "Login & Profilazione", keywords: ["login", "ruol", "direzional", "profilazion", "utente", "super", "abilitazion"] },
    { label: "Ricerca",              keywords: ["ricer", "socio", "polizzo", "loader"] },
    { label: "Creazione Cliente",    keywords: ["creazion", "crea", "salvataggi", "procedi"] },
    { label: "UI / Mobile / Layout", keywords: ["mobile", "modale", "tooltip", "scroll", "menu", "burger", "layout", "central", "struttura", "nascondi"] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip HTML tags and decode a handful of common entities. */
function stripHtml(html: string | null | undefined): string {
    if (!html) return "";
    return html
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/\s+/g, " ")
        .trim();
}

/** Tokenise text into a bag-of-words set (lowercase, no punctuation, ≥3 chars). */
function tokenise(text: string): Set<string> {
    const tokens = text
        .toLowerCase()
        // strip structured prefixes like NF-CENS-041, [TEST], #8071 so they don't dilute similarity
        .replace(/\b(nf|test|tst)-[a-z]+-\d+\b/gi, " ")
        .replace(/\[test\]/gi, " ")
        .replace(/\bnf-[a-z]+-\d+\b/gi, " ")
        .replace(/[^a-zàèéìòù0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 3);
    return new Set(tokens);
}

/** Detect functional area from normalised title text. */
function detectArea(title: string, desc: string | null): string {
    const text = `${title} ${stripHtml(desc)}`.toLowerCase()
        .replace(/[^a-zàèéìòù0-9\s]/g, " ");
    for (const { label, keywords } of AREAS) {
        if (keywords.some((kw) => text.includes(kw))) return label;
    }
    return "Altro";
}

/** Jaccard similarity between two token sets. */
function jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 0;
    let intersection = 0;
    for (const t of a) {
        if (b.has(t)) intersection++;
    }
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface BugRecord {
    id: number;
    title: string;
    state: string;
    suite: string;
    area: string;
    description: string | null;
    createdBy: string;
    assignedTo: string;
    severity: string;
    tags: string;
    tokens: Set<string>;
}

function azdoDisplayName(field: unknown): string {
    if (!field) return "—";
    if (typeof field === "string") return field;
    if (typeof field === "object" && (field as any).displayName) {
        return (field as any).displayName;
    }
    return String(field);
}

function toBugRecord(item: any, description: string | null = null): BugRecord {
    const f = item.fields;
    const title       = f["System.Title"] ?? "(no title)";
    const combined    = `${title} ${stripHtml(description)}`;
    return {
        id:          item.id,
        title,
        state:       f["System.State"] ?? "?",
        suite:       f["Custom.Suite"] ?? "(no suite)",
        area:        detectArea(title, description),
        description,
        createdBy:   azdoDisplayName(f["System.CreatedBy"]),
        assignedTo:  azdoDisplayName(f["System.AssignedTo"]),
        severity:    f["Microsoft.VSTS.Common.Severity"] ?? "—",
        tags:        f["System.Tags"] ?? "",
        tokens:      tokenise(combined),
    };
}

// ── AzDO query ────────────────────────────────────────────────────────────────

async function fetchSprintBugs(): Promise<BugRecord[]> {
    const project = process.env.AZDO_PROJECT ?? "(unknown)";
    console.log(`Fetching all bugs in project "${project}", then filtering by "${SPRINT_FILTER}"…`);

    // getAllBugFields uses @project in WIQL which doesn't resolve correctly in
    // script context; call getWorkItems directly on all IDs without that clause.
    const wiqlResp = await azdo.post("/wit/wiql?api-version=7.1", {
        query: "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug'",
    });
    const allIds: number[] = (wiqlResp.data.workItems ?? []).map((w: { id: number }) => w.id);

    console.log(`${allIds.length} total bug(s) in org. Fetching fields…`);
    if (allIds.length === 0) return [];

    const allItems = await getWorkItems(allIds, [
        "System.Id",
        "System.Title",
        "System.State",
        "System.IterationPath",
        "System.CreatedBy",
        "System.AssignedTo",
        "Custom.Suite",
        "System.Tags",
        "Microsoft.VSTS.Common.Severity",
    ]);

    const sprintItems = allItems.filter((item: any) =>
        (item.fields["System.IterationPath"] ?? "").includes(SPRINT_FILTER)
    );

    console.log(`${sprintItems.length} bug(s) match iteration path "${SPRINT_FILTER}".`);
    if (sprintItems.length === 0) return [];

    // Second pass: fetch descriptions for the sprint subset only.
    const sprintIds: number[] = sprintItems.map((i: any) => i.id);
    const withDesc = await getWorkItems(sprintIds, ["System.Id", "System.Description"]);
    const descById = new Map<number, string>(
        withDesc.map((i: any) => [i.id, i.fields["System.Description"] ?? ""])
    );

    return sprintItems.map((item: any) => toBugRecord(item, descById.get(item.id) ?? null));
}

// ── Report helpers ────────────────────────────────────────────────────────────

function similarity(a: BugRecord, b: BugRecord): number {
    return jaccard(a.tokens, b.tokens);
}

function bugUrl(id: number): string {
    const org = process.env.AZDO_ORG ?? "";
    const proj = encodeURIComponent(process.env.AZDO_PROJECT ?? "");
    return `https://dev.azure.com/${org}/${proj}/_workitems/edit/${id}`;
}

function esc(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

const SEV_COLOR: Record<string, string> = {
    "1 - Critical": "#d13438",
    "2 - High":     "#ca5010",
    "3 - Medium":   "#eda100",
    "4 - Low":      "#0078d4",
};

const STATE_COLOR: Record<string, string> = {
    "New":            "#0078d4",
    "In Lavorazione": "#eda100",
    "Da verificare":  "#8764b8",
    "In verifica":    "#00b7c3",
    "Riaperto":       "#d13438",
    "Closed":         "#107c10",
};

function sevBadge(sev: string): string {
    const color = SEV_COLOR[sev] ?? "#5b5b5b";
    const label = sev.replace(/^\d+ - /, "");
    return `<span style="background:${color};color:#fff;font-size:10px;padding:2px 6px;border-radius:3px;white-space:nowrap;">${esc(label)}</span>`;
}

function stateBadge(state: string): string {
    const color = STATE_COLOR[state] ?? "#5b5b5b";
    return `<span style="background:${color};color:#fff;font-size:10px;padding:2px 6px;border-radius:3px;white-space:nowrap;">${esc(state)}</span>`;
}

function pctBar(pct: number, isDup: boolean): string {
    const color = isDup ? "#d13438" : pct >= 25 ? "#ca5010" : "#eda100";
    return `<div style="display:flex;align-items:center;gap:6px;">
      <div style="width:80px;height:8px;background:#333;border-radius:4px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;"></div>
      </div>
      <span style="font-size:12px;color:${color};font-weight:700;">${pct}%</span>
    </div>`;
}

function bugLink(bug: BugRecord, extraStyle = ""): string {
    return `<a href="${bugUrl(bug.id)}" target="_blank"
        style="color:#4fc3f7;text-decoration:none;${extraStyle}"
        title="${esc(bug.title)}">#${bug.id}</a>`;
}

function bugRow(bug: BugRecord): string {
    const descRaw = stripHtml(bug.description);
    const descPreview = descRaw.length > 200 ? descRaw.slice(0, 200) + "…" : descRaw;
    return `
    <tr style="border-bottom:1px solid #2a2a2a;">
      <td style="padding:8px 10px;white-space:nowrap;vertical-align:top;">
        <a href="${bugUrl(bug.id)}" target="_blank" style="color:#4fc3f7;font-weight:700;text-decoration:none;">#${bug.id}</a>
      </td>
      <td style="padding:8px 10px;vertical-align:top;max-width:320px;">
        <div style="font-weight:500;color:#f0f0f0;font-size:13px;">${esc(bug.title)}</div>
        ${descPreview ? `<div style="color:#888;font-size:11px;margin-top:3px;">${esc(descPreview)}</div>` : ""}
      </td>
      <td style="padding:8px 10px;white-space:nowrap;vertical-align:top;">${stateBadge(bug.state)}</td>
      <td style="padding:8px 10px;white-space:nowrap;vertical-align:top;">${sevBadge(bug.severity)}</td>
      <td style="padding:8px 10px;vertical-align:top;color:#aaa;font-size:12px;">${esc(bug.area)}</td>
      <td style="padding:8px 10px;vertical-align:top;color:#aaa;font-size:12px;white-space:nowrap;">${esc(bug.assignedTo)}</td>
    </tr>`;
}

function buildHtml(
    sprint: string,
    dsi: BugRecord[],
    ours: BugRecord[],
    matches: Array<{ dsi: BugRecord; ranked: Array<{ bug: BugRecord; score: number }> }>,
    duplicates: Array<{ dsi: BugRecord; our: BugRecord; score: number }>,
    similar:    Array<{ dsi: BugRecord; our: BugRecord; score: number }>
): string {
    const now = new Date().toLocaleString("it-IT");
    const totalBugs = dsi.length + ours.length;

    // Unique DSI bugs that have ≥1 match, and unique "our" bugs that appear in ≥1 match.
    const dsiWithMatch  = new Set(similar.map((x) => x.dsi.id).concat(duplicates.map((x) => x.dsi.id)));
    const oursInMatch   = new Set(similar.map((x) => x.our.id).concat(duplicates.map((x) => x.our.id)));
    const dsiNoMatch    = dsi.filter((b) => !dsiWithMatch.has(b.id));

    // ── Summary cards ─────────────────────────────────────────────────────────
    const summaryCards = [
        { label: "Bug totali sprint",         value: totalBugs,           color: "#0078d4" },
        { label: "Bug DSI",                   value: dsi.length,          color: "#8764b8" },
        { label: "Bug nostri",                value: ours.length,         color: "#00b7c3" },
        { label: "Probabili duplicati (coppie)", value: duplicates.length, color: duplicates.length > 0 ? "#d13438" : "#107c10" },
        { label: "Bug DSI con match affine",  value: dsiWithMatch.size,   color: dsiWithMatch.size > 0 ? "#eda100" : "#107c10" },
        { label: "Nostri bug coinvolti",      value: oursInMatch.size,    color: oursInMatch.size > 0 ? "#eda100" : "#107c10" },
        { label: "Bug DSI senza match",       value: dsiNoMatch.length,   color: "#555" },
    ].map(({ label, value, color }) => `
      <div style="background:#1e1e1e;border:1px solid #333;border-radius:8px;padding:16px 20px;min-width:130px;text-align:center;">
        <div style="font-size:32px;font-weight:700;color:${color};">${value}</div>
        <div style="font-size:12px;color:#aaa;margin-top:4px;">${label}</div>
      </div>`).join("");

    // ── Similarity section ────────────────────────────────────────────────────
    const similarityRows = matches.map(({ dsi: d, ranked }) => {
        if (ranked.length === 0) {
            return `
            <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;padding:12px 16px;margin-bottom:8px;">
              <div style="display:flex;align-items:center;gap:10px;">
                ${bugLink(d, "font-weight:700;font-size:13px;")}
                <span style="color:#f0f0f0;font-size:13px;">${esc(d.title)}</span>
                ${stateBadge(d.state)} ${sevBadge(d.severity)}
                <span style="margin-left:auto;font-size:11px;color:#555;font-style:italic;">nessun match</span>
              </div>
            </div>`;
        }

        const matchRows = ranked.map(({ bug, score }) => {
            const pct = Math.round(score * 100);
            const isDup = score >= DUPLICATE_THRESHOLD;
            const rowBg = isDup ? "#2a1515" : "#1e1e1e";
            const borderColor = isDup ? "#d13438" : score >= 0.25 ? "#ca5010" : "#eda100";
            return `
              <tr style="background:${rowBg};border-bottom:1px solid #2a2a2a;">
                <td style="padding:8px 10px;border-left:3px solid ${borderColor};">
                  ${isDup ? '<span style="color:#d13438;font-weight:700;font-size:11px;">⚠ DUPLICATO</span>' : '<span style="color:#eda100;font-size:11px;">~ Affine</span>'}
                </td>
                <td style="padding:8px 10px;">${pctBar(pct, isDup)}</td>
                <td style="padding:8px 10px;">${bugLink(bug, "font-weight:700;font-size:13px;")}</td>
                <td style="padding:8px 10px;color:#e0e0e0;font-size:13px;">${esc(bug.title)}</td>
                <td style="padding:8px 10px;">${stateBadge(bug.state)}</td>
                <td style="padding:8px 10px;">${sevBadge(bug.severity)}</td>
                <td style="padding:8px 10px;color:#888;font-size:12px;">${esc(bug.suite)}</td>
              </tr>`;
        }).join("");

        const topScore = ranked[0].score;
        const topIsDup = topScore >= DUPLICATE_THRESHOLD;
        const cardBorderColor = topIsDup ? "#d13438" : topScore >= 0.25 ? "#ca5010" : "#eda100";

        return `
          <div style="background:#1a1a1a;border:1px solid ${cardBorderColor};border-radius:6px;margin-bottom:10px;overflow:hidden;">
            <div style="padding:12px 16px;border-bottom:1px solid #2a2a2a;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <span style="color:#8764b8;font-size:11px;font-weight:700;text-transform:uppercase;">DSI</span>
              ${bugLink(d, "font-weight:700;font-size:14px;")}
              <span style="color:#f0f0f0;font-size:13px;">${esc(d.title)}</span>
              ${stateBadge(d.state)} ${sevBadge(d.severity)}
              <span style="color:#888;font-size:12px;margin-left:4px;">${esc(d.assignedTo)}</span>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              ${matchRows}
            </table>
          </div>`;
    }).join("");

    // ── Bug tables ────────────────────────────────────────────────────────────
    const tableHeader = `
      <tr style="background:#252525;font-size:11px;text-transform:uppercase;color:#888;">
        <th style="padding:8px 10px;text-align:left;font-weight:600;">ID</th>
        <th style="padding:8px 10px;text-align:left;font-weight:600;">Titolo / Descrizione</th>
        <th style="padding:8px 10px;text-align:left;font-weight:600;">Stato</th>
        <th style="padding:8px 10px;text-align:left;font-weight:600;">Severity</th>
        <th style="padding:8px 10px;text-align:left;font-weight:600;">Area</th>
        <th style="padding:8px 10px;text-align:left;font-weight:600;">Assegnato</th>
      </tr>`;

    const dsiTableRows  = dsi.map((b)  => bugRow(b)).join("");
    const oursTableRows = ours.map((b) => bugRow(b)).join("");

    // ── Area overlap section ──────────────────────────────────────────────────
    // Groups bugs by functional area and shows DSI vs ours side-by-side.
    const allAreas = [...new Set([...dsi.map((b) => b.area), ...ours.map((b) => b.area)])].sort();
    const areaOverlapHtml = allAreas.map((area) => {
        const dsiInArea  = dsi.filter((b)  => b.area === area);
        const oursInArea = ours.filter((b) => b.area === area);
        if (dsiInArea.length === 0 && oursInArea.length === 0) return "";
        const overlap = dsiInArea.length > 0 && oursInArea.length > 0;
        const borderColor = overlap ? "#eda100" : "#2a2a2a";
        const badge = overlap
            ? `<span style="background:#3a2e00;color:#eda100;font-size:10px;padding:2px 8px;border-radius:3px;font-weight:700;">⚠ SOVRAPPOSIZIONE</span>`
            : `<span style="background:#1a1a1a;color:#555;font-size:10px;padding:2px 8px;border-radius:3px;">solo ${dsiInArea.length > 0 ? "DSI" : "nostri"}</span>`;

        const mini = (bugs: BugRecord[], color: string) =>
            bugs.map((b) => `<div style="padding:4px 0;border-bottom:1px solid #222;display:flex;align-items:center;gap:8px;">
              <a href="${bugUrl(b.id)}" target="_blank" style="color:${color};font-weight:700;font-size:12px;text-decoration:none;white-space:nowrap;">#${b.id}</a>
              <span style="font-size:12px;color:#d0d0d0;">${esc(b.title)}</span>
              <span style="margin-left:auto;flex-shrink:0;">${stateBadge(b.state)}</span>
            </div>`).join("");

        return `
          <div style="background:#1a1a1a;border:1px solid ${borderColor};border-radius:6px;margin-bottom:8px;overflow:hidden;">
            <div style="padding:10px 14px;background:#1e1e1e;display:flex;align-items:center;gap:10px;">
              <span style="font-weight:700;color:#f0f0f0;font-size:13px;">${esc(area)}</span>
              ${badge}
              <span style="margin-left:auto;font-size:11px;color:#666;">${dsiInArea.length} DSI · ${oursInArea.length} nostri</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
              <div style="padding:10px 14px;border-right:1px solid #2a2a2a;">
                <div style="font-size:10px;color:#8764b8;font-weight:700;text-transform:uppercase;margin-bottom:6px;">DSI (${dsiInArea.length})</div>
                ${dsiInArea.length ? mini(dsiInArea, "#b39ddb") : '<span style="font-size:12px;color:#444;font-style:italic;">nessuno</span>'}
              </div>
              <div style="padding:10px 14px;">
                <div style="font-size:10px;color:#00b7c3;font-weight:700;text-transform:uppercase;margin-bottom:6px;">NOSTRI (${oursInArea.length})</div>
                ${oursInArea.length ? mini(oursInArea, "#4fc3f7") : '<span style="font-size:12px;color:#444;font-style:italic;">nessuno</span>'}
              </div>
            </div>
          </div>`;
    }).join("");

    // ── Duplicates summary table ──────────────────────────────────────────────
    const dupSummaryHtml = duplicates.length === 0 ? `
      <div style="color:#107c10;font-size:13px;padding:12px;background:#0d1f0d;border-radius:6px;border:1px solid #1a3a1a;">
        ✓ Nessun duplicato rilevato
      </div>` : duplicates.map(({ dsi: d, our: o, score }) => `
      <div style="background:#2a1515;border:1px solid #d13438;border-radius:6px;padding:12px 16px;margin-bottom:8px;">
        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">
          <div style="flex:1;min-width:240px;">
            <div style="font-size:10px;color:#8764b8;font-weight:700;text-transform:uppercase;margin-bottom:4px;">DSI</div>
            ${bugLink(d)} <span style="color:#f0f0f0;font-size:13px;">${esc(d.title)}</span>
          </div>
          <div style="color:#555;align-self:center;font-size:18px;">↔</div>
          <div style="flex:1;min-width:240px;">
            <div style="font-size:10px;color:#00b7c3;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Nostro</div>
            ${bugLink(o)} <span style="color:#f0f0f0;font-size:13px;">${esc(o.title)}</span>
          </div>
          <div style="align-self:center;">${pctBar(Math.round(score * 100), true)}</div>
        </div>
      </div>`).join("");

    const simSummaryHtml = similar.length === 0 ? `
      <div style="color:#107c10;font-size:13px;padding:12px;background:#0d1f0d;border-radius:6px;border:1px solid #1a3a1a;">
        Nessuna corrispondenza per funzionalità affine
      </div>` : similar.map(({ dsi: d, our: o, score }) => `
      <div style="background:#1e1a0d;border:1px solid #eda100;border-radius:6px;padding:12px 16px;margin-bottom:8px;">
        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">
          <div style="flex:1;min-width:240px;">
            <div style="font-size:10px;color:#8764b8;font-weight:700;text-transform:uppercase;margin-bottom:4px;">DSI</div>
            ${bugLink(d)} <span style="color:#f0f0f0;font-size:13px;">${esc(d.title)}</span>
          </div>
          <div style="color:#555;align-self:center;font-size:18px;">↔</div>
          <div style="flex:1;min-width:240px;">
            <div style="font-size:10px;color:#00b7c3;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Nostro</div>
            ${bugLink(o)} <span style="color:#f0f0f0;font-size:13px;">${esc(o.title)}</span>
            <span style="color:#888;font-size:11px;margin-left:6px;">[${esc(o.suite)}]</span>
          </div>
          <div style="align-self:center;">${pctBar(Math.round(score * 100), false)}</div>
        </div>
      </div>`).join("");

    return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>DSI vs Nostri Bug – ${esc(sprint)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',system-ui,sans-serif;background:#121212;color:#e0e0e0;padding:24px;line-height:1.5}
    h1{font-size:22px;font-weight:700;color:#fff}
    h2{font-size:15px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #2a2a2a}
    section{margin-bottom:32px}
    table{width:100%;border-collapse:collapse}
    tr:hover td{background:#1e1e1e!important}
    a:hover{text-decoration:underline!important}
    @media print{body{background:#fff;color:#111}h2{color:#111;border-color:#ccc}}
  </style>
</head>
<body>

<div style="max-width:1100px;margin:0 auto;">

  <!-- Header -->
  <div style="margin-bottom:24px;">
    <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;">
      <h1>DSI vs Nostri Bug</h1>
      <span style="font-size:16px;color:#888;">${esc(sprint)}</span>
    </div>
    <div style="font-size:12px;color:#555;margin-top:4px;">Generato il ${now} · Soglie similarità testo: ≥40% duplicato, ≥10% affine</div>
  </div>

  <!-- Summary cards -->
  <section>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px;">
      ${summaryCards}
    </div>
  </section>

  <!-- Duplicate alert -->
  ${duplicates.length > 0 ? `
  <section>
    <h2>⚠ Probabili Duplicati (${duplicates.length})</h2>
    ${dupSummaryHtml}
  </section>` : ""}

  <!-- Similar -->
  <section>
    <h2>~ Funzionalità Affini (${dsiWithMatch.size} bug DSI univoci · ${oursInMatch.size} nostri bug coinvolti · ${similar.length} coppie totali)</h2>
    <div style="margin-bottom:8px;font-size:12px;color:#666;">
      Un bug DSI può matchare più dei nostri: il conteggio <em>coppie</em> è superiore al numero di bug univoci coinvolti.
    </div>
    ${simSummaryHtml}
  </section>

  <!-- Area overlap -->
  <section>
    <h2>Sovrapposizione per Area Funzionale</h2>
    <div style="margin-bottom:8px;font-size:12px;color:#666;">
      Le aree con ⚠ SOVRAPPOSIZIONE indicano che entrambi i team hanno trovato bug nella stessa funzionalità.
      Conteggio totale aree con sovrapposizione: <strong style="color:#eda100;">${allAreas.filter((a) => dsi.some((b) => b.area === a) && ours.some((b) => b.area === a)).length}</strong> su ${allAreas.length}
    </div>
    ${areaOverlapHtml}
  </section>

  <!-- Similarity matrix -->
  <section>
    <h2>Matrice Similarità Testo — ogni bug DSI vs i nostri</h2>
    <div style="margin-bottom:8px;font-size:12px;color:#666;">
      Ogni riga è un bug DSI. I match mostrati sono i nostri bug con similarità ≥ 10% sul testo (titolo + descrizione, prefissi NF-xxx rimossi).
      Il numero di <em>coppie</em> può superare il numero di bug DSI perché ogni DSI può matchare più dei nostri.
    </div>
    ${similarityRows}
  </section>

  <!-- DSI bug catalog -->
  <section>
    <h2>Catalogo Bug DSI (${dsi.length})</h2>
    <div style="border-radius:6px;overflow:hidden;border:1px solid #2a2a2a;">
      <table>
        ${tableHeader}
        ${dsiTableRows}
      </table>
    </div>
  </section>

  <!-- Our bug catalog -->
  <section>
    <h2>Catalogo Nostri Bug (${ours.length})</h2>
    <div style="border-radius:6px;overflow:hidden;border:1px solid #2a2a2a;">
      <table>
        ${tableHeader}
        ${oursTableRows}
      </table>
    </div>
  </section>

</div>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    if (!process.env.AZDO_PROJECT) {
        console.error("AZDO_PROJECT is not set in .env");
        process.exit(1);
    }

    const bugs = await fetchSprintBugs();
    if (bugs.length === 0) {
        console.log("Nessun bug trovato. Verifica SPRINT_FILTER in .env o passalo come variabile.");
        return;
    }

    const dsi  = bugs.filter((b) => b.suite === DSI_SUITE);
    const ours = bugs.filter((b) => b.suite !== DSI_SUITE);

    console.log(`DSI: ${dsi.length}   Nostri: ${ours.length}   Totale: ${bugs.length}`);

    const matches: Array<{ dsi: BugRecord; ranked: Array<{ bug: BugRecord; score: number }> }> = [];
    const duplicates: Array<{ dsi: BugRecord; our: BugRecord; score: number }> = [];
    const similar:    Array<{ dsi: BugRecord; our: BugRecord; score: number }> = [];

    for (const d of dsi) {
        const ranked = ours
            .map((o) => ({ bug: o, score: similarity(d, o) }))
            .filter((x) => x.score >= SIMILAR_THRESHOLD)
            .sort((a, b) => b.score - a.score)
            .slice(0, TOP_N);

        matches.push({ dsi: d, ranked });

        for (const { bug, score } of ranked) {
            if (score >= DUPLICATE_THRESHOLD) duplicates.push({ dsi: d, our: bug, score });
            else                              similar.push({    dsi: d, our: bug, score });
        }
    }

    console.log(`Duplicati: ${duplicates.length}   Affini: ${similar.length}`);

    const html = buildHtml(SPRINT_FILTER, dsi, ours, matches, duplicates, similar);
    const outPath = resolve(process.cwd(), "sprint-dsi-analysis.html");
    writeFileSync(outPath, html, "utf8");
    console.log(`\nReport scritto in: ${outPath}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
