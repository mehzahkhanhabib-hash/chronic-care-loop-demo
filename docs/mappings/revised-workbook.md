# CCC_Revised_Raw_Member360_Longitudinal_Care_Intelligence.xlsx → implementation

The workbook separates the three data sources and names the objects the demo must expose. Every object it names exists in the database under that name (as a table or a view over the kit's tables), so each sheet can be read against the database 1:1.

## START – Architecture (8 steps)

| step | workbook object | implementation | file |
|---|---|---|---|
| 01 | Raw claims / in → claims database tables | `member`, `member_policy`, `provider`, `clinician`, `diagnosis_code`, `claim`, `claim_activity` in `claims.sqlite`; `mask_id` is the member key | `backend/importers/claims.js`, `backend/database/schema_claims.sql` |
| 02 | Lab Results → `lab_observation` | `lab_observation`; member and date copied from `claim_activity` through `ACTIVITY_ID` (labs never join member directly) | same |
| 03 | Longitudinal / Sheet1 → `longitudinal_member` | table `member_longitudinal` (377 columns, original headers) + view `longitudinal_member` | `backend/importers/longitudinal.js`, `backend/database/views_revised.sql` |
| 04 | risk_point_rule; risk_tier_rule; alert_rule | `risk_score_band` (RS-C-001 …), `rule_tier` / view `risk_tier`, `rule_alert` + `rule_condition` / view `alert_rule`; engine returns the recalculated score and keeps the snapshot scores beside it (`member_risk_result.extract_*`) | `data/seed/rules/*.csv`, `backend/rule-engine/engine.js` |
| 05 | trigger_rule; trigger_input_binding; next_best_action | `rule_trigger` / view `clinical_trigger`, view `trigger_input_binding` (from `rule_input`), `rule_action` / view `next_best_action`; the file's `Trig*_` flags are kept as `extract_flag` references only | same |
| 06 | member_risk_result; member_trigger_result; member_need | `member_risk_result`; view `member_trigger_result` (over `member_rule_evaluation`, state fired / cannot_tell / not_fired + evidence); view `member_need` (over `care_need`) | `backend/database/schema_ccl.sql`, `views_revised.sql` |
| 07 | member360_v; care_intelligence_member_v; care_intelligence_need_v | views `member360_v`, `member360_claims_v`, `member360_labs_v` (claims.sqlite) and `care_intelligence_member_v`, `care_intelligence_trigger_v`, `care_intelligence_need_v`, `care_intelligence_worklist_v` (ccl.sqlite); the portal reads them through the API (`GET /api/rules/<view name>` returns any of them raw) | `views_revised.sql`, `views_revised_claims.sql` |
| 08 | consent_event; disposition_event; member_assertion; care_gap_event | same names, Layer E; applied by `writeback.js`; read by the next run | `backend/rule-engine/writeback.js` |

## Member 360 from RAW (19 elements)

Every element row maps to a raw-claims column set in `claims.sqlite`; the two "Care journey" overlays (clinical priorities / NBA, nurse activity) come from the intelligence and operational layers, as the sheet requires. See `docs/mappings/raw-claims-to-tables.md` for the column-level map and `docs/mappings/LINEAGE.md` for the screen elements.

## CI Score Input Contract (9 components)

Implemented by `risk_score_band.csv` + `rule_risk_component.csv`; the contract's "existing derived reference" columns are stored as `member_risk_result.extract_*` and `matches_extract`. Note the three column decisions D1–D3 in `docs/rulebook/decisions.md` (HbA1c scope, lifetime comorbidity flags, condition-related utilisation) that make the recalculated total equal the snapshot for all 250 members.

## CI Trigger Input Contract (14 triggers)

Implemented by `rule_trigger.csv` (ids Trig1…Trig13, BPU), `rule_condition.csv` (inputs and thresholds), `rule_action.csv` (next-best action, owner), `rule_need_class.csv` (need class, order). The contract's "existing longitudinal trigger flag" is `rule_trigger.extract_flag`.

## Join Keys and Grain (6 joins)

All six joins exist with the stated grain: `longitudinal_member.mask_id → claim_activity.mask_id` (1:many, never used in scoring), `claim_activity.ACTIVITY_ID → lab_observation.ACTIVITY_ID`, `care_intelligence_member_v.member_id → longitudinal_member.mask_id` (latest run), `care_intelligence_trigger_v` many:1 member, `care_intelligence_need_v.trigger_result_id → care_intelligence_trigger_v.trigger_result_id`, `consent_event.member_id` logical member join.

## Portal Output Contract (16 columns)

| view.column | served by |
|---|---|
| care_intelligence_member_v.member_id, latest_hba1c_value, latest_hba1c_date, risk_score, risk_tier, alert_colour, safety_flag | view of the same name; API `GET /api/members/:id` (`identity`, `risk`) |
| care_intelligence_trigger_v.trigger_id, trigger_state, evidence_json | view of the same name; API `GET /api/members/:id/evaluations` |
| care_intelligence_need_v.need_class, nba_text, need_position | view of the same name; API `GET /api/members/:id/care-plan` |
| care_intelligence_worklist_v.contact_priority | view of the same name; API `GET /api/portal/worklist` |
| member360_claims_v.claim_id, member360_labs_v.observation_id | views in claims.sqlite; API `GET /api/members/:id/claims`, `/labs` |

## 377 Longitudinal Fields

The usage classes (JOIN KEY, CI FEATURE INPUT, REFERENCE / PRECOMPUTED, OTHER SOURCE COLUMN) match `longitudinal_field.read_by_rules` and `docs/mappings/longitudinal-catalogue.md`; all 377 columns are kept.
