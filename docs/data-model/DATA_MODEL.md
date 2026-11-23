# Data model

Two SQLite files in `data/db/` (built by `npm run setup`). Layer A is the raw-claims world (Member 360). Layers B–E are the longitudinal features, the rule database, the care-intelligence outputs and the operational write-back tables. `TEXT` dates are ISO `YYYY-MM-DD`. Views are marked (view). Row counts are from the seeded demo database.

Relationships are drawn in [ERD.md](ERD.md). SingleStore does not enforce foreign keys and neither does the demo at write time in bulk loads; the importer checks `PRAGMA foreign_key_check` after loading.


## Layer A · Raw claims (claims.sqlite)

### `claim` · 34,407 rows
one row per CLAIM_ID (34,407)

| column | type | note |
|---|---|---|
| `claim_id` 🔑 | TEXT | CLAIM_ID |
| `mask_id` | TEXT |  |
| `episode_id` | TEXT | EPISODE_ID |
| `audit_id` | TEXT | AUDIT_ID |
| `policy_id` | TEXT | POLICY_ID |
| `provider_id` | TEXT |  |
| `clinician_id` | TEXT | first clinician on the claim |
| `bg_ipop` | TEXT | BG_IPOP (IP / OP) |
| `admit_desc` | TEXT | ADMIT_DESC (Elective / Emergency / Transfer …) |
| `discharge_desc` | TEXT | DISC_DESCRIPTION |
| `service_date` | TEXT | MIN(DATEOFSERVICE) |
| `service_date_to` | TEXT | MAX(DATEOFSERVICE) |
| `admit_date` | TEXT | ADMIT_DATE |
| `discharge_date` | TEXT | DISCHARGE_DATE |
| `los_days` | REAL | LOS_DAYS |
| `cyyyymm` | TEXT | CYYYYMM |
| `cy` | INTEGER | CY |
| `invoice_status` | TEXT | INVOICESTATUS |
| `primary_diagnosis_id` | TEXT | first DIAGNOSIS_ID on the claim |
| `category` | TEXT | CATEGORY (specialty of the claim) |
| `major` | TEXT | MAJOR (clinician grade) |
| `activity_count` | INTEGER |  |
| `payable` | REAL | SUM(PAYABLE) |
| `claimed` | REAL | SUM(CLAIMED) |
| `denial` | REAL | SUM(DENIAL) |

### `claim_activity` · 144,292 rows
one row per source line (144,292)

| column | type | note |
|---|---|---|
| `activity_row_id` 🔑 | INTEGER | surrogate (ACTIVITYDETAIL_ID is not unique in the source) |
| `claim_id` | TEXT |  |
| `mask_id` | TEXT |  |
| `activity_id` | TEXT | ACTIVITY_ID (join key for lab_observation) |
| `activity_detail_id` | TEXT | ACTIVITYDETAIL_ID |
| `activity_detail_type` | TEXT | ACTIVITYDETAILTYPE_ID (CPT4 / MOHENH / HCPCS / …) |
| `activity_desc` | TEXT | ACTIVITY_DESC |
| `service_id` | TEXT | SERVICE_ID |
| `service_desc` | TEXT | SER_DESC |
| `service_group` | TEXT | SERVICEGROUP |
| `cpt_category` | TEXT | CPTCATEGORY3 |
| `cost_block` | TEXT | COSTBLOCK (Drugs / Lab and Path / Consultation / Procedures …) |
| `benefit_group_type` | TEXT | BENEFITGROUPTYPE2 |
| `benefit_desc` | TEXT | BENEFIT_DESC |
| `health_code` | TEXT | HEALTHCODE |
| `diagnosis_id` | TEXT | DIAGNOSIS_ID |
| `clinician_id` | TEXT | CLINICIAN_ID |
| `service_date` | TEXT | DATEOFSERVICE |
| `payable` | REAL | PAYABLE |
| `claimed` | REAL | CLAIMED |
| `denial` | REAL | DENIAL |
| `drug_quantity` | REAL | DRUG_QUANTITY |
| `package_size` | TEXT | PACKAGESIZE |
| `package_unit` | TEXT | PACKAGEUNIT |
| `dosage_form` | TEXT | DOSAGEFORM |
| `generic_name` | TEXT | GENERICNAME |
| `drug_category` | TEXT | DRUG_CATEGORY |
| `drug_tier` | TEXT | DRUG_TIERS |
| `concatenated` | TEXT | Concatenated (service+provider key) |
| `category` | TEXT | CATEGORY |
| `major` | TEXT | MAJOR |

### `clinician` · 3,537 rows

| column | type | note |
|---|---|---|
| `clinician_id` 🔑 | TEXT | CLINICIAN_ID |
| `clinician_name` | TEXT | CLINICIAN_NAME |
| `profession` | TEXT | PROFESSION |
| `specialty` | TEXT | SPECIALTY |

### `diagnosis_code` · 1,866 rows
ICD-10 dimension

| column | type | note |
|---|---|---|
| `diagnosis_id` 🔑 | TEXT | DIAGNOSIS_ID (ICD-10 code) |
| `group2` | TEXT | GROUP2 (block) |
| `group3` | TEXT | GROUP3 (category) |
| `group4` | TEXT | GROUP4 (sub-category) |
| `is_chronic_marker` | INTEGER | 1 for E11*, I10-I15*, N18*, E78*, E66*, I50*, I25*, I63* (used by Member 360 "conditions") |

### `import_log` · 2 rows

| column | type | note |
|---|---|---|
| `import_id` 🔑 | INTEGER |  |
| `source_file` | TEXT |  |
| `sheet` | TEXT |  |
| `rows_read` | INTEGER |  |
| `rows_loaded` | INTEGER |  |
| `started_at` | TEXT |  |
| `finished_at` | TEXT |  |

### `lab_observation` · 29,976 rows
sheet "Lab Results", linked to claims through ACTIVITY_ID

| column | type | note |
|---|---|---|
| `observation_sk` 🔑 | TEXT | OBSERVATION_SK |
| `activity_sk` | TEXT | ACTIVITY_SK |
| `activity_id` | TEXT | ACTIVITY_ID → claim_activity.activity_id |
| `observation_type_sk` | TEXT | OBSERVATIONTYPE_SK |
| `observation_id` | TEXT | OBSERVATION_ID |
| `code` | TEXT | CODE (LOINC, or UND) |
| `description` | TEXT | Description |
| `value_type` | TEXT | VALUETYPE |
| `requested_value` | TEXT | REQUESTEDVALUE (raw "5.6/%") |
| `approved_value` | TEXT | APPROVEDVALUE |
| `observation_type_id` | TEXT | OBSERVATIONTYPE_ID (LON) |
| `object_type` | TEXT | OBJECTTYPE |
| `src_sys_id` | TEXT | SRC_SYS_ID |
| `units` | TEXT | Units |
| `value_num` | REAL |  |
| `value_unit` | TEXT |  |
| `mask_id` | TEXT |  |
| `result_date` | TEXT |  |
| `claim_id` | TEXT |  |

### `member` · 250 rows
one row per masked member (mask_id is the shared key with member_longitudinal)

| column | type | note |
|---|---|---|
| `mask_id` 🔑 | TEXT | mask_id (masked member identifier shared with the longitudinal file) |
| `gender` | TEXT | GENDER |
| `age_category` | TEXT | AGECATEGORY (latest seen) |
| `member_relation` | TEXT | MEMBERRELATION (latest seen) |
| `principal_id` | TEXT | E_PRINCIPAL_ID |
| `first_service_date` | TEXT | MIN(DATEOFSERVICE) |
| `last_service_date` | TEXT | MAX(DATEOFSERVICE) |
| `claim_count` | INTEGER |  |
| `activity_count` | INTEGER |  |
| `payable_total` | REAL |  |

### `member_policy` · 823 rows
policy/enrolment rows seen on the member's claims

| column | type | note |
|---|---|---|
| `mask_id` 🔑 | TEXT |  |
| `policy_id` 🔑 | TEXT | POLICY_ID |
| `e_policy_id` | TEXT | E_POLICY_ID |
| `main_policy_group_id` | TEXT | MAINPOLICYGROUP_ID |
| `e_mpg_id` | TEXT | E_MPG_ID |
| `policy_group_id` | TEXT | POLICYGROUP_ID |
| `e_pg_id` | TEXT | E_PG_ID |
| `effective_date` | TEXT | EFFECTIVEDATE |
| `expiry_date` | TEXT | EXPIRYDATE |
| `cancellation_date` | TEXT | CANCELLATIONDATE |
| `member_effective_date` | TEXT | MEM_EFF_DATE |
| `enrollment_date` | TEXT | ENROLLMENTDATE |
| `deletion_date` | TEXT | DELETIONDATE |
| `product` | TEXT | PRODUCT |
| `plan` | TEXT | PLAN |
| `package_id` | TEXT | PACKAGE_ID |
| `package_type` | TEXT | PACKAGETYPE |
| `network_id` | TEXT | NETWORK_ID |
| `network_desc` | TEXT | NETOWRK_DESC (sic, source spelling) |
| `network_group_auh` | TEXT | NETWORKGROUPAUH |
| `network_group_dxb` | TEXT | NETWORKGROUPDXB |
| `network_group` | TEXT | NETWORKGROUP |
| `business_uy` | TEXT | BUSINESS_UY |
| `claim_count` | INTEGER |  |

### `observation_dictionary` · 259 rows
sheet "Sheet2"

| column | type | note |
|---|---|---|
| `type` | TEXT |  |
| `code` | TEXT |  |
| `description` | TEXT |  |
| `value` | TEXT |  |
| `value_type` | TEXT |  |

### `provider` · 889 rows
facilities

| column | type | note |
|---|---|---|
| `provider_id` 🔑 | TEXT | PROVIDER_ID |
| `facility_name` | TEXT | FACILITY_NAME |
| `facility_type` | TEXT | FACILITY_TYPE |
| `group_level` | TEXT | GROUPLEVEL |
| `group_owner_level` | TEXT | GROUPOWNERLEVEL |
| `super_group_level` | TEXT | SUPERGROUPLEVEL |
| `region` | TEXT | REGION |
| `territory` | TEXT | TERRITORY |

### `diagnosis` (view)

| column | type | note |
|---|---|---|
| `mask_id` | TEXT |  |
| `diagnosis_id` | TEXT |  |
| `first_date` |  |  |
| `last_date` |  |  |
| `claim_count` |  |  |

### `encounter` (view)

| column | type | note |
|---|---|---|
| `claim_id` | TEXT |  |
| `mask_id` | TEXT |  |
| `provider_id` | TEXT |  |
| `clinician_id` | TEXT |  |
| `service_date` | TEXT |  |
| `admit_date` | TEXT |  |
| `discharge_date` | TEXT |  |
| `los_days` | REAL |  |
| `encounter_type` |  |  |
| `admit_desc` | TEXT |  |
| `discharge_desc` | TEXT |  |
| `primary_diagnosis_id` | TEXT |  |
| `category` | TEXT |  |
| `payable` | REAL |  |

### `pharmacy_claim` (view)

| column | type | note |
|---|---|---|
| `activity_row_id` | INTEGER |  |
| `claim_id` | TEXT |  |
| `mask_id` | TEXT |  |
| `service_date` | TEXT |  |
| `generic_name` | TEXT |  |
| `dosage_form` | TEXT |  |
| `package_size` | TEXT |  |
| `package_unit` | TEXT |  |
| `drug_quantity` | REAL |  |
| `drug_tier` | TEXT |  |
| `drug_category` | TEXT |  |
| `payable` | REAL |  |
| `claimed` | REAL |  |
| `denial` | REAL |  |
| `activity_desc` | TEXT |  |
| `clinician_id` | TEXT |  |

### `procedure_activity` (view)

| column | type | note |
|---|---|---|
| `activity_row_id` | INTEGER |  |
| `claim_id` | TEXT |  |
| `mask_id` | TEXT |  |
| `service_date` | TEXT |  |
| `activity_detail_type` | TEXT |  |
| `activity_detail_id` | TEXT |  |
| `activity_desc` | TEXT |  |
| `service_group` | TEXT |  |
| `cpt_category` | TEXT |  |
| `cost_block` | TEXT |  |
| `payable` | REAL |  |
| `clinician_id` | TEXT |  |

## Layer B · Longitudinal features

### `longitudinal_field` · 377 rows
the 377-column catalogue (from the glossary and rule_field.csv)

| column | type | note |
|---|---|---|
| `field` 🔑 | TEXT | source column name, exactly as in the Excel header |
| `sql_name` | TEXT |  |
| `type` | TEXT | num / text / date / flag |
| `field_group` | TEXT |  |
| `read_by_rules` | TEXT |  |
| `description` | TEXT |  |

### `member_identifier_crosswalk` · 250 rows

| column | type | note |
|---|---|---|
| `member_id` 🔑 | TEXT | canonical id used by both applications (= mask_id) |
| `longitudinal_mask_id` | TEXT | mask_id in 250_members_longitudinal_data.xlsx |
| `claims_mask_id` | TEXT | mask_id in Raw_Claims_250_Members_*.xlsx |
| `display_name` | TEXT | pseudonym for the demo screens (no real names exist in either source) |
| `initials` | TEXT |  |
| `in_longitudinal` | INTEGER |  |
| `in_claims` | INTEGER |  |

### `member_longitudinal` · 250 rows

377 columns: every header of `250_members_longitudinal_data.xlsx`, see [../mappings/longitudinal-catalogue.md](../mappings/longitudinal-catalogue.md). Primary key `mask_id`.

## Layer C · Rule configuration

### `clinical_pathway` · 3 rows

Loaded 1:1 from `data/seed/rules/clinical_pathway.csv` (columns: `pathway_code`, `name`, `cohort_feature`, `description`).

### `risk_score_band` · 38 rows

Loaded 1:1 from `data/seed/rules/risk_score_band.csv` (columns: `rule_id`, `component`, `label`, `feature`, `applies_feature`, `applies_value`, `op`, `min`, `max`, `points`, `cap`, `note`).

### `rule_action` · 14 rows

Loaded 1:1 from `data/seed/rules/rule_action.csv` (columns: `action_code`, `trigger_code`, `title`, `owner_role`, `channel`, `done_when`, `evidence`, `prerequisite`, `escalate_to`).

### `rule_alert` · 4 rows

Loaded 1:1 from `data/seed/rules/rule_alert.csv` (columns: `colour`, `sort_order`, `criteria`, `response`).

### `rule_builder_field_group` · 6 rows

Loaded 1:1 from `data/seed/rules/rule_builder_field_group.csv` (columns: `group_no`, `field_group`, `examples`, `extract_columns_today`).

### `rule_cadence` · 29 rows

Loaded 1:1 from `data/seed/rules/rule_cadence.csv` (columns: `tier`, `step`, `label`, `day_offset`, `note`).

### `rule_call_stage` · 10 rows

Loaded 1:1 from `data/seed/rules/rule_call_stage.csv` (columns: `stage_no`, `stage`, `what_the_nurse_does`, `portal_step`).

### `rule_campaign_mode` · 2 rows

Loaded 1:1 from `data/seed/rules/rule_campaign_mode.csv` (columns: `mode`, `trigger_mode_in_kit`, `meaning`).

### `rule_condition` · 100 rows

Loaded 1:1 from `data/seed/rules/rule_condition.csv` (columns: `rule_id`, `rule_type`, `target`, `variant`, `group_no`, `column_name`, `op`, `value`, `note`).

### `rule_consent_gate` · 10 rows

Loaded 1:1 from `data/seed/rules/rule_consent_gate.csv` (columns: `item`, `before_consent`, `note`).

### `rule_contact_priority` · 5 rows

Loaded 1:1 from `data/seed/rules/rule_contact_priority.csv` (columns: `priority`, `alert`, `also_requires_trigger`, `sla_days`, `channel`, `meaning`).

### `rule_decision_step` · 10 rows

Loaded 1:1 from `data/seed/rules/rule_decision_step.csv` (columns: `step`, `name`, `what_happens`).

### `rule_definition` · 74 rows
one row per stable rule id, across every rule family

Loaded 1:1 from `data/seed/rules/rule_definition.csv` (columns: `rule_id`, `rule_version`, `rule_type`, `pathway`, `name`, `expression_text`, `output_type`, `priority_order`, `source_section`).

### `rule_documentation` · 6 rows

Loaded 1:1 from `data/seed/rules/rule_documentation.csv` (columns: `item_no`, `item`, `kit_column`).

### `rule_event_type` · 12 rows

Loaded 1:1 from `data/seed/rules/rule_event_type.csv` (columns: `event_type`, `written_by`, `when`, `kit_table`).

### `rule_field` · 381 rows

Loaded 1:1 from `data/seed/rules/rule_field.csv` (columns: `field`, `sql_name`, `type`, `group`, `load`, `in_341`, `in_377`, `plausible_min`, `plausible_max`, `read_by_rules`, `description`).

### `rule_gap_state` · 5 rows

Loaded 1:1 from `data/seed/rules/rule_gap_state.csv` (columns: `state`, `sort_order`, `moved_by`, `evidence`).

### `rule_guardrail` · 12 rows

Loaded 1:1 from `data/seed/rules/rule_guardrail.csv` (columns: `code`, `name`, `rule`, `enforced_in`).

### `rule_input` · 294 rows

Loaded 1:1 from `data/seed/rules/rule_input.csv` (columns: `rule_table`, `rule_key`, `input`, `field`, `role`, `note`).

### `rule_loop_step` · 5 rows

Loaded 1:1 from `data/seed/rules/rule_loop_step.csv` (columns: `step_no`, `step`, `owner_component`, `what_happens`, `data_written`).

### `rule_need_class` · 6 rows

Loaded 1:1 from `data/seed/rules/rule_need_class.csv` (columns: `class`, `sort_order`, `label`, `due_days`, `meaning`).

### `rule_open_decision` · 5 rows

Loaded 1:1 from `data/seed/rules/rule_open_decision.csv` (columns: `item_no`, `decision`, `status`, `who_decides`).

### `rule_queue_order` · 4 rows

Loaded 1:1 from `data/seed/rules/rule_queue_order.csv` (columns: `rank`, `sort_key`, `direction`, `meaning`).

### `rule_risk_band` · 32 rows

Loaded 1:1 from `data/seed/rules/rule_risk_band.csv` (columns: `component`, `input`, `band`, `points`, `cap`, `extract_column`).

### `rule_risk_component` · 5 rows

Loaded 1:1 from `data/seed/rules/rule_risk_component.csv` (columns: `component`, `name`, `inputs`, `formula`, `cap`, `extract_column`).

### `rule_safety_flag` · 1 rows

Loaded 1:1 from `data/seed/rules/rule_safety_flag.csv` (columns: `flag`, `raised_by`, `extract_columns`, `effect`, `event_pathway`, `note`).

### `rule_slot` · 4 rows

Loaded 1:1 from `data/seed/rules/rule_slot.csv` (columns: `slot`, `from_rank`, `to_rank`, `meaning`).

### `rule_tier` · 4 rows

Loaded 1:1 from `data/seed/rules/rule_tier.csv` (columns: `tier`, `label`, `r_min`, `r_max`, `campaign_does`, `cadence`, `cadence_days`).

### `rule_trigger` · 14 rows

Loaded 1:1 from `data/seed/rules/rule_trigger.csv` (columns: `trigger_code`, `name`, `pathway`, `class`, `sort_order`, `raw_data_rulebook`, `fires_when_rulebook`, `extract_flag`, `use_variant`, `status`).

### `rule_trigger_state` · 3 rows

Loaded 1:1 from `data/seed/rules/rule_trigger_state.csv` (columns: `state`, `meaning`, `what_happens`, `guardrail`).

### `rule_version` · 1 rows

Loaded 1:1 from `data/seed/rules/rule_version.csv` (columns: `rule_version`, `source_document`, `effective_from`, `notes`).

### `rule_writeback` · 9 rows

Loaded 1:1 from `data/seed/rules/rule_writeback.csv` (columns: `outcome`, `need_status`, `need_slot`, `action_status`, `gap_state`, `hold_days`, `max_attempts`, `retry_after_days`, `promote_next`, `new_calendar_item`, `guardrail`).

### `alert_rule` (view)

| column | type | note |
|---|---|---|
| `alert_id` | TEXT |  |
| `severity_order` | INT |  |
| `condition_text` | TEXT |  |
| `response` | TEXT |  |

### `clinical_trigger` (view)

| column | type | note |
|---|---|---|
| `trigger_id` | TEXT |  |
| `name` | TEXT |  |
| `pathway` | TEXT |  |
| `need_class` | TEXT |  |
| `class_order` | TEXT |  |
| `trigger_order` | TEXT |  |
| `raw_input` | TEXT |  |
| `fires_when` | TEXT |  |
| `source_flag` | TEXT |  |
| `use_variant` | TEXT |  |
| `approval_status` | TEXT |  |
| `due_days` | TEXT |  |

### `contact_cadence` (view)

| column | type | note |
|---|---|---|
| `tier_id` | INT |  |
| `step` | INT |  |
| `label` | TEXT |  |
| `day_offset` | INT |  |
| `note` | TEXT |  |

### `next_best_action` (view)

| column | type | note |
|---|---|---|
| `nba_id` | TEXT |  |
| `trigger_id` | TEXT |  |
| `action_text` | TEXT |  |
| `owner_role` | TEXT |  |
| `channel` | TEXT |  |
| `done_when` | TEXT |  |
| `evidence` | TEXT |  |
| `prerequisite` | TEXT |  |
| `escalate_to` | TEXT |  |

### `priority_rule` (view)

| column | type | note |
|---|---|---|
| `priority` | TEXT |  |
| `alert_colour` | TEXT |  |
| `also_requires_trigger` | TEXT |  |
| `sla_days` | INT |  |
| `channel` | TEXT |  |
| `meaning` | TEXT |  |

### `risk_component` (view)

| column | type | note |
|---|---|---|
| `component_id` | TEXT |  |
| `name` | TEXT |  |
| `inputs` | TEXT |  |
| `formula` | TEXT |  |
| `component_cap` | INT |  |
| `reference_column` | TEXT |  |

### `risk_tier` (view)

| column | type | note |
|---|---|---|
| `tier_id` | INT |  |
| `label` | TEXT |  |
| `min_score` | INT |  |
| `max_score` | INT |  |
| `programme_response` | TEXT |  |
| `cadence` | TEXT |  |
| `cadence_days` | TEXT |  |

### `rule_input_binding` (view)

| column | type | note |
|---|---|---|
| `binding_id` |  |  |
| `rule_table` | TEXT |  |
| `rule_id` | TEXT |  |
| `input` | TEXT |  |
| `role` | TEXT |  |
| `source_column` | TEXT |  |
| `note` | TEXT |  |

### `trigger_condition` (view)

| column | type | note |
|---|---|---|
| `rule_id` | TEXT |  |
| `rule_type` | TEXT |  |
| `trigger_id` | TEXT |  |
| `variant` | TEXT |  |
| `group_no` | INT |  |
| `input_feature` | TEXT |  |
| `operator` | TEXT |  |
| `threshold` | TEXT |  |
| `note` | TEXT |  |

## Layer D · Care intelligence outputs

### `action` · 771 rows
every unit of work: care-plan action, outreach call, nudge, follow-up, retry, escalation

| column | type | note |
|---|---|---|
| `action_id` 🔑 | INTEGER |  |
| `member_id` | TEXT |  |
| `need_id` | TEXT |  |
| `kind` | TEXT | care_plan / call / nudge / follow_up / retry / escalation |
| `title` | TEXT |  |
| `channel` | TEXT |  |
| `owner_role` | TEXT |  |
| `assignee` | TEXT | nurse_user.user_id |
| `due_date` | TEXT |  |
| `status` | TEXT | open / done / declined / cancelled |
| `agreed` | INTEGER |  |
| `attempt` | INTEGER |  |
| `parent_action_id` | INTEGER |  |
| `source` | TEXT | engine / followup / portal / studio |
| `run_id` | INTEGER |  |
| `created_at` | TEXT |  |
| `closed_at` | TEXT |  |

### `care_need` · 748 rows
a care gap / need: one per member × trigger (the care plan items)

| column | type | note |
|---|---|---|
| `need_id` 🔑 | TEXT | N-<member_id>-<trigger_code> |
| `care_plan_id` | TEXT |  |
| `member_id` | TEXT |  |
| `trigger_code` | TEXT |  |
| `need_class` | TEXT | safety / acute / unctl / barrier / gap / goal |
| `class_order` | INTEGER |  |
| `trigger_order` | INTEGER |  |
| `rank` | INTEGER | 1..n inside the member's open needs |
| `slot` | TEXT | CURRENT / NEXT / FUTURE / CLOSED |
| `status` | TEXT | open / done / declined |
| `gap_state` | TEXT | Potential / Verified / Scheduled / Reported / Closed |
| `due_date` | TEXT |  |
| `hold_until` | TEXT |  |
| `evidence` | TEXT |  |
| `next_best_action` | TEXT |  |
| `action_owner` | TEXT |  |
| `done_when` | TEXT |  |
| `action_code` | TEXT |  |
| `opened_run_id` | INTEGER |  |
| `opened_at` | TEXT |  |
| `closed_at` | TEXT |  |
| `last_evaluation_id` | INTEGER |  |

### `care_plan` · 232 rows
one living plan per member (status carried across runs)

| column | type | note |
|---|---|---|
| `care_plan_id` 🔑 | TEXT | CP-<member_id> |
| `member_id` | TEXT |  |
| `pathway` | TEXT |  |
| `tier` | INTEGER |  |
| `cadence` | TEXT |  |
| `status` | TEXT |  |
| `created_run_id` | INTEGER |  |
| `updated_run_id` | INTEGER |  |
| `created_at` | TEXT |  |
| `updated_at` | TEXT |  |

### `intelligence_run` · 1 rows

| column | type | note |
|---|---|---|
| `run_id` 🔑 | INTEGER |  |
| `rule_version` | TEXT |  |
| `trigger_variant` | TEXT | rulebook / extract |
| `run_date` | TEXT | the demo "today" |
| `as_of_date` | TEXT | extract as-of date |
| `started_at` | TEXT |  |
| `finished_at` | TEXT |  |
| `members_evaluated` | INTEGER |  |
| `triggered_by` | TEXT | setup / studio / api / portal |
| `stats_json` | TEXT |  |

### `member_alert` · 250 rows

| column | type | note |
|---|---|---|
| `run_id` 🔑 | INTEGER |  |
| `member_id` 🔑 | TEXT |  |
| `alert_colour` | TEXT |  |
| `alert_rule_id` | TEXT |  |
| `contact_priority` | TEXT | P1..P4 |
| `sla_days` | INTEGER |  |
| `reasons` | TEXT |  |

### `member_risk_result` · 250 rows

| column | type | note |
|---|---|---|
| `run_id` 🔑 | INTEGER |  |
| `member_id` 🔑 | TEXT |  |
| `rule_version` | TEXT |  |
| `clinical_score` | INTEGER |  |
| `comorbidity_score` | INTEGER |  |
| `kidney_score` | INTEGER |  |
| `utilisation_score` | INTEGER |  |
| `age_sex_score` | INTEGER |  |
| `total_risk_score` | INTEGER |  |
| `tier` | INTEGER |  |
| `tier_label` | TEXT |  |
| `kidney_provisional` | INTEGER | K came from the documented CKD stage (no eGFR / UACR) |
| `safety_flag` | INTEGER | Priority clinical review (DKA / hypoglycaemia / extract flag) |
| `pathway` | TEXT | T2D / HTN / T2D·HTN |
| `extract_clinical_score` | INTEGER |  |
| `extract_comorbidity_score` | INTEGER |  |
| `extract_kidney_score` | INTEGER |  |
| `extract_utilisation_score` | INTEGER |  |
| `extract_age_sex_score` | INTEGER |  |
| `extract_total_risk_score` | INTEGER | reference: the longitudinal file's own Total_risk_Score |
| `extract_risk_tier` | TEXT | reference: the file's Risk_tier label (reverse-numbered in the source) |
| `matches_extract` | INTEGER | 1 when the engine total equals the extract total |
| `evaluated_at` | TEXT |  |

### `member_rule_evaluation` · 5,117 rows
one row per member × rule × run (risk points, triggers, alerts)

| column | type | note |
|---|---|---|
| `evaluation_id` 🔑 | INTEGER |  |
| `run_id` | INTEGER |  |
| `member_id` | TEXT |  |
| `rule_id` | TEXT |  |
| `rule_type` | TEXT | risk_points / trigger / alert |
| `rule_version` | TEXT |  |
| `input_features` | TEXT | longitudinal columns read (comma separated) |
| `input_values_json` | TEXT | {"Last_HbA1c_Value": 9.4, ...} |
| `evaluation_logic` | TEXT | the condition tested, in words |
| `evaluation_result` | TEXT | fired / cannot_tell / not_fired / scored |
| `points_awarded` | INTEGER |  |
| `clinical_evidence` | TEXT |  |
| `priority` | TEXT | P1..P4 (triggers: the member's contact priority at this run) |
| `alert_colour` | TEXT | RED / AMBER / YELLOW / GREEN |
| `next_best_action` | TEXT |  |
| `action_owner` | TEXT |  |
| `done_when` | TEXT |  |
| `evaluated_at` | TEXT |  |

### `worklist` · 214 rows
today's queue, rebuilt every run; one row per member with an open outreach

| column | type | note |
|---|---|---|
| `run_id` 🔑 | INTEGER |  |
| `member_id` 🔑 | TEXT |  |
| `nurse_id` | TEXT |  |
| `rank_no` | INTEGER | programme-wide rank (rule_queue_order) |
| `nurse_rank` | INTEGER |  |
| `list_status` | TEXT | today / queued / nudge |
| `contact_priority` | TEXT |  |
| `alert_colour` | TEXT |  |
| `tier` | INTEGER |  |
| `safety_flag` | INTEGER |  |
| `campaign_id` | TEXT |  |
| `action_id` | INTEGER |  |
| `due_by` | TEXT |  |
| `current_needs` | TEXT |  |

## Layer E · Operational and write-back

### `app_setting` · 3 rows

| column | type | note |
|---|---|---|
| `key` 🔑 | TEXT |  |
| `value` | TEXT |  |

### `appointment` · 0 rows

| column | type | note |
|---|---|---|
| `appointment_id` 🔑 | INTEGER |  |
| `member_id` | TEXT |  |
| `need_id` | TEXT |  |
| `action_id` | INTEGER |  |
| `appointment_type` | TEXT | GP / lab / specialist / eye / foot / dietitian |
| `provider_name` | TEXT |  |
| `scheduled_date` | TEXT |  |
| `scheduled_time` | TEXT |  |
| `status` | TEXT | booked / attended / missed / cancelled |
| `booked_by` | TEXT |  |
| `booked_at` | TEXT |  |

### `audit_event` · 1 rows

| column | type | note |
|---|---|---|
| `audit_id` 🔑 | INTEGER |  |
| `at` | TEXT |  |
| `actor` | TEXT |  |
| `operation` | TEXT | READ / WRITE |
| `entity` | TEXT |  |
| `detail` | TEXT |  |
| `endpoint` | TEXT |  |

### `call_interaction` · 0 rows
the structured call workflow (one per reached call)

| column | type | note |
|---|---|---|
| `call_id` 🔑 | INTEGER |  |
| `attempt_id` | INTEGER |  |
| `member_id` | TEXT |  |
| `nurse_id` | TEXT |  |
| `stage` | TEXT | consent / review / actions / outcome / closed |
| `red_flag` | INTEGER |  |
| `response` | TEXT | member response summary |
| `notes` | TEXT |  |
| `started_at` | TEXT |  |
| `ended_at` | TEXT |  |

### `campaign` · 4 rows

| column | type | note |
|---|---|---|
| `campaign_id` 🔑 | TEXT |  |
| `name` | TEXT |  |
| `goal` | TEXT |  |
| `mode` | TEXT | automated / business |
| `triggers_json` | TEXT | business mode: the trigger codes kept |
| `channels` | TEXT |  |
| `nurses` | INTEGER |  |
| `calls_per_day` | INTEGER |  |
| `holdout_pct` | INTEGER |  |
| `start_date` | TEXT |  |
| `weeks` | INTEGER |  |
| `priority` | INTEGER |  |
| `status` | TEXT | Draft / Scheduled / Live / Paused / Closed |
| `created_by` | TEXT |  |
| `created_at` | TEXT |  |
| `updated_at` | TEXT |  |

### `campaign_cohort` · 6 rows

| column | type | note |
|---|---|---|
| `campaign_id` 🔑 | TEXT |  |
| `cohort_id` 🔑 | TEXT |  |
| `role` 🔑 | TEXT | include / exclude |

### `campaign_member` · 232 rows
who each run put in which campaign (highest-priority live campaign wins)

| column | type | note |
|---|---|---|
| `run_id` 🔑 | INTEGER |  |
| `campaign_id` | TEXT |  |
| `member_id` 🔑 | TEXT |  |
| `holdout` | INTEGER |  |

### `care_gap_event` · 748 rows
state transitions of a need's gap_state (audit of Potential → … → Closed)

| column | type | note |
|---|---|---|
| `gap_event_id` 🔑 | INTEGER |  |
| `need_id` | TEXT |  |
| `member_id` | TEXT |  |
| `from_state` | TEXT |  |
| `to_state` | TEXT |  |
| `moved_by` | TEXT | engine / nurse:<id> / claims |
| `evidence` | TEXT |  |
| `run_id` | INTEGER |  |
| `recorded_at` | TEXT |  |

### `cohort` · 5 rows

| column | type | note |
|---|---|---|
| `cohort_id` 🔑 | TEXT |  |
| `version` | INTEGER |  |
| `name` | TEXT |  |
| `base` | TEXT | daman / seha / pura |
| `logic` | TEXT | all / any |
| `refresh` | TEXT |  |
| `definition_json` | TEXT | the builder's rules as saved |
| `compiled_sql` | TEXT |  |
| `row_count` | INTEGER |  |
| `owner` | TEXT |  |
| `created_at` | TEXT |  |
| `updated_at` | TEXT |  |

### `cohort_member` · 464 rows

| column | type | note |
|---|---|---|
| `cohort_id` 🔑 | TEXT |  |
| `member_id` 🔑 | TEXT |  |
| `version` | INTEGER |  |
| `holdout` | INTEGER |  |
| `added_at` | TEXT |  |

### `cohort_rule` · 15 rows

| column | type | note |
|---|---|---|
| `rule_id` 🔑 | TEXT |  |
| `cohort_id` | TEXT |  |
| `version` | INTEGER |  |
| `field` | TEXT |  |
| `operator` | TEXT |  |
| `value` | TEXT |  |
| `value2` | TEXT |  |
| `codes_json` | TEXT |  |
| `lab` | TEXT |  |
| `is_exclusion` | INTEGER |  |

### `consent_event` · 0 rows

| column | type | note |
|---|---|---|
| `consent_event_id` 🔑 | INTEGER |  |
| `member_id` | TEXT |  |
| `call_id` | INTEGER |  |
| `nurse_id` | TEXT |  |
| `consent_status` | TEXT | granted / declined / withdrawn / pending |
| `scope` | TEXT | outreach / care_plan / data_sharing |
| `recorded_at` | TEXT |  |
| `duration_seconds` | INTEGER |  |
| `note` | TEXT |  |

### `contact_attempt` · 0 rows
every call attempt (reached or not)

| column | type | note |
|---|---|---|
| `attempt_id` 🔑 | INTEGER |  |
| `member_id` | TEXT |  |
| `nurse_id` | TEXT |  |
| `action_id` | INTEGER |  |
| `campaign_id` | TEXT |  |
| `channel` | TEXT |  |
| `started_at` | TEXT |  |
| `ended_at` | TEXT |  |
| `reached` | INTEGER |  |
| `result` | TEXT | reached / no_answer / busy / voicemail / wrong_number |

### `disposition_event` · 0 rows
nurse decision on a need / action: done, declined, agreed, carried, not_reached

| column | type | note |
|---|---|---|
| `disposition_id` 🔑 | INTEGER |  |
| `member_id` | TEXT |  |
| `need_id` | TEXT |  |
| `action_id` | INTEGER |  |
| `call_id` | INTEGER |  |
| `outcome` | TEXT |  |
| `note` | TEXT |  |
| `recorded_by` | TEXT |  |
| `recorded_at` | TEXT |  |
| `processed_at` | TEXT | when the write-back rule was applied |

### `member_assertion` · 0 rows
what the member told the nurse (never closes a gap by itself)

| column | type | note |
|---|---|---|
| `assertion_id` 🔑 | INTEGER |  |
| `member_id` | TEXT |  |
| `call_id` | INTEGER |  |
| `need_id` | TEXT |  |
| `assertion_text` | TEXT |  |
| `recorded_by` | TEXT |  |
| `recorded_at` | TEXT |  |

### `member_assignment` · 232 rows

| column | type | note |
|---|---|---|
| `member_id` 🔑 | TEXT |  |
| `nurse_id` | TEXT |  |
| `assigned_at` | TEXT |  |
| `assigned_by` | TEXT |  |

### `nurse_note` · 0 rows

| column | type | note |
|---|---|---|
| `note_id` 🔑 | INTEGER |  |
| `member_id` | TEXT |  |
| `nurse_id` | TEXT |  |
| `call_id` | INTEGER |  |
| `text` | TEXT |  |
| `created_at` | TEXT |  |

### `nurse_user` · 5 rows

| column | type | note |
|---|---|---|
| `user_id` 🔑 | TEXT | U-0142 … |
| `username` | TEXT |  |
| `pin` | TEXT | demo login (4 digits). No real authentication service. |
| `name` | TEXT |  |
| `role` | TEXT | Registered nurse / Care coordinator / Clinical lead / Population health |
| `languages` | TEXT | comma separated |
| `daily_capacity` | INTEGER |  |
| `active` | INTEGER |  |

### `task` · 771 rows
the portal's task list (follow-ups, bookings, checks) — a projection of action

| column | type | note |
|---|---|---|
| `task_id` 🔑 | INTEGER |  |
| `action_id` | INTEGER |  |
| `member_id` | TEXT |  |
| `title` | TEXT |  |
| `task_kind` | TEXT | call / follow_up / booking / verify / escalation / nudge |
| `assignee` | TEXT |  |
| `due_date` | TEXT |  |
| `due_time` | TEXT |  |
| `status` | TEXT |  |
| `completed_at` | TEXT |  |
| `booking_date` | TEXT |  |
| `created_at` | TEXT |  |
