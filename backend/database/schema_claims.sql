-- ════════════════════════════════════════════════════════════════════════════
-- Layer A · Raw claims (Member 360 source). File: data/db/claims.sqlite
-- Source: Raw_Claims_250_Members_Part_1..3_of_3.xlsx, sheet "in" (81 columns, 144,292 activity rows),
--         sheet "Lab Results" (14 columns, 29,976 observations), sheet "Sheet2" (observation dictionary).
-- Every source column lands in exactly one table (docs/mappings/raw-claims-to-tables.md).
-- Written only by backend/importers/claims.js; the API reads it.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE member (                       -- one row per masked member (mask_id is the shared key with member_longitudinal)
  mask_id            TEXT PRIMARY KEY,      -- mask_id (masked member identifier shared with the longitudinal file)
  gender             TEXT,                  -- GENDER
  age_category       TEXT,                  -- AGECATEGORY (latest seen)
  member_relation    TEXT,                  -- MEMBERRELATION (latest seen)
  principal_id       TEXT,                  -- E_PRINCIPAL_ID
  first_service_date TEXT,                  -- MIN(DATEOFSERVICE)
  last_service_date  TEXT,                  -- MAX(DATEOFSERVICE)
  claim_count        INTEGER,
  activity_count     INTEGER,
  payable_total      REAL
);

CREATE TABLE member_policy (                -- policy/enrolment rows seen on the member's claims
  mask_id            TEXT NOT NULL REFERENCES member(mask_id),
  policy_id          TEXT NOT NULL,         -- POLICY_ID
  e_policy_id        TEXT,                  -- E_POLICY_ID
  main_policy_group_id TEXT,                -- MAINPOLICYGROUP_ID
  e_mpg_id           TEXT,                  -- E_MPG_ID
  policy_group_id    TEXT,                  -- POLICYGROUP_ID
  e_pg_id            TEXT,                  -- E_PG_ID
  effective_date     TEXT,                  -- EFFECTIVEDATE
  expiry_date        TEXT,                  -- EXPIRYDATE
  cancellation_date  TEXT,                  -- CANCELLATIONDATE
  member_effective_date TEXT,               -- MEM_EFF_DATE
  enrollment_date    TEXT,                  -- ENROLLMENTDATE
  deletion_date      TEXT,                  -- DELETIONDATE
  product            TEXT,                  -- PRODUCT
  plan               TEXT,                  -- PLAN
  package_id         TEXT,                  -- PACKAGE_ID
  package_type       TEXT,                  -- PACKAGETYPE
  network_id         TEXT,                  -- NETWORK_ID
  network_desc       TEXT,                  -- NETOWRK_DESC (sic, source spelling)
  network_group_auh  TEXT,                  -- NETWORKGROUPAUH
  network_group_dxb  TEXT,                  -- NETWORKGROUPDXB
  network_group      TEXT,                  -- NETWORKGROUP
  business_uy        TEXT,                  -- BUSINESS_UY
  claim_count        INTEGER,
  PRIMARY KEY (mask_id, policy_id)
);

CREATE TABLE provider (                     -- facilities
  provider_id        TEXT PRIMARY KEY,      -- PROVIDER_ID
  facility_name      TEXT,                  -- FACILITY_NAME
  facility_type      TEXT,                  -- FACILITY_TYPE
  group_level        TEXT,                  -- GROUPLEVEL
  group_owner_level  TEXT,                  -- GROUPOWNERLEVEL
  super_group_level  TEXT,                  -- SUPERGROUPLEVEL
  region             TEXT,                  -- REGION
  territory          TEXT                   -- TERRITORY
);

CREATE TABLE clinician (
  clinician_id       TEXT PRIMARY KEY,      -- CLINICIAN_ID
  clinician_name     TEXT,                  -- CLINICIAN_NAME
  profession         TEXT,                  -- PROFESSION
  specialty          TEXT                   -- SPECIALTY
);

CREATE TABLE diagnosis_code (               -- ICD-10 dimension
  diagnosis_id       TEXT PRIMARY KEY,      -- DIAGNOSIS_ID (ICD-10 code)
  group2             TEXT,                  -- GROUP2 (block)
  group3             TEXT,                  -- GROUP3 (category)
  group4             TEXT,                  -- GROUP4 (sub-category)
  is_chronic_marker  INTEGER DEFAULT 0      -- 1 for E11*, I10-I15*, N18*, E78*, E66*, I50*, I25*, I63* (used by Member 360 "conditions")
);

CREATE TABLE claim (                        -- one row per CLAIM_ID (34,407)
  claim_id           TEXT PRIMARY KEY,      -- CLAIM_ID
  mask_id            TEXT NOT NULL REFERENCES member(mask_id),
  episode_id         TEXT,                  -- EPISODE_ID
  audit_id           TEXT,                  -- AUDIT_ID
  policy_id          TEXT,                  -- POLICY_ID
  provider_id        TEXT REFERENCES provider(provider_id),
  clinician_id       TEXT REFERENCES clinician(clinician_id),   -- first clinician on the claim
  bg_ipop            TEXT,                  -- BG_IPOP (IP | OP)
  admit_desc         TEXT,                  -- ADMIT_DESC (Elective | Emergency | Transfer …)
  discharge_desc     TEXT,                  -- DISC_DESCRIPTION
  service_date       TEXT,                  -- MIN(DATEOFSERVICE)
  service_date_to    TEXT,                  -- MAX(DATEOFSERVICE)
  admit_date         TEXT,                  -- ADMIT_DATE
  discharge_date     TEXT,                  -- DISCHARGE_DATE
  los_days           REAL,                  -- LOS_DAYS
  cyyyymm            TEXT,                  -- CYYYYMM
  cy                 INTEGER,               -- CY
  invoice_status     TEXT,                  -- INVOICESTATUS
  primary_diagnosis_id TEXT REFERENCES diagnosis_code(diagnosis_id),  -- first DIAGNOSIS_ID on the claim
  category           TEXT,                  -- CATEGORY (specialty of the claim)
  major              TEXT,                  -- MAJOR (clinician grade)
  activity_count     INTEGER,
  payable            REAL,                  -- SUM(PAYABLE)
  claimed            REAL,                  -- SUM(CLAIMED)
  denial             REAL                   -- SUM(DENIAL)
);
CREATE INDEX ix_claim_member ON claim(mask_id, service_date);

CREATE TABLE claim_activity (               -- one row per source line (144,292)
  activity_row_id    INTEGER PRIMARY KEY,   -- surrogate (ACTIVITYDETAIL_ID is not unique in the source)
  claim_id           TEXT NOT NULL REFERENCES claim(claim_id),
  mask_id            TEXT NOT NULL REFERENCES member(mask_id),
  activity_id        TEXT,                  -- ACTIVITY_ID (join key for lab_observation)
  activity_detail_id TEXT,                  -- ACTIVITYDETAIL_ID
  activity_detail_type TEXT,                -- ACTIVITYDETAILTYPE_ID (CPT4 | MOHENH | HCPCS | …)
  activity_desc      TEXT,                  -- ACTIVITY_DESC
  service_id         TEXT,                  -- SERVICE_ID
  service_desc       TEXT,                  -- SER_DESC
  service_group      TEXT,                  -- SERVICEGROUP
  cpt_category       TEXT,                  -- CPTCATEGORY3
  cost_block         TEXT,                  -- COSTBLOCK (Drugs | Lab and Path | Consultation | Procedures …)
  benefit_group_type TEXT,                  -- BENEFITGROUPTYPE2
  benefit_desc       TEXT,                  -- BENEFIT_DESC
  health_code        TEXT,                  -- HEALTHCODE
  diagnosis_id       TEXT,                  -- DIAGNOSIS_ID
  clinician_id       TEXT,                  -- CLINICIAN_ID
  service_date       TEXT,                  -- DATEOFSERVICE
  payable            REAL,                  -- PAYABLE
  claimed            REAL,                  -- CLAIMED
  denial             REAL,                  -- DENIAL
  drug_quantity      REAL,                  -- DRUG_QUANTITY
  package_size       TEXT,                  -- PACKAGESIZE
  package_unit       TEXT,                  -- PACKAGEUNIT
  dosage_form        TEXT,                  -- DOSAGEFORM
  generic_name       TEXT,                  -- GENERICNAME
  drug_category      TEXT,                  -- DRUG_CATEGORY
  drug_tier          TEXT,                  -- DRUG_TIERS
  concatenated       TEXT,                  -- Concatenated (service+provider key)
  category           TEXT,                  -- CATEGORY
  major              TEXT                   -- MAJOR
);
CREATE INDEX ix_activity_member ON claim_activity(mask_id, service_date);
CREATE INDEX ix_activity_claim ON claim_activity(claim_id);
CREATE INDEX ix_activity_activity ON claim_activity(activity_id);

CREATE TABLE lab_observation (              -- sheet "Lab Results", linked to claims through ACTIVITY_ID
  observation_sk     TEXT PRIMARY KEY,      -- OBSERVATION_SK
  activity_sk        TEXT,                  -- ACTIVITY_SK
  activity_id        TEXT,                  -- ACTIVITY_ID → claim_activity.activity_id
  observation_type_sk TEXT,                 -- OBSERVATIONTYPE_SK
  observation_id     TEXT,                  -- OBSERVATION_ID
  code               TEXT,                  -- CODE (LOINC, or UND)
  description        TEXT,                  -- Description
  value_type         TEXT,                  -- VALUETYPE
  requested_value    TEXT,                  -- REQUESTEDVALUE (raw "5.6/%")
  approved_value     TEXT,                  -- APPROVEDVALUE
  observation_type_id TEXT,                 -- OBSERVATIONTYPE_ID (LON)
  object_type        TEXT,                  -- OBJECTTYPE
  src_sys_id         TEXT,                  -- SRC_SYS_ID
  units              TEXT,                  -- Units
  -- derived at import (traceable: parsed from requested_value; member and date copied from the matching claim_activity)
  value_num          REAL,
  value_unit         TEXT,
  mask_id            TEXT,
  result_date        TEXT,
  claim_id           TEXT
);
CREATE INDEX ix_lab_member ON lab_observation(mask_id, code, result_date);

CREATE TABLE observation_dictionary (       -- sheet "Sheet2"
  type               TEXT,
  code               TEXT,
  description        TEXT,
  value              TEXT,
  value_type         TEXT
);

CREATE TABLE import_log (
  import_id          INTEGER PRIMARY KEY,
  source_file        TEXT,
  sheet              TEXT,
  rows_read          INTEGER,
  rows_loaded        INTEGER,
  started_at         TEXT,
  finished_at        TEXT
);

-- Derived views (no copies of data: Member 360 reads these)
CREATE VIEW encounter AS                    -- one visit per claim; type from BG_IPOP and ADMIT_DESC
  SELECT claim_id, mask_id, provider_id, clinician_id, service_date, admit_date, discharge_date, los_days,
         CASE WHEN bg_ipop = 'IP' THEN 'IP' WHEN admit_desc = 'Emergency' THEN 'ED' ELSE 'OP' END AS encounter_type,
         admit_desc, discharge_desc, primary_diagnosis_id, category, payable
  FROM claim;
CREATE VIEW pharmacy_claim AS               -- activity lines that dispensed a medicine
  SELECT activity_row_id, claim_id, mask_id, service_date, generic_name, dosage_form, package_size, package_unit, drug_quantity,
         drug_tier, drug_category, payable, claimed, denial, activity_desc, clinician_id
  FROM claim_activity WHERE generic_name IS NOT NULL AND generic_name <> '';
CREATE VIEW procedure_activity AS           -- CPT/HCPCS procedures (everything that is not a drug, a lab, a consultation or a bed-day)
  SELECT activity_row_id, claim_id, mask_id, service_date, activity_detail_type, activity_detail_id, activity_desc, service_group, cpt_category, cost_block, payable, clinician_id
  FROM claim_activity
  WHERE cost_block NOT IN ('Drugs', 'Lab and Path', 'Consultation', 'Per Diem') AND (generic_name IS NULL OR generic_name = '');
CREATE VIEW diagnosis AS                    -- every diagnosis coded on a member's claims, with first/last date and claim count
  SELECT mask_id, diagnosis_id, MIN(service_date) AS first_date, MAX(service_date) AS last_date, COUNT(DISTINCT claim_id) AS claim_count
  FROM claim_activity WHERE diagnosis_id IS NOT NULL AND diagnosis_id <> '' GROUP BY mask_id, diagnosis_id;
