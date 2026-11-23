# Build notes · what was reproduced and what was not

## Chronic Care Studio (`apps/chronic-care-studio`)

Reference: `data/source/Chronic-Care-Studio.html` = **Chronic-Care-Studio_7.html** ("Chronic Care Studio · Control Command Center", PureHealth branding). The Figma files themselves were not in the brief; this HTML is the Figma export and is treated as the design.

- **Screen 1 · Cohorts**: Build / Library / Campaigns. Base population with live counts, add-rule box and templates, include / exclude rules (all / any), "Who you've got" funnel, profile / sample / overlap, compiled SQL and checks, cohort library with versions, campaign calendar and cards, campaign dialog with the design's three steps (Who → What → Review), hand-off that runs the engine. Every count is `POST /api/cohorts/estimate` over the 377-column table.
- **Screen 2 · Care intelligence**: filters, ranked member list, member header, risk card (R/23, five components, Excel reference), why now, care plan card ("in order · safety first" as designed, with a second view in the portal's Current / Next / Future layout with care-gap lifecycle and cadence), next-best-action card, programme per trigger, run history, "Why this score" lineage drawer.
- **Screen 3 · Care portal**: nurse picker, today / queued / scheduled / nudge lists, the standalone portal embedded for the selected member, summary fallback.
- Not reproduced: the knowledge-graph "describe" panel (the demo compiles SQL over the longitudinal table instead), the wearable early-warning tile (no wearable data in either workbook), PURA population (not in the extract, shown as 0).

## Care Coordinator Portal (`apps/care-coordinator-portal`)

Reference: `data/source/Care-Coordinator-Portal.html` = **Care-Coordinator-Portal (3).html** ("Care Coordinator Portal · Control Command Center"); its stylesheet is ported as `src/portal.css`.

- Login (design's sign-in screen mapped onto the demo nurse accounts), queue of flagged members in rulebook order, member workspace (call workflow, Member 360, care gaps and plan, intelligence, timeline), actions with calendar, care plans, shift analytics.
- Call workflow: contact → consent (gate G2) → review (member assertions) → actions per CURRENT need (agree / already done / declined / carry, book) → outcome; RED guard and red-flag escalation.
- Member 360 reads only raw-claims endpoints; claim ids open the activity lines and lab observations of that claim.
- Not reproduced: wearables and deterioration predictions (no source data) and the 0–100 priority score (replaced by the rulebook's P1–P4, R and tier).

## Cohort → intelligence → portal (Studio scope)

- Hand-off from the campaign dialog stores the campaign in `app_setting.studio_scope` (`POST /api/studio/scope`). Members = the campaign's include cohorts minus its exclude cohorts (`cohort_member`), control group included and flagged.
- `GET /api/intelligence/members|kpis?scope=active` and `GET /api/portal/worklist?scope=active` return only those members. The Studio header counts, the intelligence list, filters and KPIs, screen 3 and the portal queue all follow the scope; *Show all members* (Studio) and *My list* (portal) switch it off.
- Screen 3 has one bar: the nurse the embedded portal is signed in as (passed as `?as=<username>`), the scope chip, list counts, open in portal, summary view. The embedded portal hides its own header.
- Care plans: the Current · Next · Future board is the default in the Studio and the first panel of the portal's care plan, with the same card content (class, due, next best action, owner, done when, rule, action line).
- Intelligence shows the tier (Tier n · label) and the contact priority (Pn · colour) on every member row and in the member header.

## Backend

- `member_longitudinal` keeps every header of the longitudinal workbook as a column; rule evaluation reads it through a typed vector (dates as days before the as-of date).
- The engine reproduces the workbook's own component scores for 250/250 members once three mapping decisions are recorded as rule rows (D1–D3 in `docs/rulebook/decisions.md`).
- Raw claims are normalised into member, member_policy, provider, clinician, diagnosis_code, claim, claim_activity, lab_observation and observation_dictionary; encounter, pharmacy_claim, procedure_activity and diagnosis are views.
