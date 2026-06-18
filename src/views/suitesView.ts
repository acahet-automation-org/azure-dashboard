import type { SuiteStat } from "../types.js";
import { escapeAttr } from "./htmlUtils.js";
import { renderPage } from "./layout.js";

export function renderSuitesPage(
    suiteStats: Record<string, SuiteStat>
): string {
    const suiteNames = Object.keys(
        suiteStats
    ).sort();

    const body = `
<div class="suite-grid">

${suiteNames
            .map((suiteName) => {
                const stat = suiteStats[suiteName];

                const passRate = stat.total
                    ? Math.round(
                        (stat.passed /
                            stat.total) *
                        1000
                    ) / 10
                    : 0;

                return `
<a
  class="suite-card"
  href="/dashboard?suite=${encodeURIComponent(
                    suiteName
                )}"
>
  <h3>📁 ${escapeAttr(suiteName)}</h3>

  <div class="suite-stat-row">
    Total: ${stat.total}
  </div>

  <div class="suite-stat-row">
    ✅ ${stat.passed}
    ❌ ${stat.failed}
    ⛔ ${stat.blocked}
    ⬜ ${stat.notRun}
  </div>

  <div class="suite-stat-row">
    🔴 Open Bugs: ${stat.openBugs}
  </div>

  <div class="suite-stat-row pass-rate">
    Pass Rate: ${passRate}%
  </div>
</a>
`;
            })
            .join("")}

</div>
`;

    return renderPage(
        "QA Dashboard - Suites",
        "suites",
        body
    );
}
