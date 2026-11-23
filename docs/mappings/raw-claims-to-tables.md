# Raw claims → tables

Sheet **in** (81 columns, 144,292 rows across the three workbook parts) and sheet **Lab Results** (14 columns, 29,976 rows, identical in each part and de-duplicated on OBSERVATION_SK). Every source column lands in at least one table of `claims.sqlite`; dimension columns are de-duplicated (one row per provider, clinician, diagnosis code, policy), claim-level columns are kept once per CLAIM_ID with sums, line-level columns stay on `claim_activity`.

## Sheet "in"

| source column | destination table.column |
|---|---|
| `MAINPOLICYGROUP_ID` | `member_policy.main_policy_group_id` |
| `E_MPG_ID` | `member_policy.e_mpg_id` |
| `POLICYGROUP_ID` | `member_policy.policy_group_id` |
| `E_PG_ID` | `member_policy.e_pg_id` |
| `POLICY_ID` | `member_policy.policy_id`, `claim.policy_id` |
| `E_POLICY_ID` | `member_policy.e_policy_id` |
| `EFFECTIVEDATE` | `member_policy.effective_date` |
| `EXPIRYDATE` | `member_policy.expiry_date` |
| `CANCELLATIONDATE` | `member_policy.cancellation_date` |
| `MEM_EFF_DATE` | `member_policy.member_effective_date` |
| `ENROLLMENTDATE` | `member_policy.enrollment_date` |
| `DELETIONDATE` | `member_policy.deletion_date` |
| `PRODUCT` | `member_policy.product` |
| `PLAN` | `member_policy.plan` |
| `PACKAGE_ID` | `member_policy.package_id` |
| `PACKAGETYPE` | `member_policy.package_type` |
| `NETWORK_ID` | `member_policy.network_id` |
| `NETOWRK_DESC` | `member_policy.network_desc` |
| `NETWORKGROUPAUH` | `member_policy.network_group_auh` |
| `NETWORKGROUPDXB` | `member_policy.network_group_dxb` |
| `NETWORKGROUP` | `member_policy.network_group` |
| `PROVIDER_ID` | `provider.provider_id` |
| `FACILITY_NAME` | `provider.facility_name` |
| `FACILITY_TYPE` | `provider.facility_type` |
| `GROUPLEVEL` | `provider.group_level` |
| `GROUPOWNERLEVEL` | `provider.group_owner_level` |
| `SUPERGROUPLEVEL` | `provider.super_group_level` |
| `REGION` | `provider.region` |
| `TERRITORY` | `provider.territory` |
| `CLINICIAN_ID` | `clinician.clinician_id`, `claim_activity.clinician_id` |
| `CLINICIAN_NAME` | `clinician.clinician_name` |
| `PROFESSION` | `clinician.profession` |
| `SPECIALTY` | `clinician.specialty` |
| `mask_id` | `member.mask_id` |
| `MEMBERRELATION` | `member.member_relation` |
| `GENDER` | `member.gender` |
| `AGECATEGORY` | `member.age_category` |
| `DIAGNOSIS_ID` | `diagnosis_code.diagnosis_id`, `claim.primary_diagnosis_id`, `claim_activity.diagnosis_id` |
| `GROUP2` | `diagnosis_code.group2` |
| `GROUP3` | `diagnosis_code.group3` |
| `GROUP4` | `diagnosis_code.group4` |
| `HEALTHCODE` | `claim_activity.health_code` |
| `INVOICESTATUS` | `claim.invoice_status` |
| `COSTBLOCK` | `claim_activity.cost_block` |
| `BENEFITGROUPTYPE2` | `claim_activity.benefit_group_type` |
| `BENEFIT_DESC` | `claim_activity.benefit_desc` |
| `SERVICEGROUP` | `claim_activity.service_group` |
| `SERVICE_ID` | `claim_activity.service_id` |
| `SER_DESC` | `claim_activity.service_desc` |
| `CPTCATEGORY3` | `claim_activity.cpt_category` |
| `ACTIVITYDETAIL_ID` | `claim_activity.activity_row_id`, `claim_activity.activity_detail_id` |
| `ACTIVITYDETAILTYPE_ID` | `claim_activity.activity_detail_type` |
| `ACTIVITY_ID` | `claim_activity.activity_id`, `claim_activity.activity_id`, `lab_observation.activity_id`, `lab_observation.activity_id` |
| `ACTIVITY_DESC` | `claim_activity.activity_desc` |
| `AUDIT_ID` | `claim.audit_id` |
| `CLAIM_ID` | `claim.claim_id` |
| `EPISODE_ID` | `claim.episode_id` |
| `BG_IPOP` | `claim.bg_ipop` |
| `DATEOFSERVICE` | `member.first_service_date`, `member.last_service_date`, `claim.service_date`, `claim.service_date_to`, `claim_activity.service_date` |
| `ADMIT_DATE` | `claim.admit_date` |
| `DISCHARGE_DATE` | `claim.discharge_date` |
| `LOS_DAYS` | `claim.los_days` |
| `CYYYYMM` | `claim.cyyyymm` |
| `CY` | `claim.cy` |
| `PAYABLE` | `claim.payable`, `claim_activity.payable` |
| `CLAIMED` | `claim.claimed`, `claim_activity.claimed` |
| `DENIAL` | `claim.denial`, `claim_activity.denial` |
| `DRUG_QUANTITY` | `claim_activity.drug_quantity` |
| `PACKAGESIZE` | `claim_activity.package_size` |
| `PACKAGEUNIT` | `claim_activity.package_unit` |
| `DOSAGEFORM` | `claim_activity.dosage_form` |
| `GENERICNAME` | `claim_activity.generic_name` |
| `DRUG_CATEGORY` | `claim_activity.drug_category` |
| `DRUG_TIERS` | `claim_activity.drug_tier` |
| `ADMIT_DESC` | `claim.admit_desc` |
| `CATEGORY` | `claim.category`, `claim_activity.category` |
| `Concatenated` | `claim_activity.concatenated` |
| `MAJOR` | `claim.major`, `claim_activity.major` |
| `E_PRINCIPAL_ID` | `member.principal_id` |
| `DISC_DESCRIPTION` | `claim.discharge_desc` |
| `BUSINESS_UY` | `member_policy.business_uy` |

## Sheet "Lab Results"

| source column | destination table.column |
|---|---|
| `OBSERVATION_SK` | `lab_observation.observation_sk` |
| `ACTIVITY_SK` | `lab_observation.activity_sk` |
| `ACTIVITY_ID` | `claim_activity.activity_id`, `claim_activity.activity_id`, `lab_observation.activity_id`, `lab_observation.activity_id` |
| `OBSERVATIONTYPE_SK` | `lab_observation.observation_type_sk` |
| `OBSERVATION_ID` | `lab_observation.observation_id` |
| `CODE` | `lab_observation.code` |
| `Description` | `lab_observation.description` |
| `VALUETYPE` | `lab_observation.value_type` |
| `REQUESTEDVALUE` | `lab_observation.requested_value` |
| `APPROVEDVALUE` | `lab_observation.approved_value` |
| `OBSERVATIONTYPE_ID` | `lab_observation.observation_type_id` |
| `OBJECTTYPE` | `lab_observation.object_type` |
| `SRC_SYS_ID` | `lab_observation.src_sys_id` |
| `Units` | `lab_observation.units` |

## Sheet "Sheet2"

`Type, Code, Description, Value, ValueType` → `observation_dictionary` (same names).

## Derived at import (traceable)

- `lab_observation.value_num`, `value_unit`: parsed from `REQUESTEDVALUE` (format `value/unit`, e.g. `5.6/%`); the raw string is kept.
- `lab_observation.mask_id`, `result_date`, `claim_id`: copied from the `claim_activity` row with the same `ACTIVITY_ID`.
- `claim.*` sums and min/max dates: aggregated over the claim's activity lines.
- Views `encounter`, `pharmacy_claim`, `procedure_activity`, `diagnosis`: SQL over the tables above, no copies.
