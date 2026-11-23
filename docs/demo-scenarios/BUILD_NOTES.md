# Build notes · what was reproduced and what was not

## Chronic Care Studio (`apps/chronic-care-studio`)

Reference: `data/source/Chronic-Care-Studio.html` (built from the Figma; the Figma files themselves were not in the brief).

- **Screen 1 · Cohort & campaign builder**: base population radios with live counts, rule builder (include / exclude, all / any), per-rule and funnel counts, unsupported-rule warnings, profile and sample members, compiled SQL, templates, cohort library with versions, campaign setup (automated vs business triggers, channels, capacity, start, priority), status changes, "hand off to care intelligence" (runs the engine). Every count is `POST /api/cohorts/estimate` over the 377-column table.
- **Screen 2 · Care intelligence**: KPIs, filters, ranked member list, member panel (R/23 with the five components and caps, extract reference score, tier and cadence, alert and priority with reasons, 14-row rulebook table with evidence, inputs and logic, care plan CURRENT/NEXT/FUTURE/CLOSED, action chain), "Why this score" lineage drawer, programme per-trigger table, run history, run now.
- **Screen 3 · Care portal**: nurse picker, today/queued/scheduled/nudge lists, the standalone portal embedded for the selected member, with a summary fallback.
- Not reproduced: the knowledge-graph "describe" panel (replaced by a catalogue parser; the kit compiles SQL), the wearable early-warning tile (no wearable data in either workbook), PURA population (not in the extract, shown as 0).

## Care Coordinator Portal (`apps/care-coordinator-portal`)

Reference: `data/source/Care-Coordinator-Portal.html` (its stylesheet was ported as `src/portal.css`).

- Login (demo accounts), queue with rulebook ordering, member workspace with tabs Call · Member 360 · Care gaps & plan · Intelligence · Timeline, tasks (list and calendar), care plans, analytics, dark mode.
- Call workflow: contact → consent (gate G2) → review (member assertions) → actions per CURRENT need (agree / already done / declined / carry, book) → outcome; red-flag handling and the RED guard.
- Member 360 reads only raw-claims endpoints; claim ids open a drawer with the activity lines and lab observations of that claim.
- Not reproduced: the "Data lens" panel, wearables page and deterioration predictions (no source data), the free-text history builder, the pathway/decision-tree library pages, and the 0–100 priority score (replaced by the rulebook's P1–P4, R and tier). A red flag is recorded when the call starts (the API takes it on `POST /api/portal/calls`).

## Backend

- `member_longitudinal` keeps every header of the longitudinal workbook as a column; rule evaluation reads it through a typed vector (dates as days before the as-of date).
- The engine reproduces the workbook's own component scores for 250/250 members once three mapping decisions are recorded as rule rows (D1–D3 in `docs/rulebook/decisions.md`).
- Raw claims are normalised into member, member_policy, provider, clinician, diagnosis_code, claim, claim_activity, lab_observation and observation_dictionary; encounter, pharmacy_claim, procedure_activity and diagnosis are views.
