-- Member 360 views named as in CCC_Revised_Raw_Member360_Longitudinal_Care_Intelligence.xlsx (claims.sqlite)
CREATE VIEW IF NOT EXISTS member360_v AS
  SELECT m.mask_id AS member_id, m.gender, m.age_category, m.member_relation, p.plan, p.product, p.network_group, p.network_desc, p.effective_date, p.expiry_date, p.cancellation_date,
         m.claim_count, m.activity_count, m.payable_total, m.first_service_date, m.last_service_date
  FROM member m LEFT JOIN member_policy p ON p.mask_id = m.mask_id AND p.effective_date = (SELECT MAX(effective_date) FROM member_policy x WHERE x.mask_id = m.mask_id);
CREATE VIEW IF NOT EXISTS member360_claims_v AS
  SELECT c.claim_id, c.mask_id AS member_id, c.episode_id, c.service_date, c.bg_ipop, c.admit_desc, c.admit_date, c.discharge_date, c.los_days, c.provider_id, p.facility_name, c.clinician_id, cl.clinician_name, cl.specialty, c.primary_diagnosis_id, c.payable, c.claimed, c.denial
  FROM claim c LEFT JOIN provider p ON p.provider_id = c.provider_id LEFT JOIN clinician cl ON cl.clinician_id = c.clinician_id;
CREATE VIEW IF NOT EXISTS member360_labs_v AS
  SELECT l.observation_id, l.observation_sk, l.mask_id AS member_id, l.activity_id, l.claim_id, l.result_date, l.code, l.description, l.requested_value, l.approved_value, l.units, l.value_num, l.value_unit
  FROM lab_observation l;
