# Longitudinal catalogue · 377 columns

Every header of `250_members_longitudinal_data.xlsx` as loaded into `member_longitudinal` (column name = header, text kept as text, numbers as REAL, dates as ISO). `read_by_rules` shows which rule table reads the column (from `rule_input.csv`); the description comes from the data glossary.

| # | column | type | group | read by rules | description |
|---|---|---|---|---|---|
| 1 | `mask_id` | text | Identity |  | Masked member identifier (m1, m2, ...); one row per member. Replaces member_id and life_id in this file. |
| 2 | `GENDER` | text | Who they are | rule_builder_field_group:Who they are; rule_risk_band:A | Gender, taken from the member's most recent claim. |
| 3 | `AGE` | num | Who they are | rule_builder_field_group:Who they are; rule_risk_band:A | Age in years, from the latest year in the age table. |
| 4 | `NATIONALITY` | text | Who they are | rule_builder_field_group:Who they are; rule_guardrail:G10 | Member's nationality, provided by DABI team |
| 5 | `policy_group` | text | Who they are | rule_builder_field_group:Who they are | Employer or policy group behind the member's policy (Final_Policy_Group), looked up by member_id from the premium and policy data shared by the DABI team; '-' i |
| 6 | `policy_type` | text | Who they are | rule_builder_field_group:Who they are | Type of policy, for example Group vs. Individual (Final_Policy_Type), from the premium and policy data shared by the DABI team; '-' if not found. |
| 7 | `cohort_t2d_l12m` | flag | Pathway | rule_builder_field_group:Health; rule_trigger:pathway | 1 if the member had a claim billed for type 2 diabetes (E11) as a chronic condition in the last 12 months (Nov 2025 to Oct 2026). |
| 8 | `cohort_htn_l12m` | flag | Pathway | rule_builder_field_group:Health; rule_risk_band:C; rule_trigger:pathway | 1 if the member had a claim billed for hypertension (I10) as a chronic condition in the last 12 months (Nov 2025 to Oct 2026). |
| 9 | `t2d_identified_by` | text | Pathway | rule_trigger:pathway | How diabetes shows in the historical claims data: DX + RX (diagnosed and filling diabetes medicines), DX only (diagnosed, no diabetes medicine filled through Da |
| 10 | `htn_identified_by` | text | Pathway | rule_risk_band:C; rule_trigger:pathway | The same for hypertension (I10 diagnosis and blood-pressure medicines): DX + RX, DX only, RX only, Not HTN. |
| 11 | `t2d_category` | text | Pathway | rule_trigger:pathway | Network attachment, first that applies: In PHG network for the specified condition in 2026 (a 2026 diabetes claim at SEHA or SSMC); In PHG network for other chr |
| 12 | `htn_category` | text | Pathway | rule_trigger:pathway | Network attachment, first that applies: In PHG network for the specified condition in 2026 (a 2026 hypertension claim at SEHA or SSMC); In PHG network for other |
| 13 | `GWP` | num | Who they are | rule_builder_field_group:Who they are | Gross written premium for the member, AED, from the premium data shared by the DABI team; '-' if not found. |
| 14 | `Risk Premium` | num | Who they are | rule_builder_field_group:Who they are | Risk premium for the member, AED, from the premium data shared by the DABI team; '-' if not found. |
| 15 | `Exclusion_nonactiveaccounts` | num | Exclusions and gates | rule_guardrail:G1c |  |
| 16 | `Exclusion_op_consultations_encounter` | num | Exclusions and gates | rule_guardrail:G1c |  |
| 17 | `Exclusion_alreadyenrolled` | num | Exclusions and gates | rule_guardrail:G1c |  |
| 18 | `Exclusion` | flag | Exclusions and gates | rule_builder_field_group:Other; rule_guardrail:G1c | 1 = left out of outreach. Any of: cancer claim in the last 24 months (flag_oncology_l24m); outside the PHG network with 75%+ of outpatient encounters at one pro |
| 19 | `P1_Complication` | flag | Persona and targeting | rule_loop_step:Cohort | 1 if any of these was billed on any claim since January 2024: kidney disease of any kind, dialysis, stroke, heart failure, heart attack, or a diabetic kidney, e |
| 20 | `P2_Recurrent_ED_IP` | flag | Persona and targeting | rule_loop_step:Cohort | 1 if emergency visits plus hospital admissions in the last 12 months (ed_visits_l12m + ip_admissions_l12m) total 2 or more. |
| 21 | `P3_slipping` | flag | Persona and targeting | rule_loop_step:Cohort | 1 if a diabetes or BP medicine ran out more than 30 days ago, or adherence (PDC) is below 0.8 for non-insulin diabetes medicines or for BP medicines. |
| 22 | `P5_newlydiagnosed` | flag | Persona and targeting | rule_loop_step:Cohort | 1 if the first diabetes (E11) or hypertension (I10) claim was in the 180 days before the review date (31 Oct 2026). |
| 23 | `P3_offradar` | flag | Persona and targeting | rule_loop_step:Cohort | 1 if no GP and no specialist consultation in the last 6 months, or the member has diabetes and no HbA1c test billed in the 365 days before the review date. |
| 24 | `P4_uncontrolled` | flag | Persona and targeting | rule_loop_step:Cohort | 1 if the latest HbA1c is above 7% (values between 3 and 20 only), or the latest systolic blood pressure is above 130 mmHg (values between 60 and 260 only). |
| 25 | `Persona` | text | Persona and targeting | rule_loop_step:Cohort | One persona per member, the first that applies: 1. Complications (P1), 2. Recurrent ED/IP (P2), 3. Drifting from care (P3_slipping or P3_offradar), 4. Uncontrol |
| 26 | `Trig1_HbA1c_above_target` | flag | Trigger flags (extract-computed) | rule_trigger:Trig1 | 1 if the member has diabetes and the latest HbA1c is 6.5% or more (values between 3 and 20 only). |
| 27 | `Trig2a_NoACEiARB_KidneyOrCAD` | flag | Trigger flags (extract-computed) | rule_trigger:Trig2 | 1 if the member has diabetes and hypertension, is on neither an ACE inhibitor nor an ARB, and has diabetic kidney disease, CKD, heart attack, ischaemic heart di |
| 28 | `Trig2b_ACEi_plus_ARB` | flag | Trigger flags (extract-computed) | rule_trigger:Trig2 | 1 if an ACE inhibitor and an ARB are both active and their supplies overlapped by more than 30 days (a combination DoH says not to use). |
| 29 | `Trig2_HTN_tx_review` | flag | Trigger flags (extract-computed) | rule_trigger:Trig2 | 1 if Trig2a or Trig2b is 1. |
| 30 | `Trig3a_hypoglycemia_rev` | flag | Trigger flags (extract-computed) | rule_trigger:Trig3 | 1 if there was a hypoglycaemia claim (E11.64x or E16.0-E16.2) in the last 90 days. |
| 31 | `Trig3b_glucagon_not_dispensed` | flag | Trigger flags (extract-computed) | rule_trigger:Trig3 | 1 if the member has diabetes, had no rescue glucagon in the last 12 months, and is on insulin, or on a sulfonylurea with a hypoglycaemia claim on any claim sinc |
| 32 | `Trig3_hypoglycemia_tx` | flag | Trigger flags (extract-computed) | rule_trigger:Trig3 | 1 if Trig3a or Trig3b is 1. |
| 33 | `Trig4a_NoFollowup_post_discharge` | flag | Trigger flags (extract-computed) | rule_trigger:Trig4 | 1 if discharged from hospital and no clinic visit since (same as flag_no_visit_after_discharge). |
| 34 | `Trig4b_postdischarge_medsgap` | flag | Trigger flags (extract-computed) | rule_trigger:Trig4 | 1 if a diabetes or BP medicine filled before the last admission was not refilled within 30 days of discharge. |
| 35 | `Trig4_post_discharge_care` | flag | Trigger flags (extract-computed) | rule_alert:AMBER; rule_contact_priority:P1–P4; rule_trigger:Trig4 | 1 if Trig4a or Trig4b is 1. |
| 36 | `Trig5a_Kidney_screen_due` | flag | Trigger flags (extract-computed) | rule_trigger:Trig5 | 1 if the member has diabetes and the urine albumin test or the eGFR result is missing or older than 365 days. |
| 37 | `Trig5b_CKD_monitoring` | flag | Trigger flags (extract-computed) | rule_trigger:Trig5 | 1 if the member has CKD or diabetic kidney disease and the eGFR result or the urine albumin test is missing or older than 90 days. |
| 38 | `Trig5c_Neph_due` | flag | Trigger flags (extract-computed) | rule_trigger:Trig5 | 1 if the latest eGFR is below 30, the member is not on dialysis, and there was no nephrology visit in the last 365 days. |
| 39 | `Trig5_Kidney_check` | flag | Trigger flags (extract-computed) | rule_alert:YELLOW; rule_trigger:Trig5 | 1 if Trig5a, Trig5b or Trig5c is 1. |
| 40 | `Trig6_HbA1c_due` | flag | Trigger flags (extract-computed) | rule_alert:YELLOW; rule_trigger:Trig6 | 1 if the member has diabetes and any of: no HbA1c test in 180 days; latest HbA1c 7% or more and no test in 90 days; a hypo- or hyperglycaemia claim in the last  |
| 41 | `Trig7_Renal_Potassium_due` | flag | Trigger flags (extract-computed) | rule_alert:YELLOW; rule_trigger:Trig7 | 1 if the member has hypertension and either the newest ACE inhibitor, ARB, MRA or thiazide class started 14+ days ago with no potassium test since, or one of th |
| 42 | `Trig8_nutrition_due` | flag | Trigger flags (extract-computed) | rule_trigger:Trig8 | 1 if the member has diabetes and had no diabetes-educator visit and no dietitian visit in the last 365 days. |
| 43 | `Trig9_medication_adherence` | flag | Trigger flags (extract-computed) | rule_trigger:Trig9 | 1 if a diabetes or BP medicine ran out more than 30 days ago, or PDC is below 0.8 for non-insulin diabetes or BP medicines. |
| 44 | `Trig10_new_diagnosis` | flag | Trigger flags (extract-computed) | rule_trigger:Trig10 | 1 if the first diabetes or hypertension claim was in the last 180 days, or a member without diabetes has fasting glucose 7.0+ mmol/L, 2-hour glucose 11.1+, rand |
| 45 | `Trig11_annual_labs_due` | flag | Trigger flags (extract-computed) | rule_alert:YELLOW; rule_trigger:Trig11 | 1 if on an ACE inhibitor or ARB with no potassium test in 365 days, or the member has diabetes and any of these is missing or older than 365 days: lipid panel,  |
| 46 | `Trig12_eyeexam_due` | flag | Trigger flags (extract-computed) | rule_alert:YELLOW; rule_trigger:Trig12 | 1 if the member has diabetes and had no retinal screening and no eye-doctor visit for 365 days when there is diabetic eye disease or HbA1c 7%+, otherwise for 73 |
| 47 | `Trig13_highriskfoot_monitor` | flag | Trigger flags (extract-computed) | rule_alert:YELLOW; rule_trigger:Trig13 | 1 if dialysis, diabetic foot, amputation or diabetic neuropathy (any claim since January 2024), and no podiatry visit in the last 180 days. |
| 48 | `# of triggers` | num | Risk score (extract-computed) | rule_trigger:all | Number of main triggers that are 1: Trig1 to Trig13 (the a / b / c sub-triggers are not counted separately). 0-13. |
| 49 | `HbA1c_score` | num | Risk score (extract-computed) | rule_risk_band:C | HbA1c points (H), from the latest HbA1c: 0 if below 7%, 1 if 7.0-7.9%, 2 if 8.0-8.9%, 3 if 9.0-9.9%, 4 if 10% or more; 0 when there is no result. |
| 50 | `Clinical_score` | num | Risk score (extract-computed) | rule_risk_band:C | Clinical score C, maximum 5: HbA1c_score + 2 if hypertension (cohort_htn_l12m = 1) + 3 if DKA coded in the last 12 months (flag_dka_l12m) + 2 if hypoglycaemia c |
| 51 | `Comorbid_complication_score` | num | Risk score (extract-computed) | rule_risk_band:M | Comorbidity and complication score M, maximum 6, from conditions billed on any claim since January 2024: dyslipidaemia 1 (first_dyslipidemia_date present), curr |
| 52 | `eGFR + UACR points` | num | Risk score (extract-computed) | rule_risk_band:K | Kidney points from lab results, maximum 5. eGFR (when there is a result): 4 if on dialysis (flag_dialysis), otherwise 0 if 60+, 1 if 45-59, 2 if 30-44, 3 if 15- |
| 53 | `Kidney_score` | num | Risk score (extract-computed) | rule_risk_band:K | Kidney score K, maximum 5: the lab-based points (eGFR + UACR points). When both eGFR and UACR are missing, the documented CKD stage is used instead (ckd_stage_l |
| 54 | `Utilization_score` | num | Risk score (extract-computed) | rule_risk_band:U | Utilisation score U, maximum 5: diabetes / hypertension related ED visits in the last 12 months (l12m_ED_visits_DiaborHTNrelated) = 1 point each up to 3, plus r |
| 55 | `Age_sex_score` | num | Risk score (extract-computed) | rule_risk_band:A | Age and sex score A, 0-2. Men: under 40 = 0, 40-59 = 1, 60+ = 2. Women: under 45 = 0, 45-69 = 1, 70+ = 2. |
| 56 | `Total_risk_Score` | num | Risk score (extract-computed) | rule_queue_order:1–4; rule_tier:R | Total risk score R = Clinical + Comorbidity + Kidney + Utilisation + Age/sex (0-23). |
| 57 | `Risk_tier` | text | Risk score (extract-computed) | rule_tier:tier | Tier from the total risk score: 0-3 = 4. Low, 4-7 = 3. Moderate, 8-12 = 2. High, 13+ = 1. Very High. |
| 58 | `Cohort_allocation` | text | Persona and targeting | rule_loop_step:Cohort | Programme the member is allocated to by tier: Very High or High = 'PREVHEATH'; Moderate or Low = 'PURECS'. |
| 59 | `Initial_target_cohort` | num | Persona and targeting | rule_loop_step:Cohort |  |
| 60 | `Priority_clinical_review` | flag | Risk score (extract-computed) | rule_alert:RED; rule_queue_order:1–4; rule_safety_flag:safety | Safety flag, independent of the tier: 1 if DKA (flag_dka_l12m) or a hypoglycaemia was coded in the last 12 months. |
| 61 | `Last_HbA1c_Value` | num | Labs and readings | rule_alert:AMBER; rule_builder_field_group:Tests & results; rule_risk_band:C; rule_trigger:Trig1; rule_trigger:Trig6 | Latest HbA1c (3-month average blood sugar), in %. Readings above 20 are treated as mmol/mol and converted to %. |
| 62 | `Last_HbA1c_Date` | date | Labs and readings | rule_trigger:Trig1; rule_trigger:Trig6 | Date of the latest HbA1c result. |
| 63 | `Last_SystolicPressure_Value` | num | Labs and readings | rule_alert:AMBER; rule_alert:RED; rule_builder_field_group:Tests & results; rule_guardrail:G0; rule_trigger:BPU; rule_trigger:Trig2 | Latest top blood-pressure number, mmHg. |
| 64 | `Last_SystolicPressure_Date` | date | Labs and readings | rule_trigger:BPU | Date of the latest systolic reading. |
| 65 | `Last_DiastolicPressure_Value` | num | Labs and readings | rule_alert:AMBER; rule_alert:RED; rule_builder_field_group:Tests & results; rule_guardrail:G0; rule_trigger:BPU; rule_trigger:Trig2 | Latest bottom blood-pressure number, mmHg. |
| 66 | `Last_DiastolicPressure_Date` | date | Labs and readings |  | Date of the latest diastolic reading. |
| 67 | `Last_MeasuredBMI_Value` | num | Labs and readings | rule_builder_field_group:Tests & results; rule_guardrail:G0; rule_risk_band:M | Latest body mass index. Often missing. |
| 68 | `Last_MeasuredBMI_Date` | date | Labs and readings |  | Date of the latest BMI. |
| 69 | `Last_eGFR_Value` | num | Labs and readings | rule_alert:AMBER; rule_alert:RED; rule_builder_field_group:Tests & results; rule_risk_band:K; rule_trigger:Trig5 | Latest kidney-function score (eGFR), mL/min/1.73m2. Below 60 suggests chronic kidney disease; below 30 is severe. |
| 70 | `Last_eGFR_Date` | date | Labs and readings | rule_risk_band:K | Date of the latest eGFR result. |
| 71 | `last_fastingplasmaglucose_value` | num | Labs and readings | rule_builder_field_group:Tests & results | Latest fasting plasma glucose, mmol/L (readings above 30 are treated as mg/dL and divided by 18). 7.0 or more is in the diabetes range. |
| 72 | `last_fastingplasmaglucose_date` | date | Labs and readings |  | Date of the latest fasting glucose. |
| 73 | `last_2hourplasmaglucose_value` | num | Labs and readings |  | Latest 2-hour glucose after a 75 g glucose drink, mmol/L (converted from mg/dL when above 30). 11.1 or more is in the diabetes range. |
| 74 | `last_2hourplasmaglucose_date` | date | Labs and readings |  | Date of the latest 2-hour glucose. |
| 75 | `last_randomplasmaglucose_value` | num | Labs and readings |  | Latest plasma glucose with no fasting or timing stated, mmol/L (converted from mg/dL when above 30). |
| 76 | `last_randomplasmaglucose_date` | date | Labs and readings |  | Date of the latest random glucose. |
| 77 | `last_hba1c_date2` | date | Labs and readings | rule_trigger:Trig1; rule_trigger:Trig6 | Latest HbA1c test billed (date). Can differ from Last_HbA1c_Date when the result was not sent with the claim. (last_hba1c_date in the query) |
| 78 | `last_lipid_panel_date` | date | Labs and readings | rule_trigger:Trig11 | Latest cholesterol test billed. |
| 79 | `last_urine_albumin_date` | date | Labs and readings | rule_trigger:Trig5 | Latest quantitative urine albumin test billed (the albumin part of UACR, CPT 82043). |
| 80 | `last_renal_panel_date` | date | Labs and readings | rule_trigger:Trig11; rule_trigger:Trig5 | Latest creatinine test, or a blood panel that includes it. |
| 81 | `last_egfr_test_date` | date | Labs and readings | rule_trigger:Trig5 | Latest test from which eGFR is calculated: creatinine, panels that include it, or cystatin C. |
| 82 | `last_retinal_screen_date` | date | Labs and readings | rule_builder_field_group:Other; rule_trigger:Trig12 | Latest diabetic eye screening: retinal photos or scans, angiography, extended ophthalmoscopy, or an eye exam. |
| 83 | `last_liver_function_date` | date | Labs and readings | rule_trigger:Trig11 | Latest liver function test (liver panel, metabolic panel, ALT or AST). |
| 84 | `last_cbc_date` | date | Labs and readings | rule_trigger:Trig11 | Latest complete blood count. |
| 85 | `last_vitb12_date` | date | Labs and readings |  | Latest vitamin B12 test. |
| 86 | `last_potassium_date` | date | Labs and readings | rule_trigger:Trig7 | Latest potassium test, alone or in a panel that includes it. |
| 87 | `last_endocrinology_visit` | date | Visits by specialty |  | Latest outpatient consultation with an endocrinologist (diabetes specialist). |
| 88 | `last_podiatry_visit` | date | Visits by specialty | rule_trigger:Trig13 | Latest outpatient consultation with a podiatrist (foot care). |
| 89 | `last_foot_exam` | date | Visits by specialty | rule_builder_field_group:Other; rule_trigger:Trig13 | Latest foot examination billed (diabetic foot exam or foot care codes). |
| 90 | `last_ophthalmology_visit` | date | Visits by specialty | rule_trigger:Trig12 | Latest outpatient consultation with an ophthalmologist or optometrist. |
| 91 | `last_cardiology_visit` | date | Visits by specialty |  | Latest outpatient consultation with a cardiologist. |
| 92 | `last_nephrology_visit` | date | Visits by specialty | rule_trigger:Trig5 | Latest outpatient consultation with a nephrologist (kidney specialist). |
| 93 | `last_dietitian_visit` | date | Visits by specialty | rule_trigger:Trig8 | Latest outpatient visit with a dietitian or nutritionist, or a medical-nutrition-therapy session. |
| 94 | `last_diabeducator_visit` | date | Visits by specialty | rule_trigger:Trig8 | Latest outpatient visit with a diabetes or health educator, or a diabetes self-management training session. |
| 95 | `first_e11_date` | date | Diagnosis dates | rule_builder_field_group:Health; rule_trigger:Trig10 | Earliest claim billed for type 2 diabetes since January 2024 (not the true onset date). |
| 96 | `first_htn_date` | date | Diagnosis dates | rule_builder_field_group:Health; rule_trigger:Trig10 | Earliest claim billed for hypertension since January 2024. |
| 97 | `first_dyslipidemia_date` | date | Diagnosis dates | rule_builder_field_group:Health; rule_risk_band:M | Earliest claim billed for high cholesterol or another lipid disorder since January 2024. |
| 98 | `flag_ckd` | flag | Conditions and complications |  | 1 if chronic kidney disease (N18, any stage) was billed on any claim since January 2024. |
| 99 | `last_ckd_date` | date | Conditions and complications |  | Latest claim for chronic kidney disease (N18, any stage). |
| 100 | `flag_hypertensive_kidney_disease` | flag | Conditions and complications |  | 1 if kidney disease caused by high blood pressure was billed on any claim since January 2024. |
| 101 | `last_hypertensive_kidney_disease_date` | date | Conditions and complications |  | Latest claim for kidney disease caused by high blood pressure. |
| 102 | `flag_kidney_failure` | flag | Conditions and complications |  | 1 if end-stage kidney disease or dependence on dialysis was billed on any claim since January 2024. |
| 103 | `last_kidney_failure_date` | date | Conditions and complications |  | Latest claim for end-stage kidney disease or dependence on dialysis. |
| 104 | `flag_acute_kidney_injury` | flag | Conditions and complications |  | 1 if a sudden loss of kidney function (acute kidney injury) was billed on any claim since January 2024. |
| 105 | `last_acute_kidney_injury_date` | date | Conditions and complications |  | Latest claim for a sudden loss of kidney function (acute kidney injury). |
| 106 | `flag_any_kidney_disease` | flag | Conditions and complications |  | 1 if any chronic, hypertensive or diabetic kidney disease, or kidney failure was billed on any claim since January 2024. |
| 107 | `last_any_kidney_disease_date` | date | Conditions and complications |  | Latest claim for any chronic, hypertensive or diabetic kidney disease, or kidney failure. |
| 108 | `flag_dialysis` | flag | Conditions and complications |  | 1 if a dialysis session or dialysis dependence was billed on any claim since January 2024. |
| 109 | `last_dialysis_date` | date | Conditions and complications |  | Latest claim for a dialysis session or dialysis dependence. |
| 110 | `flag_stroke` | flag | Conditions and complications |  | 1 if stroke, including its after-effects was billed on any claim since January 2024. |
| 111 | `last_stroke_date` | date | Conditions and complications |  | Latest claim for stroke, including its after-effects. |
| 112 | `flag_heart_failure` | flag | Conditions and complications |  | 1 if heart failure was billed on any claim since January 2024. |
| 113 | `last_heart_failure_date` | date | Conditions and complications |  | Latest claim for heart failure. |
| 114 | `flag_mi` | flag | Conditions and complications |  | 1 if a heart attack, recent or past was billed on any claim since January 2024. |
| 115 | `last_mi_date` | date | Conditions and complications |  | Latest claim for a heart attack, recent or past. |
| 116 | `flag_other_cvd` | flag | Conditions and complications |  | 1 if other heart and blood-vessel disease (angina, valve disease, irregular heartbeat, artery disease, mini-stroke, cardiac devices) was billed on any claim sin |
| 117 | `last_other_cvd_date` | date | Conditions and complications |  | Latest claim for other heart and blood-vessel disease (angina, valve disease, irregular heartbeat, artery disease, mini-stroke, cardiac devices). |
| 118 | `dm_complications` | text | Conditions and complications | rule_builder_field_group:Health; rule_risk_band:M | List of the diabetes complications the member has, for example 'Kidney, Neuropathy, Diabetic foot'. |
| 119 | `dm_complication_count` | num | Conditions and complications | rule_builder_field_group:Health; rule_risk_band:M | Number of the nine complications below the member has (kidney, eye, neuropathy, circulation, foot, amputation, hypoglycaemia, hyperglycaemic crisis, sepsis). |
| 120 | `flag_dm_kidney` | flag | Conditions and complications |  | 1 if diabetic kidney disease was billed on any claim since January 2024. |
| 121 | `last_dm_kidney_date` | date | Conditions and complications |  | Latest claim for diabetic kidney disease. |
| 122 | `flag_dm_eye` | flag | Conditions and complications |  | 1 if a type 2 diabetes eye complication (E11.3x: retinopathy at any stage, macular oedema, diabetic cataract, other) was billed on any claim since January 2024. |
| 123 | `last_dm_eye_date` | date | Conditions and complications |  | Latest claim for a type 2 diabetes eye complication (E11.3x). |
| 124 | `flag_dm_neuropathy` | flag | Conditions and complications |  | 1 if diabetic nerve damage was billed on any claim since January 2024. |
| 125 | `last_dm_neuropathy_date` | date | Conditions and complications |  | Latest claim for diabetic nerve damage. |
| 126 | `flag_dm_circulatory` | flag | Conditions and complications |  | 1 if poor blood flow to the legs caused by diabetes was billed on any claim since January 2024. |
| 127 | `last_dm_circulatory_date` | date | Conditions and complications |  | Latest claim for poor blood flow to the legs caused by diabetes. |
| 128 | `flag_dm_foot` | flag | Conditions and complications |  | 1 if diabetic foot (foot ulcer, Charcot foot, peripheral artery disease with or without gangrene, foot bone infection) was billed on any claim since January 202 |
| 129 | `last_dm_foot_date` | date | Conditions and complications |  | Latest claim for diabetic foot (foot ulcer, Charcot foot, peripheral artery disease with or without gangrene, foot bone infection). |
| 130 | `flag_amputation` | flag | Conditions and complications |  | 1 if loss of a toe, foot or leg, or an amputation procedure was billed on any claim since January 2024. |
| 131 | `last_amputation_date` | date | Conditions and complications |  | Latest claim for loss of a toe, foot or leg, or an amputation procedure. |
| 132 | `flag_dm_hypoglycaemia` | flag | Conditions and complications |  | 1 if a low-blood-sugar episode (E11.64x or E16.0-E16.2) was billed on any claim since January 2024. |
| 133 | `last_dm_hypoglycaemia_date` | date | Conditions and complications |  | Latest claim for a low-blood-sugar episode (E11.64x or E16.0-E16.2). |
| 134 | `flag_dm_hyperglycaemic_crisis` | flag | Conditions and complications |  | 1 if dangerously high blood sugar (ketoacidosis or hyperosmolar state) was billed on any claim since January 2024. |
| 135 | `last_dm_hyperglycaemic_crisis_date` | date | Conditions and complications |  | Latest claim for dangerously high blood sugar (ketoacidosis or hyperosmolar state). |
| 136 | `flag_sepsis` | flag | Conditions and complications |  | 1 if sepsis (severe body-wide infection) was billed on any claim since January 2024. |
| 137 | `last_sepsis_date` | date | Conditions and complications |  | Latest claim for sepsis (severe body-wide infection). |
| 138 | `flag_ischemic_heart_disease` | flag | Conditions and complications |  | 1 if ischaemic heart disease (I20-I25: angina, heart attack, chronic ischaemic heart disease) was billed on any claim since January 2024. |
| 139 | `last_ischemic_heart_disease_date` | date | Conditions and complications |  | Latest claim for ischaemic heart disease (I20-I25: angina, heart attack, chronic ischaemic heart disease). |
| 140 | `flag_dm_hypoglycaemia_last90days` | flag | Conditions and complications | rule_risk_band:C; rule_trigger:Trig3 | 1 if there was a hypoglycaemia claim (E11.64x or E16.0-E16.2) in the last 90 days. |
| 141 | `flag_EDorIP_with_hypoglycaemia_last90days` | flag | Conditions and complications | rule_safety_flag:safety; rule_trigger:Trig3 | 1 if there was an emergency visit or hospital stay for hypoglycaemia in the last 90 days. |
| 142 | `flag_hypo_hyper_glycemia_last6months` | flag | Conditions and complications | rule_trigger:Trig3 | 1 if there was a hypoglycaemia, hyperglycaemic crisis or 'diabetes with hyperglycaemia' (E11.65) claim in the last 6 months. |
| 143 | `flag_oncology_l12m` | flag | Exclusions and gates | rule_guardrail:G1c | 1 if any claim in the last 12 months (Nov 2025 to Oct 2026) was for cancer (including leukaemia, lymphoma, myeloma), early or uncertain tumours, or a chemothera |
| 144 | `flag_oncology_l24m` | flag | Exclusions and gates | rule_guardrail:G1c | 1 if any claim in the last 24 months (Nov 2024 to Oct 2026) was for cancer (including leukaemia, lymphoma, myeloma), early or uncertain tumours, or a chemothera |
| 145 | `last_oncology_claim_date` | date | Conditions and complications |  | Latest cancer claim since January 2024. |
| 146 | `oncology_dx_codes` | text | Exclusions and gates |  | Cancer diagnosis codes billed since January 2024. |
| 147 | `flag_benign_neoplasm_l12m` | flag | Exclusions and gates |  | 1 if any claim in the last 12 months (Nov 2025 to Oct 2026) was for a non-cancerous growth (fibroids, polyps, lipomas, benign brain tumours). |
| 148 | `flag_excl_palliative_hospice_ltc_l12m` | flag | Exclusions and gates | rule_guardrail:G1c | 1 if palliative or hospice care, or a stay in a long-term care facility, in the last 12 months (Nov 2025 to Oct 2026): palliative care encounter (Z51.5), hospic |
| 149 | `excl_palliative_hospice_ltc_reason` | text | Exclusions and gates |  | Which part applied: 'Palliative / hospice', 'Long-term care facility', or both. |
| 150 | `flag_dialysis_l12m` | flag | Conditions and complications | rule_guardrail:G1c; rule_risk_band:K | 1 if a dialysis session or dialysis dependence was billed in the last 12 months (Nov 2025 to Oct 2026) (same definition as flag_dialysis, which looks back to Ja |
| 151 | `flag_av_access_procedure_l12m` | flag | Exclusions and gates |  | 1 if an AV access procedure for haemodialysis was billed in the last 12 months (Nov 2025 to Oct 2026): fistula or graft creation / revision (CPT 36800-36838), d |
| 152 | `last_av_access_date_l12m` | date | Exclusions and gates |  | Date of the latest AV access procedure in the last 12 months. |
| 153 | `flag_excl_transplant_l24m` | flag | Exclusions and gates | rule_guardrail:G1c | 1 if an organ transplant, transplant complication or aftercare, or anti-rejection therapy in the last 24 months (Nov 2024 to Oct 2026), or on a transplant waiti |
| 154 | `excl_transplant_reason` | text | Exclusions and gates |  | Which part applied: 'Transplant', 'Anti-rejection therapy', 'Transplant waiting list'. |
| 155 | `flag_excl_adv_neuro_congenital_l12m` | flag | Exclusions and gates | rule_guardrail:G1c | 1 if any of these in the last 12 months (Nov 2025 to Oct 2026): advanced Parkinson's (motor fluctuations, inpatient stay, deep brain stimulation or infusion the |
| 156 | `excl_adv_neuro_congenital_reason` | text | Exclusions and gates |  | Which conditions applied, for example 'ALS / MND, Late-stage MS'. |
| 157 | `flag_excl_psych_sud_dementia_l12m` | flag | Exclusions and gates | rule_guardrail:G1c | 1 if any of these in the last 12 months (Nov 2025 to Oct 2026): a psychiatric inpatient stay, an active substance use disorder (F10-F19 except nicotine and 'in  |
| 158 | `excl_psych_sud_dementia_reason` | text | Exclusions and gates |  | Which conditions applied: 'Psychiatric inpatient stay', 'Active substance use disorder', 'Advanced dementia'. |
| 159 | `flag_excl_ventilator_tpn_homenursing_l12m` | flag | Exclusions and gates | rule_guardrail:G1c | 1 if ventilator dependence, home / outpatient parenteral nutrition (TPN), or 24-hour home nursing in the last 12 months (Nov 2025 to Oct 2026). 24-hour home nur |
| 160 | `excl_ventilator_tpn_homenursing_reason` | text | Exclusions and gates |  | Which part applied, for example 'TPN, Home nursing (120 days)'. |
| 161 | `home_nursing_days_l12m` | num | Exclusions and gates | rule_guardrail:G1c | Number of different days with home nursing billed in the last 12 months. |
| 162 | `flag_excl_pregnant_postpartum` | flag | Exclusions and gates | rule_guardrail:G1c | 1 if pregnancy care was billed in the last 12 months, or a pregnancy ended (delivery, miscarriage, termination) in the last 12 months. |
| 163 | `excl_pregnancy_status` | text | Exclusions and gates |  | 'Pregnant' (antenatal claim in the last 10 months with no later pregnancy end), 'Post-partum (pregnancy ended <date>)', or 'Pregnancy in last 12 months, outcome |
| 164 | `max_episode_share_since2024` | share | Exclusions and gates |  | Share of everything Daman paid for the member since January 2024 that comes from their single most expensive episode of care (0-1). Above 0.60 sets flag_excl_si |
| 165 | `max_episode_type` | text | Exclusions and gates |  |  |
| 166 | `max_episode_dmhtn_related` | num | Exclusions and gates |  |  |
| 167 | `flag_excl_single_episode_gt60pct` | flag | Exclusions and gates | rule_guardrail:G1c | 1 if one episode accounts for more than 60% of the member's payable since January 2024 (an acute, one-off cost rather than chronic). |
| 168 | `specialty_rx_share_since2024` | share | Exclusions and gates |  | Share of everything Daman paid for the member since January 2024 that went on specialty medicines (MS, haemophilia, HIV, PAH, cystic fibrosis, enzyme replacemen |
| 169 | `flag_excl_specialty_rx_gt60pct` | flag | Exclusions and gates | rule_guardrail:G1c | 1 if specialty medicines account for more than 60% of the member's payable since January 2024. |
| 170 | `specialty_rx_areas` | text | Exclusions and gates |  | Therapy areas of the specialty medicines billed, for example 'MS, Immunology biologic'. |
| 171 | `gp_claims_6m` | num | Visits and admissions | rule_builder_field_group:Visits & admissions | Number of clinic consultations with a GP or family physician in the last 6 months (emergency visits excluded). |
| 172 | `specialist_claims_6m` | num | Visits and admissions | rule_builder_field_group:Visits & admissions | Number of clinic consultations with a specialist or consultant in the last 6 months (emergency, anaesthesia and intensive care excluded). |
| 173 | `last_ip_admit_date` | date | Conditions and complications | rule_trigger:Trig4 | Admission date of the latest hospital stay. |
| 174 | `last_ip_discharge_date` | date | Conditions and complications | rule_trigger:Trig4 | Discharge date of the latest hospital stay. |
| 175 | `second_last_ip_discharge_date` | date | Visits and admissions | rule_trigger:Trig4 | Discharge date of the stay before that; two close together suggest a readmission. |
| 176 | `last_ip_facility` | text | Visits and admissions | rule_event_type:MEMBER_FEATURE | Hospital of the latest stay. |
| 177 | `last_ip_dx` | text | Visits and admissions | rule_event_type:MEMBER_FEATURE | Main diagnosis code of the latest stay. |
| 178 | `last_ip_dx_desc` | text | Visits and admissions | rule_event_type:MEMBER_FEATURE | Main diagnosis description of the latest stay. |
| 179 | `last_ip_drg_desc` | text | Visits and admissions | rule_event_type:MEMBER_FEATURE | DRG (hospital payment group) description of the latest stay: what the stay was for. |
| 180 | `last_ip_discharge_type` | text | Visits and admissions | rule_trigger:Trig4 | How the latest stay ended, for example routine discharge or transfer. |
| 181 | `last_visit_date` | date | Conditions and complications | rule_builder_field_group:Visits & admissions | Latest clinic consultation of any kind. |
| 182 | `first_visit_after_discharge` | date | Visits and admissions | rule_trigger:Trig4 | First clinic consultation after the latest discharge (emergency visits do not count). |
| 183 | `days_discharge_to_first_visit` | num | Visits and admissions | rule_trigger:Trig4 | Days between the latest discharge and that first clinic visit. |
| 184 | `flag_no_visit_after_discharge` | flag | Conditions and complications | rule_trigger:Trig4 | 1 if discharged and no clinic visit since. A very recent discharge may not have had time yet. |
| 185 | `flag_missing_T2Drefill_post_last_discharge` | flag | Conditions and complications | rule_trigger:Trig4 | 1 if a diabetes medicine filled in the 6 months before the last admission was not refilled within 30 days of discharge (checked once 30 days have passed). |
| 186 | `flag_missing_HTNrefill_post_last_discharge` | flag | Conditions and complications | rule_trigger:Trig4 | The same for blood-pressure medicines. |
| 187 | `last_ed_visit_date` | date | Conditions and complications | rule_trigger:Trig4 | Date of the latest emergency visit since January 2024. |
| 188 | `last_ed_facility` | text | Visits and admissions | rule_event_type:MEMBER_FEATURE | Where the latest emergency visit was. |
| 189 | `last_ed_dx` | text | Visits and admissions | rule_event_type:MEMBER_FEATURE | Main diagnosis code of the latest emergency visit. |
| 190 | `last_ed_dx_desc` | text | Visits and admissions | rule_event_type:MEMBER_FEATURE | Main diagnosis description of the latest emergency visit. |
| 191 | `active_drug_class_count` | num | Medicines and adherence | rule_builder_field_group:Medicines; rule_trigger:Trig9 | Number of diabetes and blood-pressure medicine classes the member still has supply of on the as-of date (30-day grace). |
| 192 | `active_drug_classes` | text | Medicines and adherence | rule_builder_field_group:Medicines | Those active classes, for example 'ARB, DPP4, METFORMIN'. |
| 193 | `flag_active_ACEinhibitor` | flag | Conditions and complications | rule_trigger:Trig2; rule_trigger:Trig7 | 1 if an ACE inhibitor is active. |
| 194 | `flag_active_ARBinhibitor` | flag | Conditions and complications | rule_trigger:Trig2; rule_trigger:Trig7 | 1 if an ARB is active. |
| 195 | `flag_active_insulin` | flag | Conditions and complications | rule_trigger:Trig3 | 1 if insulin is active. |
| 196 | `flag_active_sulfonylurea` | flag | Conditions and complications | rule_trigger:Trig3 | 1 if a sulfonylurea is active. |
| 197 | `flag_overlap_ACE_ARB_more_than_30days` | flag | Conditions and complications | rule_trigger:Trig2 | 1 if ACE inhibitor and ARB supplies overlapped by more than 30 days in total in the last 365 days. |
| 198 | `flag_glucagon_last12months` | flag | Conditions and complications | rule_trigger:Trig3 | 1 if rescue glucagon (emergency kit for severe low sugar) was dispensed in the last 365 days. |
| 199 | `flag_no_glucagon_last12months` | flag | Conditions and complications | rule_trigger:Trig3 | 1 if no rescue glucagon in the last 365 days although the member is on insulin, or on a sulfonylurea with a past hypoglycaemia claim. |
| 200 | `distinct_medicines_90d` | num | Medicines and adherence | rule_builder_field_group:Medicines | Number of different medicines (all therapy areas) filled in the last 90 days; a high number points to polypharmacy. |
| 201 | `t2d_drug_classes_l12m` | text | Medicines and adherence | rule_builder_field_group:Medicines | Every diabetes medicine class filled at least once in the last 12 months (Nov 2025 to Oct 2026), including ones since stopped. |
| 202 | `pdc_metformin` | share | Medicines and adherence | rule_trigger:Trig9 | Adherence to metformin: share of days, from the first fill in the last 365 days to the as-of date, with supply at home (0-1; 0.80+ is the usual target). Needs a |
| 203 | `pdc_sglt2` | share | Medicines and adherence | rule_trigger:Trig9 | Adherence to SGLT2 inhibitors: share of days, from the first fill in the last 365 days to the as-of date, with supply at home (0-1; 0.80+ is the usual target).  |
| 204 | `pdc_dpp4` | share | Medicines and adherence | rule_trigger:Trig9 | Adherence to DPP-4 inhibitors: share of days, from the first fill in the last 365 days to the as-of date, with supply at home (0-1; 0.80+ is the usual target).  |
| 205 | `pdc_glp1` | share | Medicines and adherence | rule_trigger:Trig9 | Adherence to GLP-1 / GIP medicines: share of days, from the first fill in the last 365 days to the as-of date, with supply at home (0-1; 0.80+ is the usual targ |
| 206 | `pdc_sulfonylurea` | share | Medicines and adherence | rule_trigger:Trig9 | Adherence to sulfonylureas: share of days, from the first fill in the last 365 days to the as-of date, with supply at home (0-1; 0.80+ is the usual target). Nee |
| 207 | `pdc_tzd` | share | Medicines and adherence | rule_trigger:Trig9 | Adherence to TZDs (pioglitazone): share of days, from the first fill in the last 365 days to the as-of date, with supply at home (0-1; 0.80+ is the usual target |
| 208 | `pdc_any_t2d_noninsulin` | share | Medicines and adherence | rule_alert:AMBER; rule_trigger:Trig9 | Adherence to any non-insulin diabetes medicine (covered if any of them is at home): share of days, from the first fill in the last 365 days to the as-of date, w |
| 209 | `first_t2d_fill_date` | date | Medicines and adherence |  | First diabetes medicine fill since January 2024. |
| 210 | `latest_new_t2d_class_start_date` | date | Medicines and adherence | rule_trigger:Trig10 | First fill of the most recently started diabetes medicine class. |
| 211 | `last_t2d_fill_date` | date | Conditions and complications | rule_trigger:Trig9 | Latest diabetes medicine fill. |
| 212 | `days_since_last_t2d_fill` | num | Medicines and adherence |  | Days from the latest diabetes medicine fill to the as-of date. |
| 213 | `days_since_t2d_supply_ran_out` | num | Medicines and adherence | rule_trigger:Trig9 | Days since the latest diabetes supply would have run out; negative means supply is still at home. |
| 214 | `flag_t2d_rx_gap_over_30d` | flag | Conditions and complications | rule_trigger:Trig9 | 1 if the diabetes supply ran out more than 30 days ago. |
| 215 | `htn_drug_classes_l12m` | text | Medicines and adherence | rule_builder_field_group:Medicines; rule_trigger:Trig2; rule_trigger:Trig7 | Every blood-pressure medicine class filled at least once in the last 12 months (Nov 2025 to Oct 2026), including ones since stopped. |
| 216 | `pdc_acei` | share | Medicines and adherence | rule_trigger:Trig9 | Adherence to ACE inhibitors: share of days, from the first fill in the last 365 days to the as-of date, with supply at home (0-1; 0.80+ is the usual target). Ne |
| 217 | `pdc_arb` | share | Medicines and adherence | rule_trigger:Trig9 | Adherence to ARBs: share of days, from the first fill in the last 365 days to the as-of date, with supply at home (0-1; 0.80+ is the usual target). Needs at lea |
| 218 | `pdc_ccb` | share | Medicines and adherence | rule_trigger:Trig9 | Adherence to calcium-channel blockers: share of days, from the first fill in the last 365 days to the as-of date, with supply at home (0-1; 0.80+ is the usual t |
| 219 | `pdc_beta_blocker` | share | Medicines and adherence | rule_trigger:Trig9 | Adherence to beta blockers: share of days, from the first fill in the last 365 days to the as-of date, with supply at home (0-1; 0.80+ is the usual target). Nee |
| 220 | `pdc_thiazide` | share | Medicines and adherence | rule_trigger:Trig7; rule_trigger:Trig9 | Adherence to thiazide diuretics: share of days, from the first fill in the last 365 days to the as-of date, with supply at home (0-1; 0.80+ is the usual target) |
| 221 | `pdc_mra` | share | Medicines and adherence | rule_trigger:Trig7; rule_trigger:Trig9 | Adherence to MRAs (spironolactone type): share of days, from the first fill in the last 365 days to the as-of date, with supply at home (0-1; 0.80+ is the usual |
| 222 | `pdc_any_htn` | share | Medicines and adherence | rule_alert:AMBER; rule_trigger:Trig9 | Adherence to any blood-pressure medicine: share of days, from the first fill in the last 365 days to the as-of date, with supply at home (0-1; 0.80+ is the usua |
| 223 | `first_htn_fill_date` | date | Medicines and adherence |  | First blood-pressure medicine fill since January 2024. |
| 224 | `latest_new_htn_class_start_date` | date | Medicines and adherence | rule_trigger:Trig10 | First fill of the most recently started blood-pressure medicine class. |
| 225 | `first_ACE_ARB_MRA_thiazide_fill_date` | date | Medicines and adherence | rule_trigger:Trig7 | First fill of the most recently started ACE inhibitor, ARB, MRA or thiazide class (kidney and potassium check due 7-14 days after). |
| 226 | `last_htn_fill_date` | date | Conditions and complications | rule_trigger:Trig9 | Latest blood-pressure medicine fill. |
| 227 | `days_since_last_htn_fill` | num | Medicines and adherence |  | Days from the latest blood-pressure medicine fill to the as-of date. |
| 228 | `days_since_htn_supply_ran_out` | num | Medicines and adherence | rule_trigger:Trig9 | Days since the latest blood-pressure supply would have run out; negative means supply is still at home. |
| 229 | `flag_htn_rx_gap_over_30d` | flag | Conditions and complications | rule_trigger:Trig9 | 1 if the blood-pressure supply ran out more than 30 days ago. |
| 230 | `er_visits_6m` | num | Visits and admissions | rule_builder_field_group:Visits & admissions; rule_risk_band:U; rule_trigger:Trig4 | Emergency visits in the last 6 months (several claims on one day count once). |
| 231 | `ip_admissions_6m` | num | Visits and admissions | rule_builder_field_group:Visits & admissions; rule_risk_band:U | Hospital admissions in the last 6 months (one per hospital and admission date). |
| 232 | `ed_visits_l12m` | num | Visits and admissions | rule_builder_field_group:Visits & admissions; rule_risk_band:U; rule_trigger:Trig4 | Emergency visits in the last 12 months (Nov 2025 to Oct 2026). |
| 233 | `ip_admissions_l12m` | num | Visits and admissions | rule_builder_field_group:Visits & admissions; rule_risk_band:U | Hospital admissions in the last 12 months (Nov 2025 to Oct 2026). |
| 234 | `l12m_payable_allcause` | num | Cost and network | rule_builder_field_group:Other |  |
| 235 | `l12m_payable_T2D` | num | Cost and network |  | Paid on claim lines whose diagnosis is type 2 diabetes (E11), AED. |
| 236 | `l12m_payable_non_phg_T2D` | num | Cost and network |  | Diabetes payable paid outside PHG, AED. |
| 237 | `l12m_share_non_phg_T2D` | share | Cost and network |  | Share of diabetes payable paid outside PHG (0-1). |
| 238 | `l12m_payable_HTN` | num | Cost and network |  | Paid on claim lines whose diagnosis is hypertension (I10), AED. |
| 239 | `l12m_payable_non_phg_HTN` | num | Cost and network |  | Hypertension payable paid outside PHG, AED. |
| 240 | `l12m_share_non_phg_HTN` | share | Cost and network |  | Share of hypertension payable paid outside PHG (0-1). |
| 241 | `encounters_l12m` | num | Visits and admissions | rule_builder_field_group:Visits & admissions | Number of encounters (Daman episodes of care) in the last 12 months (Nov 2025 to Oct 2026). |
| 242 | `encounters_l12m_op` | num | Visits and admissions | rule_builder_field_group:Visits & admissions | Encounters that were outpatient only. OP + ED + IP = encounters_l12m. |
| 243 | `encounters_l12m_ed` | num | Visits and admissions | rule_builder_field_group:Visits & admissions | Encounters with an emergency visit (and no hospital stay). |
| 244 | `encounters_l12m_ip` | num | Visits and admissions | rule_builder_field_group:Visits & admissions | Encounters that include a hospital stay. |
| 245 | `providers_l12m` | num | Cost and network |  | Number of different providers used (owner group, or facility when it has no group); pharmacies count. |
| 246 | `phg_share_l12m_encounters` | share | Visits and admissions | rule_builder_field_group:Other | Share of encounters at PHG (SEHA, SSMC) (0-1). Each encounter is credited to one provider; the six add up to 1. |
| 247 | `mediclinic_share_l12m_encounters` | share | Visits and admissions |  | Share of encounters at Mediclinic (0-1). Each encounter is credited to one provider; the six add up to 1. |
| 248 | `nmc_share_l12m_encounters` | share | Visits and admissions |  | Share of encounters at NMC (0-1). Each encounter is credited to one provider; the six add up to 1. |
| 249 | `burjeel_share_l12m_encounters` | share | Visits and admissions |  | Share of encounters at Burjeel (0-1). Each encounter is credited to one provider; the six add up to 1. |
| 250 | `mubadala_share_l12m_encounters` | share | Visits and admissions |  | Share of encounters at Mubadala (0-1). Each encounter is credited to one provider; the six add up to 1. |
| 251 | `others_share_l12m_encounters` | share | Visits and admissions |  | Share of encounters at all other providers (0-1). Each encounter is credited to one provider; the six add up to 1. |
| 252 | `top_groupownerlevel_l12m_encounters` | text | Visits and admissions |  | Provider with the most encounters in the last 12 months (Nov 2025 to Oct 2026). |
| 253 | `top_groupownerlevel_l12m_encounter_share` | share | Visits and admissions |  | That provider's share of encounters (0-1). |
| 254 | `top_groupownerlevel_l12m_op_encounters` | text | Visits and admissions |  | Provider with the most outpatient encounters in the last 12 months (Nov 2025 to Oct 2026). |
| 255 | `top_groupownerlevel_l12m_op_encounter_share` | share | Visits and admissions |  | That provider's share of encounters_l12m_op (0-1). |
| 256 | `encounters_l12m_op_consultations` | num | Visits and admissions |  |  |
| 257 | `top_groupownerlevel_l12m_op_encounter_consultations_share` | share | Visits and admissions |  |  |
| 258 | `top_groupownerlevel_l12m_op_consultations` | text | Cost and network |  |  |
| 259 | `l12m_payable_op` | num | Cost and network |  |  |
| 260 | `l12m_payable_ip` | num | Cost and network |  |  |
| 261 | `l12m_payable_ed` | num | Cost and network |  |  |
| 262 | `l12m_payable_T2D_op` | num | Cost and network |  | Diabetes payable, outpatient (excluding emergency). |
| 263 | `l12m_payable_T2D_ip` | num | Cost and network |  | Diabetes payable, inpatient. |
| 264 | `l12m_payable_T2D_ed` | num | Cost and network |  | Diabetes payable, emergency. |
| 265 | `l12m_payable_HTN_op` | num | Cost and network |  | Hypertension payable, outpatient (excluding emergency). |
| 266 | `l12m_payable_HTN_ip` | num | Cost and network |  | Hypertension payable, inpatient. |
| 267 | `l12m_payable_HTN_ed` | num | Cost and network |  | Hypertension payable, emergency. |
| 268 | `l12m_drugs_payable` | num | Medicines and adherence |  |  |
| 269 | `l12m_consultation_payable` | num | Cost and network |  |  |
| 270 | `l12m_labandpath_payable` | num | Cost and network |  |  |
| 271 | `l12m_DRG_payable` | num | Cost and network |  |  |
| 272 | `l12m_procedures_payable` | num | Cost and network |  |  |
| 273 | `l12m_others_payable` | num | Cost and network |  |  |
| 274 | `l12m_T2D_drugs_payable` | num | Medicines and adherence |  | Diabetes payable in the last 12 months (Nov 2025 to Oct 2026) for medicines, AED. The six blocks add up to l12m_payable_T2D. |
| 275 | `l12m_T2D_consultation_payable` | num | Cost and network |  | Diabetes payable in the last 12 months (Nov 2025 to Oct 2026) for doctor consultations, AED. The six blocks add up to l12m_payable_T2D. |
| 276 | `l12m_T2D_labandpath_payable` | num | Cost and network |  | Diabetes payable in the last 12 months (Nov 2025 to Oct 2026) for lab and pathology tests, AED. The six blocks add up to l12m_payable_T2D. |
| 277 | `l12m_T2D_DRG_payable` | num | Cost and network |  | Diabetes payable in the last 12 months (Nov 2025 to Oct 2026) for hospital stays paid as a DRG package, AED. The six blocks add up to l12m_payable_T2D. |
| 278 | `l12m_T2D_procedures_payable` | num | Cost and network |  | Diabetes payable in the last 12 months (Nov 2025 to Oct 2026) for procedures and surgery, AED. The six blocks add up to l12m_payable_T2D. |
| 279 | `l12m_T2D_others_payable` | num | Cost and network |  | Diabetes payable in the last 12 months (Nov 2025 to Oct 2026) for everything else (radiology, consumables, physiotherapy, dental, per-diem), AED. The six blocks |
| 280 | `l12m_HTN_drugs_payable` | num | Medicines and adherence |  | Hypertension payable in the last 12 months (Nov 2025 to Oct 2026) for medicines, AED. The six blocks add up to l12m_payable_HTN. |
| 281 | `l12m_HTN_consultation_payable` | num | Cost and network |  | Hypertension payable in the last 12 months (Nov 2025 to Oct 2026) for doctor consultations, AED. The six blocks add up to l12m_payable_HTN. |
| 282 | `l12m_HTN_labandpath_payable` | num | Cost and network |  | Hypertension payable in the last 12 months (Nov 2025 to Oct 2026) for lab and pathology tests, AED. The six blocks add up to l12m_payable_HTN. |
| 283 | `l12m_HTN_DRG_payable` | num | Cost and network |  | Hypertension payable in the last 12 months (Nov 2025 to Oct 2026) for hospital stays paid as a DRG package, AED. The six blocks add up to l12m_payable_HTN. |
| 284 | `l12m_HTN_procedures_payable` | num | Cost and network |  | Hypertension payable in the last 12 months (Nov 2025 to Oct 2026) for procedures and surgery, AED. The six blocks add up to l12m_payable_HTN. |
| 285 | `l12m_HTN_others_payable` | num | Cost and network |  | Hypertension payable in the last 12 months (Nov 2025 to Oct 2026) for everything else (radiology, consumables, physiotherapy, dental, per-diem), AED. The six bl |
| 286 | `last_claim_date` | date | Conditions and complications | rule_event_type:MEMBER_FEATURE | Date of the latest claim of any kind (can be a pharmacy refill). |
| 287 | `last_claim_costblocks` | text | Last claim (display) | rule_event_type:MEMBER_FEATURE | Types of service billed on that date, for example 'Consultation, Drugs'. |
| 288 | `last_claim_facilities` | text | Last claim (display) | rule_event_type:MEMBER_FEATURE | Facilities that billed on that date. |
| 289 | `last_claim_specialties` | text | Last claim (display) | rule_event_type:MEMBER_FEATURE | Specialties of doctors consulted on that date. |
| 290 | `last_claim_dx_codes` | text | Last claim (display) | rule_event_type:MEMBER_FEATURE | Diagnosis codes billed on that date. |
| 291 | `last_claim_dx_desc` | text | Last claim (display) | rule_event_type:MEMBER_FEATURE | Diagnosis descriptions billed on that date. |
| 292 | `last_claim_medicines` | text | Medicines and adherence | rule_event_type:MEMBER_FEATURE | Medicines dispensed on that date. |
| 293 | `last_claim_activities` | text | Last claim (display) | rule_event_type:MEMBER_FEATURE | Services other than medicines billed on that date (code and short description). |
| 294 | `last_claim_payable` | num | Cost and network | rule_event_type:MEMBER_FEATURE | Total Daman paid for that date, AED. |
| 295 | `flag_current_smoker_l12m` | flag | Conditions and complications | rule_risk_band:M | 1 if current tobacco use was recorded in the last 12 months (Nov 2025 to Oct 2026): nicotine dependence (F17.2x, except 'in remission'), tobacco use (Z72.0), sm |
| 296 | `last_smoking_evidence_date` | date | Labs and readings | rule_risk_band:M | Latest date with any of the evidence above, from claims or observations, since January 2024. |
| 297 | `flag_former_smoker_code` | flag | Conditions and complications | rule_risk_band:M | 1 if a former-smoker code was billed on any claim since January 2024: history of nicotine dependence (Z87.891) or nicotine dependence 'in remission' (F17.201, F |
| 298 | `flag_ckd_l12m` | flag | Conditions and complications | rule_risk_band:K; rule_trigger:Trig2; rule_trigger:Trig5 | 1 if chronic kidney disease (N18, any stage) was billed in the last 12 months (Nov 2025 to Oct 2026). Same codes as flag_ckd, which looks back to January 2024. |
| 299 | `flag_hypertensive_kidney_disease_l12m` | flag | Conditions and complications |  | 1 if kidney disease caused by high blood pressure was billed in the last 12 months (Nov 2025 to Oct 2026). Same codes as flag_hypertensive_kidney_disease, which |
| 300 | `flag_kidney_failure_l12m` | flag | Conditions and complications | rule_risk_band:K | 1 if end-stage kidney disease or dependence on dialysis was billed in the last 12 months (Nov 2025 to Oct 2026). Same codes as flag_kidney_failure, which looks  |
| 301 | `flag_acute_kidney_injury_l12m` | flag | Conditions and complications |  | 1 if acute kidney injury was billed in the last 12 months (Nov 2025 to Oct 2026). Same codes as flag_acute_kidney_injury, which looks back to January 2024. |
| 302 | `flag_any_kidney_disease_l12m` | flag | Conditions and complications | rule_risk_band:K | 1 if any chronic, hypertensive or diabetic kidney disease, or kidney failure was billed in the last 12 months (Nov 2025 to Oct 2026). Same codes as flag_any_kid |
| 303 | `flag_stroke_l12m` | flag | Conditions and complications | rule_risk_band:M | 1 if stroke, including its after-effects was billed in the last 12 months (Nov 2025 to Oct 2026). Same codes as flag_stroke, which looks back to January 2024. |
| 304 | `flag_heart_failure_l12m` | flag | Conditions and complications | rule_risk_band:M | 1 if heart failure was billed in the last 12 months (Nov 2025 to Oct 2026). Same codes as flag_heart_failure, which looks back to January 2024. |
| 305 | `flag_mi_l12m` | flag | Conditions and complications | rule_risk_band:M | 1 if a heart attack, recent or past was billed in the last 12 months (Nov 2025 to Oct 2026). Same codes as flag_mi, which looks back to January 2024. |
| 306 | `flag_other_cvd_l12m` | flag | Conditions and complications |  | 1 if other heart and blood-vessel disease (angina, valve disease, irregular heartbeat, artery disease, mini-stroke, cardiac devices) was billed in the last 12 m |
| 307 | `flag_dm_kidney_l12m` | flag | Conditions and complications |  | 1 if diabetic kidney disease was billed in the last 12 months (Nov 2025 to Oct 2026). Same codes as flag_dm_kidney, which looks back to January 2024. |
| 308 | `flag_dm_eye_l12m` | flag | Conditions and complications | rule_risk_band:M | 1 if a type 2 diabetes eye complication (E11.3x: retinopathy, macular oedema, cataract, other) was billed in the last 12 months (Nov 2025 to Oct 2026). Same cod |
| 309 | `flag_dm_neuropathy_l12m` | flag | Conditions and complications | rule_risk_band:M | 1 if diabetic nerve damage (E11.4x) was billed in the last 12 months (Nov 2025 to Oct 2026). Same codes as flag_dm_neuropathy, which looks back to January 2024. |
| 310 | `flag_dm_circulatory_l12m` | flag | Conditions and complications | rule_risk_band:M | 1 if poor blood flow caused by diabetes (E11.5x) was billed in the last 12 months (Nov 2025 to Oct 2026). Same codes as flag_dm_circulatory, which looks back to |
| 311 | `flag_dm_foot_l12m` | flag | Conditions and complications | rule_risk_band:M; rule_trigger:Trig13 | 1 if diabetic foot (foot ulcer, Charcot foot, peripheral artery disease with or without gangrene, foot bone infection) was billed in the last 12 months (Nov 202 |
| 312 | `flag_amputation_l12m` | flag | Conditions and complications | rule_risk_band:M; rule_trigger:Trig13 | 1 if loss of a toe, foot or leg, or an amputation procedure was billed in the last 12 months (Nov 2025 to Oct 2026). Same codes as flag_amputation, which looks  |
| 313 | `flag_dm_hypoglycaemia_l12m` | flag | Conditions and complications | rule_alert:RED; rule_risk_band:C; rule_safety_flag:safety; rule_trigger:Trig3 | 1 if a low-blood-sugar episode (E11.64x or E16.0-E16.2) was billed in the last 12 months (Nov 2025 to Oct 2026). Same codes as flag_dm_hypoglycaemia, which look |
| 314 | `flag_dm_hyperglycaemic_crisis_l12m` | flag | Conditions and complications | rule_risk_band:C | 1 if dangerously high blood sugar (ketoacidosis or hyperosmolar state) was billed in the last 12 months (Nov 2025 to Oct 2026). Same codes as flag_dm_hyperglyca |
| 315 | `flag_sepsis_l12m` | flag | Conditions and complications |  | 1 if sepsis was billed in the last 12 months (Nov 2025 to Oct 2026). Same codes as flag_sepsis, which looks back to January 2024. |
| 316 | `flag_ischemic_heart_disease_l12m` | flag | Conditions and complications | rule_risk_band:M | 1 if ischaemic heart disease (I20-I25) was billed in the last 12 months (Nov 2025 to Oct 2026). Same codes as flag_ischemic_heart_disease, which looks back to J |
| 317 | `flag_dyslipidemia_l12m` | flag | Conditions and complications | rule_risk_band:M | 1 if high cholesterol or another lipid disorder was billed in the last 12 months (Nov 2025 to Oct 2026) (E78, except E78.6 and E78.7). |
| 318 | `flag_obesity` | flag | Conditions and complications | rule_risk_band:M | 1 if the latest measured BMI is 30 or more (any date), or an obesity code was billed in the last 12 months (E66 except E66.3 overweight; Z68.3x / Z68.4x = BMI 3 |
| 319 | `flag_cad_mi_l12m` | flag | Conditions and complications | rule_risk_band:M; rule_trigger:Trig2 | 1 if coronary artery disease or heart attack was billed in the last 12 months (Nov 2025 to Oct 2026): I20-I25, or coronary bypass / stent / angioplasty status ( |
| 320 | `flag_stroke_tia_l12m` | flag | Conditions and complications | rule_risk_band:M | 1 if stroke or TIA was billed in the last 12 months (Nov 2025 to Oct 2026): I60-I64, I69, G46, G45 (except G45.4), or history of TIA / cerebral infarction (Z86. |
| 321 | `flag_pad_l12m` | flag | Conditions and complications | rule_risk_band:M; rule_trigger:Trig13 | 1 if peripheral arterial disease was billed in the last 12 months (Nov 2025 to Oct 2026): diabetic peripheral angiopathy (E11.51, E11.52), atherosclerosis of li |
| 322 | `flag_dm_retinopathy_l12m` | flag | Conditions and complications | rule_risk_band:M | 1 if diabetic retinopathy was billed in the last 12 months (Nov 2025 to Oct 2026) (E11.31-E11.35, with or without macular oedema; cataract and other eye codes n |
| 323 | `flag_peripheral_neuropathy_l12m` | flag | Conditions and complications | rule_risk_band:M; rule_trigger:Trig13 | 1 if peripheral neuropathy was billed in the last 12 months (Nov 2025 to Oct 2026): diabetic neuropathy unspecified / polyneuropathy (E11.40, E11.42), polyneuro |
| 324 | `flag_dm_foot_ulcer_l12m` | flag | Conditions and complications | rule_risk_band:M; rule_trigger:Trig13 | 1 if a foot ulcer was billed in the last 12 months (Nov 2025 to Oct 2026): diabetic foot ulcer (E11.621) or a chronic ulcer of the heel, midfoot or other part o |
| 325 | `flag_major_amputation_l12m` | flag | Conditions and complications | rule_risk_band:M | 1 if a major (leg) amputation was billed in the last 12 months (Nov 2025 to Oct 2026): absence of leg below / above the knee (Z89.5, Z89.6), or below-knee, abov |
| 326 | `flag_dka_l12m` | flag | Conditions and complications | rule_alert:RED; rule_risk_band:C; rule_safety_flag:safety | 1 if diabetic ketoacidosis (E11.1x) was billed in the last 12 months (Nov 2025 to Oct 2026). |
| 327 | `Last_UACR_Value` | num | Labs and readings | rule_builder_field_group:Tests & results; rule_risk_band:K; rule_trigger:Trig5 | Latest urine albumin-to-creatinine ratio, mg/g (results in mg/mmol are converted: x 8.84). 30-299 = moderately raised, 300+ = severely raised. |
| 328 | `Last_UACR_Date` | date | Labs and readings | rule_risk_band:K; rule_trigger:Trig5 | Date of the latest UACR result. |
| 329 | `ckd_stage_l12m` | text | Conditions and complications | rule_risk_band:K; rule_trigger:Trig5 | Highest CKD stage coded in the last 12 months, in the risk calculator's wording: 'Stage 5 / kidney failure', 'Stage 4', 'Stage 3b', 'Stage 3a' (also when stage  |
| 330 | `l12m_payable_DiaborHTNrelated` | money | Cost and network | rule_builder_field_group:Other | Paid in the last 12 months (Nov 2025 to Oct 2026) on claim lines whose diagnosis is on the diabetes / hypertension list, AED. OP + IP + ED, the six cost types,  |
| 331 | `l12m_payable_DiaborHTNrelated_drugs_inside_network` | num | Medicines and adherence |  |  |
| 332 | `l12m_payable_DiaborHTNrelated_inside` | num | Cost and network | rule_builder_field_group:Other |  |
| 333 | `l12m_payable_DiaborHTNrelated_outside` | num | Cost and network | rule_builder_field_group:Other |  |
| 334 | `l12m_payable_DiaborHTNrelated_drugs_outside_network` | num | Medicines and adherence |  |  |
| 335 | `l12m_payable_DiaborHTNrelated_consultation_inside_network` | num | Cost and network |  |  |
| 336 | `l12m_payable_DiaborHTNrelated_consultation_outside_network` | num | Cost and network |  |  |
| 337 | `l12m_payable_DiaborHTNrelated_labandpath_inside_network` | num | Cost and network |  |  |
| 338 | `l12m_payable_DiaborHTNrelated_labandpath_outside_network` | num | Cost and network |  |  |
| 339 | `l12m_payable_DiaborHTNrelated_DRG_inside_network` | num | Cost and network |  |  |
| 340 | `l12m_payable_DiaborHTNrelated_DRG_outside_network` | num | Cost and network |  |  |
| 341 | `l12m_payable_DiaborHTNrelated_procedures_inside_network` | num | Cost and network |  |  |
| 342 | `l12m_payable_DiaborHTNrelated_procedures_outside_network` | num | Cost and network |  |  |
| 343 | `l12m_payable_DiaborHTNrelated_others_inside_network` | num | Cost and network |  |  |
| 344 | `l12m_payable_DiaborHTNrelated_others_outside_network` | num | Cost and network |  |  |
| 345 | `payable_last24months_DiaborHTNrelated` | money | Cost and network |  | Paid in the last 24 months (Nov 2024 to Oct 2026) on diabetes / hypertension related claim lines, AED (from the separate 24-month query, 'payable info' sheet). |
| 346 | `payable_since2024_DiaborHTNrelated` | money | Cost and network |  | Paid since January 2024 on diabetes / hypertension related claim lines, AED (from the separate query, 'payable info' sheet). |
| 347 | `l12m_payable_DiaborHTNrelated_op` | num | Cost and network |  | Related payable, outpatient (excluding emergency). |
| 348 | `l12m_payable_DiaborHTNrelated_ip` | num | Cost and network |  | Related payable, inpatient. |
| 349 | `l12m_payable_DiaborHTNrelated_ed` | num | Cost and network |  | Related payable, emergency. |
| 350 | `l12m_payable_DiaborHTNrelated_drugs` | num | Medicines and adherence |  | Related payable for medicines, AED. The six cost types add up to l12m_payable_DiaborHTNrelated. |
| 351 | `l12m_payable_DiaborHTNrelated_consultation` | num | Cost and network |  | Related payable for doctor consultations, AED. The six cost types add up to l12m_payable_DiaborHTNrelated. |
| 352 | `l12m_payable_DiaborHTNrelated_labandpath` | num | Cost and network |  | Related payable for lab and pathology tests, AED. The six cost types add up to l12m_payable_DiaborHTNrelated. |
| 353 | `l12m_payable_DiaborHTNrelated_DRG` | num | Cost and network |  | Related payable for hospital stays paid as a DRG package, AED. The six cost types add up to l12m_payable_DiaborHTNrelated. |
| 354 | `l12m_payable_DiaborHTNrelated_procedures` | num | Cost and network |  | Related payable for procedures and surgery, AED. The six cost types add up to l12m_payable_DiaborHTNrelated. |
| 355 | `l12m_payable_DiaborHTNrelated_others` | num | Cost and network |  | Related payable for everything else (radiology, consumables, physiotherapy, dental, per-diem), AED. The six cost types add up to l12m_payable_DiaborHTNrelated. |
| 356 | `l12m_payable_DiaborHTNrelated_PHG` | num | Cost and network |  | Related payable paid to PHG (SEHA, SSMC), AED. The six provider groups add up to l12m_payable_DiaborHTNrelated. |
| 357 | `l12m_payable_DiaborHTNrelated_Mediclinic` | num | Cost and network |  | Related payable paid to Mediclinic, AED. The six provider groups add up to l12m_payable_DiaborHTNrelated. |
| 358 | `l12m_payable_DiaborHTNrelated_NMC` | num | Cost and network |  | Related payable paid to NMC, AED. The six provider groups add up to l12m_payable_DiaborHTNrelated. |
| 359 | `l12m_payable_DiaborHTNrelated_Burjeel` | num | Cost and network |  | Related payable paid to Burjeel, AED. The six provider groups add up to l12m_payable_DiaborHTNrelated. |
| 360 | `l12m_payable_DiaborHTNrelated_Mubadala` | num | Cost and network |  | Related payable paid to Mubadala, AED. The six provider groups add up to l12m_payable_DiaborHTNrelated. |
| 361 | `l12m_payable_DiaborHTNrelated_OtherProviders` | num | Cost and network |  | Related payable paid to all other providers, AED. The six provider groups add up to l12m_payable_DiaborHTNrelated. |
| 362 | `l12m_encounters_DiaborHTNrelated` | num | Visits and admissions |  | Number of encounters (Daman episodes of care) in the last 12 months (Nov 2025 to Oct 2026) with at least one diabetes / hypertension related claim line. |
| 363 | `l12m_encounters_op_DiaborHTNrelated` | num | Visits and admissions |  | Related encounters that were outpatient only. OP + ED + IP = l12m_encounters_DiaborHTNrelated. |
| 364 | `l12m_encounters_ed_DiaborHTNrelated` | num | Visits and admissions |  | Related encounters with an emergency visit (and no hospital stay). |
| 365 | `l12m_encounters_ip_DiaborHTNrelated` | num | Visits and admissions |  | Related encounters that include a hospital stay. |
| 366 | `top_groupownerlevel_l12m_op_DiaborHTNrelated_encounters` | text | Visits and admissions |  | Provider (owner group, or facility when it has no group) with the most related outpatient encounters in the last 12 months. |
| 367 | `top_groupownerlevel_l12m_op_DiaborHTNrelated_encounter_share` | share | Visits and admissions |  | That provider's share of l12m_encounters_op_DiaborHTNrelated (0-1). |
| 368 | `providers_l12m_DiaborHTNrelated` | num | Cost and network |  | Number of different providers (owner group, or facility when it has no group) with a related claim line in the last 12 months. |
| 369 | `l12m_ED_visits_DiaborHTNrelated` | num | Visits and admissions |  | Emergency visits in the last 12 months (Nov 2025 to Oct 2026) with a related diagnosis, one per day; a visit followed the same or next day by a related admissio |
| 370 | `l12m_IP_admissions_DiaborHTNrelated` | num | Visits and admissions |  | Hospital admissions in the last 12 months (Nov 2025 to Oct 2026) with a related diagnosis (the admission's main diagnosis), planned or not; one per hospital and |
| 371 | `l12m_encounters_DiaborHTNrelated_PHG` | num | Visits and admissions |  |  |
| 372 | `l12m_encounters_DiaborHTNrelated_Mediclinic` | num | Visits and admissions |  |  |
| 373 | `l12m_encounters_DiaborHTNrelated_NMC` | num | Visits and admissions |  |  |
| 374 | `l12m_encounters_DiaborHTNrelated_Burjeel` | num | Visits and admissions |  |  |
| 375 | `l12m_encounters_DiaborHTNrelated_Mubadala` | num | Visits and admissions |  |  |
| 376 | `l12m_encounters_DiaborHTNrelated_OtherProviders` | num | Visits and admissions |  |  |
| 377 | `l12m_encounters_DiaborHTNrelated_total` | num | Visits and admissions |  |  |
