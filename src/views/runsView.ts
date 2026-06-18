import type { RunCard } from "../types.js";
import { escapeAttr } from "./htmlUtils.js";
import { renderPage } from "./layout.js";

export function renderRunsPage(
  runCards: RunCard[]
): string {
  const body = `
<div class="suite-grid">

${runCards
      .map((run) => {
        return `
<a
  class="suite-card"
  href="${run.url
            ? escapeAttr(run.url)
            : "#"
          }"
  target="_blank"
  rel="noopener noreferrer"
>
  <h3>🏃 ${escapeAttr(run.name)}</h3>

  <div class="suite-stat-row">
    State: ${escapeAttr(run.state)}
  </div>

  <div class="suite-stat-row">
    Completed:
    ${run.completedDate
            ? new Date(
              run.completedDate
            ).toLocaleString()
            : "N/A"
          }
  </div>

  <div class="suite-stat-row">
    Total: ${run.total}
  </div>

  <div class="suite-stat-row">
    ✅ ${run.counts.Passed}
    ❌ ${run.counts.Failed}
    ⛔ ${run.counts.Blocked}
    ⬜ ${run.counts.NotRun}
  </div>

  <div class="suite-stat-row pass-rate">
    Pass Rate: ${run.passRate}%
  </div>
</a>
`;
      })
      .join("")}

</div>
`;

  return renderPage(
    "QA Dashboard - Last 10 Runs",
    "runs",
    body
  );
}
