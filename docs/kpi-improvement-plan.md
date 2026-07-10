# QA Dashboard — KPI Improvement Plan

## Context

This plan identifies KPI gaps in the current dashboard and defines new metrics to add, prioritised by stakeholder value. The current dashboard covers 30+ metrics but they are **activity-oriented** (what ran, what failed) rather than **value-oriented** (how QA impacted quality and speed of delivery). Stakeholders cannot answer "is the QA team doing a good job?" from the current data alone.

> **Scope note:** Automation KPIs are out of scope for this iteration and will be addressed separately.

---

## Current State — What We Already Have

| Category | KPIs Present |
|---|---|
| Test Execution | Pass rate, blocked/failed counts, not-run count |
| Defects | MTTR, leakage, rejection, reopen, duplicate, first-time fix |
| Progress | Suite/plan rollup, run cards |
| Errors | Top error signatures |

---

## Priority 1 — High Value, Low-to-Medium Effort

### 1.1 Quality Health Score & RAG Status
**Stakeholders:** Product Owners, Release Managers, C-Level

A single composite score (0–100) that weights pass rate, critical open defects, and not-executed % against configurable exit criteria thresholds. Derived RAG (Red / Amber / Green) status per plan/sprint.

**Logic:**
- Green: pass rate ≥ 95%, 0 critical open bugs, not-run ≤ 2%
- Amber: pass rate ≥ 80%, ≤ 2 critical open bugs, not-run ≤ 10%
- Red: anything below Amber thresholds

**Exit Criteria Met %:** how many of the defined quality gates have been satisfied (e.g., "7/10 criteria met").

**Implementation:**
- New backend endpoint in `src/` reads configurable thresholds from `.env` or a JSON config file
- Aggregates pass rate + open Sev1/Sev2 bug count + not-run % into a computed score
- New component on `/plan-progress` or a new `/release-readiness` page
- Effort: Medium

---

### 1.2 Sprint Test Completion Rate & Carry-Over
**Stakeholders:** QA Manager, Scrum Master, PMO

- **Sprint Test Completion Rate** — % of planned test cases actually executed by sprint end
- **Carry-Over Test Cases** — test cases not executed that slipped to the next sprint (direct measure of under-capacity or late dev delivery)

**Implementation:**
- Already in `TestPlanProgressCounts` — compare planned count at sprint start vs actual executed at sprint end
- Requires either snapshot storage (persist a JSON per sprint) or use Azure DevOps iteration dates to filter the OData history
- Effort: Low

---

### 1.3 Sprint-over-Sprint Pass Rate Delta
**Stakeholders:** QA Manager, Engineering Leadership, Scrum Master

Did quality improve or regress vs the previous sprint? Surface as a delta indicator (arrow + % change).

**Implementation:**
- `TrendPoint` data already exists — compute `current.passRate - previous.passRate` per sprint
- Add a delta column/indicator to the existing trend view
- Effort: Low

---

### 1.4 Blocking Defects at Release
**Stakeholders:** Product Owners, Release Managers

Count of open Severity 1 and Severity 2 bugs still unresolved at sprint close, tracked over time as a trend.

**Implementation:**
- Filter existing defect data by severity + state + iteration close date
- Already have severity breakdown in `DefectStats` — add a sprint-boundary snapshot
- Effort: Low

---

## Priority 2 — High Value, Medium Effort

### 2.1 QA Team Productivity per Tester per Sprint
**Stakeholders:** QA Manager, HR, Engineering Leadership

Shows what each team member contributed — makes individual and team throughput visible without requiring a separate tracker.

**KPIs:**
- Test cases executed per tester per sprint
- Bug reports raised per tester per sprint
- Test execution velocity (tests completed per day during the active test window)

**Implementation:**
- Work Items API already returns `assignee` on test results
- Group `TestPointHistorySnapshot` by tester identity — already available in OData
- New chart/table on `/defects` or a new `/team-productivity` page
- Effort: Medium

---

### 2.2 Defect Detection Phase Breakdown
**Stakeholders:** Engineering Leadership, Product, Audit

Shows in which phase bugs were found: Dev | QA | UAT | Production. The earlier the phase, the cheaper the fix — this makes QA's cost-saving contribution visible.

**Prerequisite:** A "Found In" environment field must exist (or be created) on Azure DevOps work items.

**KPIs:**
- % bugs found in each phase (donut chart)
- Trend of phase distribution over sprints

**Implementation:**
- If "Found In" custom field exists: filter `defectData.ts` on that field
- Add donut chart to the existing `/defects` page
- Effort: Medium (Low if field already exists)

---

### 2.3 Defect Escape Rate
**Stakeholders:** Engineering Leadership, Product, Audit

% of total bugs that were first reported in production (not found by QA). This is the single most important QA quality indicator for external stakeholders.

**Formula:** `Production bugs / (QA bugs + UAT bugs + Production bugs) × 100`

**Prerequisite:** Same "Found In" environment field as 2.2.

**Implementation:**
- Once "Found In" field is tagged: add a dedicated metric card to `/defects` overview tab
- Show trend over last N sprints
- Effort: Medium (depends on 2.2 prerequisite)

---

### 2.4 Bug Fix Validation Cycle Time
**Stakeholders:** QA Manager, Scrum Master

Average time (hours/days) from a bug being marked "Fixed/Resolved" by dev to QA completing the retest. Highlights bottlenecks in the dev↔QA handoff loop.

**Implementation:**
- Work Item Revisions API already used for reopen tracking
- Compute delta between state transition timestamps: `Resolved` → `Active` (retest failed) or `Resolved` → `Closed` (retest passed)
- Add a metric card + distribution histogram to `/defects`
- Effort: Medium

---

## Priority 3 — Medium Value, Higher Effort

### 3.1 Requirements Traceability Coverage
**Stakeholders:** Product Owners, Business Analysts, Compliance/Audit

% of user stories / acceptance criteria that have at least one linked test case. Identifies stories being shipped without test coverage.

**KPIs:**
- Requirements coverage % overall
- Untested stories per sprint (user stories with no associated test execution)
- Test case density per story point (avg test cases per story point)
- New feature test coverage rate (for newly delivered features this sprint)

**Prerequisite:** Test cases must be linked to user stories in Azure DevOps (via Related Work links).

**Implementation:**
- Requires querying Work Item links via REST API to map test cases → stories
- New backend function in `src/` and a new page or tab
- Effort: High

---

### 3.2 Test Case Effectiveness Rate
**Stakeholders:** QA Manager (internal QA use)

How targeted is the test suite? Low-effectiveness tests are bloated or misaligned to risk.

**Formula:** `Bugs found / Total test cases executed × 100`

**Implementation:**
- Cross-reference failed test cases that have linked bugs
- Add as a metric card to the existing `/test-execution` page
- Effort: Low

---

### 3.3 Defect Injection Rate
**Stakeholders:** Engineering Leadership, Scrum Master

New bugs opened / story points delivered per sprint. Shows whether development quality is improving or degrading sprint over sprint.

**Prerequisite:** Story point data must be accessible (from linked user stories in the same iteration).

**Implementation:**
- Combine defect count per sprint (already available) with story points from AZDO sprint work items
- Add a trend chart to `/defects`
- Effort: Medium-High

---

## Recommended New Page: Executive Summary

The highest single-impact addition is a new `/executive-summary` page that consolidates:

1. **Quality Health Score** — large dial/gauge (0–100)
2. **RAG release readiness** — per active sprint/plan
3. **Sprint comparison table** — last 4 sprints: pass rate, defects opened, defects closed, escape rate
4. **Top 3 risks** — highest-severity open defects blocking release
5. **QA team throughput** — tests executed this sprint vs last sprint
6. **Defect trend** — backlog growing/stable/shrinking (`DefectStats.backlogDirection` already computed)

This page makes the dashboard usable in a stakeholder review meeting without requiring the audience to navigate 14 routes.

---

## Priority & Effort Summary

| # | KPI | Stakeholder | Effort | Priority |
|---|---|---|---|---|
| 1.1 | Quality Health Score / RAG | C-Level, PO, RM | Medium | **P1** |
| 1.2 | Sprint Test Completion Rate + Carry-Over | QA Mgr, Scrum | Low | **P1** |
| 1.3 | Sprint-over-Sprint Pass Rate Delta | QA Mgr, Engineering | Low | **P1** |
| 1.4 | Blocking Defects at Release | PO, RM | Low | **P1** |
| 2.1 | QA Team Productivity per Tester | QA Mgr, HR | Medium | **P2** |
| 2.2 | Detection Phase Breakdown | Engineering, Audit | Medium | **P2** |
| 2.3 | Defect Escape Rate | Engineering, PO | Medium | **P2** |
| 2.4 | Bug Fix Validation Cycle Time | QA Mgr, Scrum | Medium | **P2** |
| 3.1 | Requirements Traceability Coverage | PO, BA, Audit | High | **P3** |
| 3.2 | Test Case Effectiveness Rate | QA Team | Low | **P3** |
| 3.3 | Defect Injection Rate | Engineering, Scrum | Medium-High | **P3** |

---

## Pre-Implementation Checklist

Before starting P2 items, confirm the following in Azure DevOps:

- [ ] Is there a "Found In" / "Environment" field on bug work items? (Unlocks 2.2 and 2.3)
- [ ] Are exit criteria thresholds defined for pass rate, critical bugs, not-run %? (Unlocks 1.1)
- [ ] Are test cases linked to user stories via "Related Work" links? (Unlocks 3.1)
- [ ] Is "Story Points" field populated on sprint stories? (Unlocks 3.3)
- [ ] Is iteration / sprint start-end date data reliable in AZDO? (Unlocks 1.2 snapshot approach)

---

## Notes

- All P1 items can be built from data already available via existing Azure DevOps OData and REST API calls — no new data sources required.
- P2 items require either a new custom field in Azure DevOps ("Found In") or additional API calls to work item revisions.
- P3 items require structural prerequisites in Azure DevOps (linked work items, story points) that the QA/dev team must align on first.
- The Executive Summary page should be built alongside or immediately after P1 items, as it is the primary stakeholder-facing output.
