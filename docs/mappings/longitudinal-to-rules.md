# Longitudinal columns → rules

Which of the 377 longitudinal columns each rule reads. The first table is the evaluation logic actually executed by the engine (`rule_condition.csv` for triggers, alerts and cannot-tell; `risk_score_band.csv` for points). The second lists every binding recorded in `rule_input.csv` (294 rows), including display-only inputs.

## Columns read by executable rules

| longitudinal column | type | used by |
|---|---|---|
| `AGE` | num | RS-A-031a Man 40–59; RS-A-031b Man ≥ 60; RS-A-032a Woman 45–69; RS-A-032b Woman ≥ 70 |
| `GENDER` | text | RS-A-031a (scope); RS-A-031b (scope); RS-A-032a (scope); RS-A-032b (scope) |
| `Last_DiastolicPressure_Value` | num | trigger:BPU (>= 110); trigger:Trig2 (>= 90); trigger:Trig2 (>= 80); alert:RED (>= 110); alert:AMBER (>= 100) |
| `Last_HbA1c_Value` | num | trigger:Trig1 (>= 8); trigger:Trig6 (>= 8); cannot_tell:Trig6 (is_null); alert:AMBER (>= 9); RS-C-001 HbA1c < 7 (T2D only); RS-C-002 HbA1c 7–7.9 (T2D only); RS-C-003 HbA1c 8–8.9 (T2D only); RS-C-004 HbA1c 9–9.9 (T2D only); RS-C-005 HbA1c ≥ 10 (T2D only) |
| `Last_SystolicPressure_Value` | num | trigger:BPU (>= 180); trigger:Trig2 (>= 140); trigger:Trig2 (>= 130); cannot_tell:Trig2 (is_null); alert:RED (>= 180); alert:AMBER (>= 160) |
| `Last_UACR_Value` | num | cannot_tell:Trig5 (is_null); RS-K-025 UACR 30–299; RS-K-026 UACR ≥ 300 |
| `Last_eGFR_Value` | num | trigger:Trig5 (< 60); cannot_tell:Trig5 (is_null); alert:RED (< 15); RS-K-020 eGFR ≥ 60; RS-K-021 eGFR 45–59; RS-K-022 eGFR 30–44; RS-K-023 eGFR 15–29; RS-K-024a eGFR < 15 |
| `Priority_clinical_review` | flag | alert:RED (= 1) |
| `Trig10_new_diagnosis` | flag | trigger:Trig10 (= 1) |
| `Trig11_annual_labs_due` | flag | trigger:Trig11 (= 1) |
| `Trig12_eyeexam_due` | flag | trigger:Trig12 (= 1) |
| `Trig13_highriskfoot_monitor` | flag | trigger:Trig13 (= 1) |
| `Trig1_HbA1c_above_target` | flag | trigger:Trig1 (= 1) |
| `Trig2_HTN_tx_review` | flag | trigger:Trig2 (= 1) |
| `Trig3_hypoglycemia_tx` | flag | trigger:Trig3 (= 1) |
| `Trig4_post_discharge_care` | flag | trigger:Trig4 (= 1); alert:AMBER (= 1) |
| `Trig5_Kidney_check` | flag | trigger:Trig5 (= 1) |
| `Trig6_HbA1c_due` | flag | trigger:Trig6 (= 1) |
| `Trig7_Renal_Potassium_due` | flag | trigger:Trig7 (= 1) |
| `Trig8_nutrition_due` | flag | trigger:Trig8 (= 1) |
| `Trig9_medication_adherence` | flag | trigger:Trig9 (= 1) |
| `_fired_triggers` | derived | alert:YELLOW (>= 1) |
| `ckd_stage_l12m` | text | RS-K-027a CKD stage 3a documented (provisional: no eGFR and no UACR); RS-K-027b CKD stage 3b documented (provisional); RS-K-027c CKD stage 4 documented (provisional); RS-K-027d CKD stage 5 documented (provisional) |
| `cohort_htn_l12m` | flag | trigger:Trig2 (= 1); trigger:Trig7 (= 1); cannot_tell:Trig2 (= 1); RS-C-006 Hypertension diagnosis |
| `cohort_t2d_l12m` | flag | trigger:Trig1 (= 1); trigger:Trig2 (= 1); trigger:Trig3 (= 1); trigger:Trig5 (= 1); trigger:Trig6 (= 1); trigger:Trig12 (= 1); trigger:Trig13 (= 1); trigger:Trig8 (= 1); cannot_tell:Trig6 (= 1); cannot_tell:Trig5 (= 1) |
| `days_since_htn_supply_ran_out` | num | trigger:Trig9 (> 30) |
| `days_since_t2d_supply_ran_out` | num | trigger:Trig9 (> 30) |
| `ed_visits_l12m` | num | trigger:Trig4 (>= 2) |
| `first_dyslipidemia_date` | date | RS-M-009 Dyslipidaemia |
| `first_e11_date` | date | trigger:Trig10 (<= 90) |
| `first_htn_date` | date | trigger:Trig10 (<= 90) |
| `flag_active_ACEinhibitor` | flag | trigger:Trig7 (= 1) |
| `flag_active_ARBinhibitor` | flag | trigger:Trig7 (= 1) |
| `flag_amputation` | flag | trigger:Trig13 (= 1); RS-M-019 Major amputation |
| `flag_ckd` | flag | trigger:Trig2 (= 1) |
| `flag_current_smoker_l12m` | flag | RS-M-011 Current smoker |
| `flag_dialysis_l12m` | flag | RS-K-024b Dialysis |
| `flag_dka_l12m` | flag | alert:RED (= 1); RS-C-008 DKA in 12 months |
| `flag_dm_circulatory` | flag | RS-M-015 Peripheral arterial disease |
| `flag_dm_eye` | flag | RS-M-016 Diabetic retinopathy |
| `flag_dm_foot` | flag | RS-M-018 Diabetic foot ulcer |
| `flag_dm_foot_ulcer_l12m` | flag | trigger:Trig13 (= 1) |
| `flag_dm_hypoglycaemia_l12m` | flag | trigger:Trig3 (= 1); alert:RED (= 1); RS-C-007 Hypoglycaemia in 12 months |
| `flag_dm_neuropathy` | flag | RS-M-017 Peripheral neuropathy |
| `flag_heart_failure` | flag | RS-M-014 Heart failure |
| `flag_ischemic_heart_disease` | flag | RS-M-012 CAD / MI |
| `flag_obesity` | flag | RS-M-010 BMI ≥ 30 |
| `flag_stroke` | flag | RS-M-013 Stroke / TIA |
| `l12m_ED_visits_DiaborHTNrelated` | num | RS-U-028 ED visits not admitted (1 point each up to 3) |
| `l12m_IP_admissions_DiaborHTNrelated` | num | RS-U-029 One unplanned admission; RS-U-030 Two or more unplanned admissions |
| `last_diabeducator_visit` | date | trigger:Trig8 (missing_or_gt 365) |
| `last_dietitian_visit` | date | trigger:Trig8 (missing_or_gt 365) |
| `last_ed_visit_date` | date | trigger:Trig4 (<= 90) |
| `last_egfr_test_date` | date | trigger:Trig5 (missing_or_gt 365) |
| `last_foot_exam` | date | trigger:Trig13 (missing_or_gt 365) |
| `last_hba1c_date2` | date | trigger:Trig6 (missing_or_gt 180); trigger:Trig6 (missing_or_gt 90) |
| `last_ip_discharge_date` | date | trigger:Trig4 (<= 14) |
| `last_lipid_panel_date` | date | trigger:Trig11 (missing_or_gt 365) |
| `last_ophthalmology_visit` | date | trigger:Trig12 (missing_or_gt 730) |
| `last_potassium_date` | date | trigger:Trig7 (missing_or_gt 365) |
| `last_renal_panel_date` | date | trigger:Trig11 (missing_or_gt 365) |
| `last_retinal_screen_date` | date | trigger:Trig12 (missing_or_gt 730) |
| `last_urine_albumin_date` | date | trigger:Trig5 (missing_or_gt 365) |
| `pdc_any_htn` | share | trigger:Trig9 (< 0.8); alert:AMBER (< 0.5) |
| `pdc_any_t2d_noninsulin` | share | trigger:Trig9 (< 0.8); alert:AMBER (< 0.5) |
| `pdc_mra` | share | trigger:Trig7 (not_null) |
| `pdc_thiazide` | share | trigger:Trig7 (not_null) |

## Every binding in rule_input.csv

| rule table | rule key | role | longitudinal column |
|---|---|---|---|
| rule_alert | AMBER | alert | `Last_DiastolicPressure_Value` |
| rule_alert | AMBER | alert | `Last_HbA1c_Value` |
| rule_alert | AMBER | alert | `Last_SystolicPressure_Value` |
| rule_alert | AMBER | alert | `Last_eGFR_Value` |
| rule_alert | AMBER | alert | `Trig4_post_discharge_care` |
| rule_alert | AMBER | alert | `pdc_any_htn` |
| rule_alert | AMBER | alert | `pdc_any_t2d_noninsulin` |
| rule_alert | RED | alert | `Last_DiastolicPressure_Value` |
| rule_alert | RED | alert | `Last_SystolicPressure_Value` |
| rule_alert | RED | alert | `Last_eGFR_Value` |
| rule_alert | RED | alert | `Priority_clinical_review` |
| rule_alert | RED | alert | `flag_dka_l12m` |
| rule_alert | RED | alert | `flag_dm_hypoglycaemia_l12m` |
| rule_alert | YELLOW | alert | `Trig11_annual_labs_due` |
| rule_alert | YELLOW | alert | `Trig12_eyeexam_due` |
| rule_alert | YELLOW | alert | `Trig13_highriskfoot_monitor` |
| rule_alert | YELLOW | alert | `Trig5_Kidney_check` |
| rule_alert | YELLOW | alert | `Trig6_HbA1c_due` |
| rule_alert | YELLOW | alert | `Trig7_Renal_Potassium_due` |
| rule_builder_field_group | Health | builder | `cohort_htn_l12m` |
| rule_builder_field_group | Health | builder | `cohort_t2d_l12m` |
| rule_builder_field_group | Health | builder | `dm_complication_count` |
| rule_builder_field_group | Health | builder | `dm_complications` |
| rule_builder_field_group | Health | builder | `first_dyslipidemia_date` |
| rule_builder_field_group | Health | builder | `first_e11_date` |
| rule_builder_field_group | Health | builder | `first_htn_date` |
| rule_builder_field_group | Medicines | builder | `active_drug_class_count` |
| rule_builder_field_group | Medicines | builder | `active_drug_classes` |
| rule_builder_field_group | Medicines | builder | `distinct_medicines_90d` |
| rule_builder_field_group | Medicines | builder | `htn_drug_classes_l12m` |
| rule_builder_field_group | Medicines | builder | `t2d_drug_classes_l12m` |
| rule_builder_field_group | Other | builder | `Exclusion` |
| rule_builder_field_group | Other | builder | `l12m_payable_DiaborHTNrelated` |
| rule_builder_field_group | Other | builder | `l12m_payable_DiaborHTNrelated_inside` |
| rule_builder_field_group | Other | builder | `l12m_payable_DiaborHTNrelated_outside` |
| rule_builder_field_group | Other | builder | `l12m_payable_allcause` |
| rule_builder_field_group | Other | builder | `last_foot_exam` |
| rule_builder_field_group | Other | builder | `last_retinal_screen_date` |
| rule_builder_field_group | Other | builder | `phg_share_l12m_encounters` |
| rule_builder_field_group | Tests & results | builder | `Last_DiastolicPressure_Value` |
| rule_builder_field_group | Tests & results | builder | `Last_HbA1c_Value` |
| rule_builder_field_group | Tests & results | builder | `Last_MeasuredBMI_Value` |
| rule_builder_field_group | Tests & results | builder | `Last_SystolicPressure_Value` |
| rule_builder_field_group | Tests & results | builder | `Last_UACR_Value` |
| rule_builder_field_group | Tests & results | builder | `Last_eGFR_Value` |
| rule_builder_field_group | Tests & results | builder | `last_fastingplasmaglucose_value` |
| rule_builder_field_group | Visits & admissions | builder | `ed_visits_l12m` |
| rule_builder_field_group | Visits & admissions | builder | `encounters_l12m` |
| rule_builder_field_group | Visits & admissions | builder | `encounters_l12m_ed` |
| rule_builder_field_group | Visits & admissions | builder | `encounters_l12m_ip` |
| rule_builder_field_group | Visits & admissions | builder | `encounters_l12m_op` |
| rule_builder_field_group | Visits & admissions | builder | `er_visits_6m` |
| rule_builder_field_group | Visits & admissions | builder | `gp_claims_6m` |
| rule_builder_field_group | Visits & admissions | builder | `ip_admissions_6m` |
| rule_builder_field_group | Visits & admissions | builder | `ip_admissions_l12m` |
| rule_builder_field_group | Visits & admissions | builder | `last_visit_date` |
| rule_builder_field_group | Visits & admissions | builder | `specialist_claims_6m` |
| rule_builder_field_group | Who they are | builder | `AGE` |
| rule_builder_field_group | Who they are | builder | `GENDER` |
| rule_builder_field_group | Who they are | builder | `GWP` |
| rule_builder_field_group | Who they are | builder | `NATIONALITY` |
| rule_builder_field_group | Who they are | builder | `Risk Premium` |
| rule_builder_field_group | Who they are | builder | `policy_group` |
| rule_builder_field_group | Who they are | builder | `policy_type` |
| rule_contact_priority | P1–P4 | derived | `Trig4_post_discharge_care` |
| rule_event_type | MEMBER_FEATURE | display | `last_claim_activities` |
| rule_event_type | MEMBER_FEATURE | display | `last_claim_costblocks` |
| rule_event_type | MEMBER_FEATURE | display | `last_claim_date` |
| rule_event_type | MEMBER_FEATURE | display | `last_claim_dx_codes` |
| rule_event_type | MEMBER_FEATURE | display | `last_claim_dx_desc` |
| rule_event_type | MEMBER_FEATURE | display | `last_claim_facilities` |
| rule_event_type | MEMBER_FEATURE | display | `last_claim_medicines` |
| rule_event_type | MEMBER_FEATURE | display | `last_claim_payable` |
| rule_event_type | MEMBER_FEATURE | display | `last_claim_specialties` |
| rule_event_type | MEMBER_FEATURE | display | `last_ed_dx` |
| rule_event_type | MEMBER_FEATURE | display | `last_ed_dx_desc` |
| rule_event_type | MEMBER_FEATURE | display | `last_ed_facility` |
| rule_event_type | MEMBER_FEATURE | display | `last_ip_drg_desc` |
| rule_event_type | MEMBER_FEATURE | display | `last_ip_dx` |
| rule_event_type | MEMBER_FEATURE | display | `last_ip_dx_desc` |
| rule_event_type | MEMBER_FEATURE | display | `last_ip_facility` |
| rule_guardrail | G0 | gate | `Last_DiastolicPressure_Value` |
| rule_guardrail | G0 | gate | `Last_MeasuredBMI_Value` |
| rule_guardrail | G0 | gate | `Last_SystolicPressure_Value` |
| rule_guardrail | G10 | gate | `NATIONALITY` |
| rule_guardrail | G1c | gate | `Exclusion` |
| rule_guardrail | G1c | gate | `Exclusion_alreadyenrolled` |
| rule_guardrail | G1c | gate | `Exclusion_nonactiveaccounts` |
| rule_guardrail | G1c | gate | `Exclusion_op_consultations_encounter` |
| rule_guardrail | G1c | gate | `flag_dialysis_l12m` |
| rule_guardrail | G1c | gate | `flag_excl_adv_neuro_congenital_l12m` |
| rule_guardrail | G1c | gate | `flag_excl_palliative_hospice_ltc_l12m` |
| rule_guardrail | G1c | gate | `flag_excl_pregnant_postpartum` |
| rule_guardrail | G1c | gate | `flag_excl_psych_sud_dementia_l12m` |
| rule_guardrail | G1c | gate | `flag_excl_single_episode_gt60pct` |
| rule_guardrail | G1c | gate | `flag_excl_specialty_rx_gt60pct` |
| rule_guardrail | G1c | gate | `flag_excl_transplant_l24m` |
| rule_guardrail | G1c | gate | `flag_excl_ventilator_tpn_homenursing_l12m` |
| rule_guardrail | G1c | gate | `flag_oncology_l12m` |
| rule_guardrail | G1c | gate | `flag_oncology_l24m` |
| rule_guardrail | G1c | gate | `home_nursing_days_l12m` |
| rule_loop_step | Cohort | targeting | `Cohort_allocation` |
| rule_loop_step | Cohort | targeting | `Initial_target_cohort` |
| rule_loop_step | Cohort | targeting | `P1_Complication` |
| rule_loop_step | Cohort | targeting | `P2_Recurrent_ED_IP` |
| rule_loop_step | Cohort | targeting | `P3_offradar` |
| rule_loop_step | Cohort | targeting | `P3_slipping` |
| rule_loop_step | Cohort | targeting | `P4_uncontrolled` |
| rule_loop_step | Cohort | targeting | `P5_newlydiagnosed` |
| rule_loop_step | Cohort | targeting | `Persona` |
| rule_queue_order | 1–4 | derived | `Priority_clinical_review` |
| rule_queue_order | 1–4 | derived | `Total_risk_Score` |
| rule_risk_band | A | score_input | `AGE` |
| rule_risk_band | A | score_input | `Age_sex_score` |
| rule_risk_band | A | score_input | `GENDER` |
| rule_risk_band | C | score_input | `Clinical_score` |
| rule_risk_band | C | score_input | `HbA1c_score` |
| rule_risk_band | C | score_input | `Last_HbA1c_Value` |
| rule_risk_band | C | score_input | `cohort_htn_l12m` |
| rule_risk_band | C | score_input | `flag_dka_l12m` |
| rule_risk_band | C | score_input | `flag_dm_hyperglycaemic_crisis_l12m` |
| rule_risk_band | C | score_input | `flag_dm_hypoglycaemia_l12m` |
| rule_risk_band | C | score_input | `flag_dm_hypoglycaemia_last90days` |
| rule_risk_band | C | score_input | `htn_identified_by` |
| rule_risk_band | K | score_input | `Kidney_score` |
| rule_risk_band | K | score_input | `Last_UACR_Date` |
| rule_risk_band | K | score_input | `Last_UACR_Value` |
| rule_risk_band | K | score_input | `Last_eGFR_Date` |
| rule_risk_band | K | score_input | `Last_eGFR_Value` |
| rule_risk_band | K | score_input | `ckd_stage_l12m` |
| rule_risk_band | K | score_input | `eGFR + UACR points` |
| rule_risk_band | K | score_input | `flag_any_kidney_disease_l12m` |
| rule_risk_band | K | score_input | `flag_ckd_l12m` |
| rule_risk_band | K | score_input | `flag_dialysis_l12m` |
| rule_risk_band | K | score_input | `flag_kidney_failure_l12m` |
| rule_risk_band | M | score_input | `Comorbid_complication_score` |
| rule_risk_band | M | score_input | `Last_MeasuredBMI_Value` |
| rule_risk_band | M | score_input | `dm_complication_count` |
| rule_risk_band | M | score_input | `dm_complications` |
| rule_risk_band | M | score_input | `first_dyslipidemia_date` |
| rule_risk_band | M | score_input | `flag_amputation_l12m` |
| rule_risk_band | M | score_input | `flag_cad_mi_l12m` |
| rule_risk_band | M | score_input | `flag_current_smoker_l12m` |
| rule_risk_band | M | score_input | `flag_dm_circulatory_l12m` |
| rule_risk_band | M | score_input | `flag_dm_eye_l12m` |
| rule_risk_band | M | score_input | `flag_dm_foot_l12m` |
| rule_risk_band | M | score_input | `flag_dm_foot_ulcer_l12m` |
| rule_risk_band | M | score_input | `flag_dm_neuropathy_l12m` |
| rule_risk_band | M | score_input | `flag_dm_retinopathy_l12m` |
| rule_risk_band | M | score_input | `flag_dyslipidemia_l12m` |
| rule_risk_band | M | score_input | `flag_former_smoker_code` |
| rule_risk_band | M | score_input | `flag_heart_failure_l12m` |
| rule_risk_band | M | score_input | `flag_ischemic_heart_disease_l12m` |
| rule_risk_band | M | score_input | `flag_major_amputation_l12m` |
| rule_risk_band | M | score_input | `flag_mi_l12m` |
| rule_risk_band | M | score_input | `flag_obesity` |
| rule_risk_band | M | score_input | `flag_pad_l12m` |
| rule_risk_band | M | score_input | `flag_peripheral_neuropathy_l12m` |
| rule_risk_band | M | score_input | `flag_stroke_l12m` |
| rule_risk_band | M | score_input | `flag_stroke_tia_l12m` |
| rule_risk_band | M | score_input | `last_smoking_evidence_date` |
| rule_risk_band | U | score_input | `Utilization_score` |
| rule_risk_band | U | score_input | `ed_visits_l12m` |
| rule_risk_band | U | score_input | `er_visits_6m` |
| rule_risk_band | U | score_input | `ip_admissions_6m` |
| rule_risk_band | U | score_input | `ip_admissions_l12m` |
| rule_safety_flag | safety | safety | `Priority_clinical_review` |
| rule_safety_flag | safety | safety | `flag_EDorIP_with_hypoglycaemia_last90days` |
| rule_safety_flag | safety | safety | `flag_dka_l12m` |
| rule_safety_flag | safety | safety | `flag_dm_hypoglycaemia_l12m` |
| rule_tier | R | score | `Total_risk_Score` |
| rule_tier | tier | score | `Risk_tier` |
| rule_trigger | BPU | raw | `Last_DiastolicPressure_Value` |
| rule_trigger | BPU | raw | `Last_SystolicPressure_Date` |
| rule_trigger | BPU | raw | `Last_SystolicPressure_Value` |
| rule_trigger | Trig1 | raw | `Last_HbA1c_Date` |
| rule_trigger | Trig1 | raw | `Last_HbA1c_Value` |
| rule_trigger | Trig1 | extract_flag | `Trig1_HbA1c_above_target` |
| rule_trigger | Trig1 | raw | `last_hba1c_date2` |
| rule_trigger | Trig10 | extract_flag | `Trig10_new_diagnosis` |
| rule_trigger | Trig10 | raw | `first_e11_date` |
| rule_trigger | Trig10 | raw | `first_htn_date` |
| rule_trigger | Trig10 | raw | `latest_new_htn_class_start_date` |
| rule_trigger | Trig10 | raw | `latest_new_t2d_class_start_date` |
| rule_trigger | Trig11 | extract_flag | `Trig11_annual_labs_due` |
| rule_trigger | Trig11 | raw | `last_cbc_date` |
| rule_trigger | Trig11 | raw | `last_lipid_panel_date` |
| rule_trigger | Trig11 | raw | `last_liver_function_date` |
| rule_trigger | Trig11 | raw | `last_renal_panel_date` |
| rule_trigger | Trig12 | extract_flag | `Trig12_eyeexam_due` |
| rule_trigger | Trig12 | raw | `last_ophthalmology_visit` |
| rule_trigger | Trig12 | raw | `last_retinal_screen_date` |
| rule_trigger | Trig13 | extract_flag | `Trig13_highriskfoot_monitor` |
| rule_trigger | Trig13 | raw | `flag_amputation_l12m` |
| rule_trigger | Trig13 | raw | `flag_dm_foot_l12m` |
| rule_trigger | Trig13 | raw | `flag_dm_foot_ulcer_l12m` |
| rule_trigger | Trig13 | raw | `flag_pad_l12m` |
| rule_trigger | Trig13 | raw | `flag_peripheral_neuropathy_l12m` |
| rule_trigger | Trig13 | raw | `last_foot_exam` |
| rule_trigger | Trig13 | raw | `last_podiatry_visit` |
| rule_trigger | Trig2 | raw | `Last_DiastolicPressure_Value` |
| rule_trigger | Trig2 | raw | `Last_SystolicPressure_Value` |
| rule_trigger | Trig2 | extract_flag | `Trig2_HTN_tx_review` |
| rule_trigger | Trig2 | extract_flag | `Trig2a_NoACEiARB_KidneyOrCAD` |
| rule_trigger | Trig2 | extract_flag | `Trig2b_ACEi_plus_ARB` |
| rule_trigger | Trig2 | raw | `flag_active_ACEinhibitor` |
| rule_trigger | Trig2 | raw | `flag_active_ARBinhibitor` |
| rule_trigger | Trig2 | raw | `flag_cad_mi_l12m` |
| rule_trigger | Trig2 | raw | `flag_ckd_l12m` |
| rule_trigger | Trig2 | raw | `flag_overlap_ACE_ARB_more_than_30days` |
| rule_trigger | Trig2 | raw | `htn_drug_classes_l12m` |
| rule_trigger | Trig3 | extract_flag | `Trig3_hypoglycemia_tx` |
| rule_trigger | Trig3 | extract_flag | `Trig3a_hypoglycemia_rev` |
| rule_trigger | Trig3 | extract_flag | `Trig3b_glucagon_not_dispensed` |
| rule_trigger | Trig3 | raw | `flag_EDorIP_with_hypoglycaemia_last90days` |
| rule_trigger | Trig3 | raw | `flag_active_insulin` |
| rule_trigger | Trig3 | raw | `flag_active_sulfonylurea` |
| rule_trigger | Trig3 | raw | `flag_dm_hypoglycaemia_l12m` |
| rule_trigger | Trig3 | raw | `flag_dm_hypoglycaemia_last90days` |
| rule_trigger | Trig3 | raw | `flag_glucagon_last12months` |
| rule_trigger | Trig3 | raw | `flag_hypo_hyper_glycemia_last6months` |
| rule_trigger | Trig3 | raw | `flag_no_glucagon_last12months` |
| rule_trigger | Trig4 | extract_flag | `Trig4_post_discharge_care` |
| rule_trigger | Trig4 | extract_flag | `Trig4a_NoFollowup_post_discharge` |
| rule_trigger | Trig4 | extract_flag | `Trig4b_postdischarge_medsgap` |
| rule_trigger | Trig4 | raw | `days_discharge_to_first_visit` |
| rule_trigger | Trig4 | raw | `ed_visits_l12m` |
| rule_trigger | Trig4 | raw | `er_visits_6m` |
| rule_trigger | Trig4 | raw | `first_visit_after_discharge` |
| rule_trigger | Trig4 | raw | `flag_missing_HTNrefill_post_last_discharge` |
| rule_trigger | Trig4 | raw | `flag_missing_T2Drefill_post_last_discharge` |
| rule_trigger | Trig4 | raw | `flag_no_visit_after_discharge` |
| rule_trigger | Trig4 | raw | `last_ed_visit_date` |
| rule_trigger | Trig4 | raw | `last_ip_admit_date` |
| rule_trigger | Trig4 | raw | `last_ip_discharge_date` |
| rule_trigger | Trig4 | raw | `last_ip_discharge_type` |
| rule_trigger | Trig4 | raw | `second_last_ip_discharge_date` |
| rule_trigger | Trig5 | raw | `Last_UACR_Date` |
| rule_trigger | Trig5 | raw | `Last_UACR_Value` |
| rule_trigger | Trig5 | raw | `Last_eGFR_Value` |
| rule_trigger | Trig5 | extract_flag | `Trig5_Kidney_check` |
| rule_trigger | Trig5 | extract_flag | `Trig5a_Kidney_screen_due` |
| rule_trigger | Trig5 | extract_flag | `Trig5b_CKD_monitoring` |
| rule_trigger | Trig5 | extract_flag | `Trig5c_Neph_due` |
| rule_trigger | Trig5 | raw | `ckd_stage_l12m` |
| rule_trigger | Trig5 | raw | `flag_ckd_l12m` |
| rule_trigger | Trig5 | raw | `last_egfr_test_date` |
| rule_trigger | Trig5 | raw | `last_nephrology_visit` |
| rule_trigger | Trig5 | raw | `last_renal_panel_date` |
| rule_trigger | Trig5 | raw | `last_urine_albumin_date` |
| rule_trigger | Trig6 | raw | `Last_HbA1c_Date` |
| rule_trigger | Trig6 | raw | `Last_HbA1c_Value` |
| rule_trigger | Trig6 | extract_flag | `Trig6_HbA1c_due` |
| rule_trigger | Trig6 | raw | `last_hba1c_date2` |
| rule_trigger | Trig7 | extract_flag | `Trig7_Renal_Potassium_due` |
| rule_trigger | Trig7 | raw | `first_ACE_ARB_MRA_thiazide_fill_date` |
| rule_trigger | Trig7 | raw | `flag_active_ACEinhibitor` |
| rule_trigger | Trig7 | raw | `flag_active_ARBinhibitor` |
| rule_trigger | Trig7 | raw | `htn_drug_classes_l12m` |
| rule_trigger | Trig7 | raw | `last_potassium_date` |
| rule_trigger | Trig7 | raw | `pdc_mra` |
| rule_trigger | Trig7 | raw | `pdc_thiazide` |
| rule_trigger | Trig8 | extract_flag | `Trig8_nutrition_due` |
| rule_trigger | Trig8 | raw | `last_diabeducator_visit` |
| rule_trigger | Trig8 | raw | `last_dietitian_visit` |
| rule_trigger | Trig9 | extract_flag | `Trig9_medication_adherence` |
| rule_trigger | Trig9 | raw | `active_drug_class_count` |
| rule_trigger | Trig9 | raw | `days_since_htn_supply_ran_out` |
| rule_trigger | Trig9 | raw | `days_since_t2d_supply_ran_out` |
| rule_trigger | Trig9 | raw | `flag_htn_rx_gap_over_30d` |
| rule_trigger | Trig9 | raw | `flag_t2d_rx_gap_over_30d` |
| rule_trigger | Trig9 | raw | `last_htn_fill_date` |
| rule_trigger | Trig9 | raw | `last_t2d_fill_date` |
| rule_trigger | Trig9 | raw | `pdc_acei` |
| rule_trigger | Trig9 | raw | `pdc_any_htn` |
| rule_trigger | Trig9 | raw | `pdc_any_t2d_noninsulin` |
| rule_trigger | Trig9 | raw | `pdc_arb` |
| rule_trigger | Trig9 | raw | `pdc_beta_blocker` |
| rule_trigger | Trig9 | raw | `pdc_ccb` |
| rule_trigger | Trig9 | raw | `pdc_dpp4` |
| rule_trigger | Trig9 | raw | `pdc_glp1` |
| rule_trigger | Trig9 | raw | `pdc_metformin` |
| rule_trigger | Trig9 | raw | `pdc_mra` |
| rule_trigger | Trig9 | raw | `pdc_sglt2` |
| rule_trigger | Trig9 | raw | `pdc_sulfonylurea` |
| rule_trigger | Trig9 | raw | `pdc_thiazide` |
| rule_trigger | Trig9 | raw | `pdc_tzd` |
| rule_trigger | all | raw | `# of triggers` |
| rule_trigger | pathway | raw | `cohort_htn_l12m` |
| rule_trigger | pathway | raw | `cohort_t2d_l12m` |
| rule_trigger | pathway | raw | `htn_category` |
| rule_trigger | pathway | raw | `htn_identified_by` |
| rule_trigger | pathway | raw | `t2d_category` |
| rule_trigger | pathway | raw | `t2d_identified_by` |
