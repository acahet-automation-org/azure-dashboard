import type { DashboardStats } from "../types.js";
import { escapeAttr } from "./htmlUtils.js";
import { renderPage } from "./layout.js";

export function renderDashboardPage(
    stats: DashboardStats,
    cacheTimestamp: number
): string {
    const {
        areaPaths,
        suites,
        priorities,
        totalTestCases,
        withOpenBugs,
        withoutOpenBugs,
        passedCount,
        failedCount,
        blockedCount,
        notRunCount,
        passRate,
        groupedByPriority,
    } = stats;

    const body = `
<p>
Last Refresh:
${new Date(cacheTimestamp).toLocaleString()}
</p>

<p>
Cache Duration:
5 Minutes
</p>

<div class="filter-box">

<label>
Area Path:
</label>

<select id="areaFilter">
<option value="">
All Areas
</option>

${areaPaths
            .map(
                (p) => `
<option value="${p}">
${p}
</option>
`
            )
            .join("")}

</select>
<label>
Suite:
</label>

<select id="suiteFilter">

  <option value="">
    All Suites
  </option>

  ${suites
            .map(
                (s) => `
      <option value="${s}">
        ${s}
      </option>
    `
            )
            .join("")}

</select>

<label>
Priority:
</label>

<select id="priorityFilter">

  <option value="">
    All Priorities
  </option>

  ${priorities
            .map(
                (p) => `
      <option value="${p}">
        Priority ${p}
      </option>
    `
            )
            .join("")}

</select>

<label>
Search:
</label>

<input
  type="text"
  id="searchFilter"
  placeholder="Search test case title..."
/>

</div>

<div class="stats">

<div class="card">
<strong>Total Test Cases</strong>
<br>
<span id="statTotal">${totalTestCases}</span>
</div>

<div class="card">
<strong>With Open Bugs</strong>
<br>
<span id="statWithBugs">🔴 ${withOpenBugs}</span>
</div>

<div class="card">
<strong>Tests without bugs</strong>
<br>
<span id="statWithoutBugs">✅ ${withoutOpenBugs}</span>
</div>

<div class="card">
<strong>Active Bugs</strong>
<br>
<span id="statActiveBugs">🐞 0</span>
</div>

<div class="card">
<strong>Closed Bugs</strong>
<br>
<span id="statClosedBugs">✔ 0</span>
</div>

<div class="card">
<strong>Passed</strong>
<br>
<span id="statPassed">✅ ${passedCount}</span>
</div>

<div class="card">
<strong>Failed</strong>
<br>
<span id="statFailed">❌ ${failedCount}</span>
</div>

<div class="card">
<strong>Blocked</strong>
<br>
<span id="statBlocked">⛔ ${blockedCount}</span>
</div>

<div class="card">
<strong>Not Run</strong>
<br>
<span id="statNotRun">⬜ ${notRunCount}</span>
</div>

<div class="card">
<strong>Pass Rate</strong>
<br>
<span id="statPassRate">${passRate}%</span>
</div>

</div>

${Object.entries(groupedByPriority)
            .sort(
                ([a], [b]) => Number(b) - Number(a)
            )
            .map(([priority, testCases]) => {
                const suiteGroups: Record<
                    string,
                    typeof testCases
                > = {};

                testCases.forEach((tc) => {
                    if (
                        !suiteGroups[tc.suiteName]
                    ) {
                        suiteGroups[
                            tc.suiteName
                        ] = [];
                    }

                    suiteGroups[
                        tc.suiteName
                    ].push(tc);
                });

                return `
      <div class="priority">

        <h2>
          Priority ${priority}
        </h2>

        ${Object.entries(suiteGroups)
                        .sort(([a], [b]) =>
                            a.localeCompare(b)
                        )
                        .map(
                            ([
                                suiteName,
                                suiteTests,
                            ]) => `

              <details
                class="suite-group"
                open
              >

                <summary>
                  📁 ${suiteName}
                  <span
                    class="suite-count"
                    data-total="${suiteTests.length}"
                  >
                    (${suiteTests.length})
                  </span>
                </summary>

                ${suiteTests
                                .map((tc) => {
                                    const activeBugCount =
                                        tc.bugs.filter(
                                            (b) =>
                                                b.state !==
                                                "Closed"
                                        ).length;

                                    const closedBugCount =
                                        tc.bugs
                                            .length -
                                        activeBugCount;

                                    return `

<div
  class="testcase ${tc.hasOpenBugs
                                            ? "has-bugs"
                                            : ""
                                        }"
  data-area="${escapeAttr(tc.areaPath)}"
  data-suite="${escapeAttr(tc.suiteName)}"
  data-title="${escapeAttr(
                                            tc.testCaseTitle
                                        )}"
  data-priority="${tc.priority}"
  data-bug-active="${activeBugCount}"
  data-bug-closed="${closedBugCount}"
  data-outcome="${tc.outcome}"
>


                        <strong>
                          ${tc.hasOpenBugs
                                            ? "🔴"
                                            : "✅"
                                        }
                          ${tc.testCaseUrl
                                            ? `<a href="${escapeAttr(
                                                tc.testCaseUrl
                                            )}" target="_blank" rel="noopener noreferrer">${tc.testCaseTitle}</a>`
                                            : tc.testCaseTitle
                                        }
                        </strong>

                        <span
                          class="outcome-badge outcome-${tc.outcome.toLowerCase()}"
                        >
                          ${tc.outcome}
                        </span>

                        <div class="suite">
                          Area:
                          ${tc.areaPath}
                        </div>

                        <div class="suite">
                          Bugs linked:
                          ${tc.bugs.length}
                          (🐞 ${activeBugCount} active,
                          ✔ ${closedBugCount} closed)
                        </div>

                        ${tc.bugs.length
                                            ? tc.bugs
                                                .map(
                                                    (
                                                        bug
                                                    ) => `
                                    <div class="bug">

                                      ${bug.state !==
                                                            "Closed"
                                                            ? "🐞"
                                                            : "✔"
                                                        }

                                      ${bug.id}
                                      -
                                      ${bug.title}

                                      <span class="${bug.state !==
                                                            "Closed"
                                                            ? "active"
                                                            : "closed"
                                                        }">
                                        (${bug.state})
                                      </span>

                                    </div>
                                  `
                                                )
                                                .join("")
                                            : `
                                <div class="bug">
                                  0 bugs
                                </div>
                              `
                                        }

                      </div>
                    `;
                                })
                                .join("")}

              </details>

            `
                        )
                        .join("")}

      </div>
    `;
            })
            .join("")}

<script src="/dashboard.js"></script>
`;

    return renderPage(
        "QA Dashboard",
        "dashboard",
        body
    );
}
