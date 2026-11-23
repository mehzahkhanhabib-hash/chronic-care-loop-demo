# Two-member demonstration guide

Both members are real masked members of the 250-member dataset. Values below were read from the seeded database by `node scripts/gen_demo_doc.js` (rule version DEMO-2026-11-20, run date 2026-11-20, extract as-of 2026-10-31). Names on the screens are pseudonyms; the masked id is the identity.

Reproduce: `npm run setup` (or `npm run reset` to return to this state), `npm run dev`, then open **Chronic Care Studio** http://localhost:3000 and **Care Coordinator Portal** http://localhost:3001 (login `omar` / PIN `1234`, or the nurse named below). Screenshots are in `docs/demo-scenarios/screenshots/`.

---

## Demo member 1 · Type 2 diabetes · `x2063`

Very high risk (tier 4) with HbA1c far above goal, a condition-related admission and seven fired triggers; twelve HbA1c results in the raw claims.

### Identity (longitudinal + crosswalk)

| | |
|---|---|
| Masked member id | `x2063` (same id in both Excel sources) |
| Display pseudonym | George Nair |
| Age / gender / nationality | 65 / M / INDIAN |
| Policy type | Group |
| Pathway | T2D (cohort_t2d_l12m = 1, cohort_htn_l12m = 0) |
| Persona (extract) | 1. Complications |

### Member 360 from raw claims (`GET /api/members/x2063/360`)

| | |
|---|---|
| Claims / activity lines | 113 / 459 (2024-01-11 → 2025-12-31) |
| Payable total | AED 51971 |
| Admissions (IP) / ED visits (all time) | 1 / 3 |
| Last 12 months to as-of | 31 claims, 1 admissions, 0 ED, AED 27762 |
| Chronic condition codes | E11.621, E11.9, E11.65, E11.3593, E78.5, E11.3553, E11.42, E11.3551 |
| Lab series (code · n · last) | BMI 39156-5 · 21 · 28.33 on 2025-11-01<br>HbA1c 4548-4 · 12 · 11.3 on 2025-12-05<br>Systolic BP 8480-6 · 5 · 119 on 2025-10-13<br>Diastolic BP 8462-4 · 5 · 61 on 2025-10-13<br>Cholesterol 14647-2 · 5 · 3.59 on 2025-10-12<br>Creatinine 14682-9 · 3 · 60 on 2025-09-16 |
| Medicines (most recent fills) | Hyalo4 Plus (3 fills, last 2025-12-31)<br>Liposic (2 fills, last 2025-12-27)<br>Vigamox (2 fills, last 2025-12-27)<br>Tobrex (2 fills, last 2025-12-25)<br>Alfacort (1 fills, last 2025-12-09)<br>Levotab (1 fills, last 2025-12-08) |
| Facilities most used | Burjeel Royal Hospital Asharej - L.L.C (39)<br>NEW MEDICAL CENTRE SPECIALTY HOSPITAL LTD-ABU DHABI (22)<br>LIFE PHARMACY L.L.C - BRANCH OF ABU DHABI (10) |

### Longitudinal inputs read by the rules (`GET /api/members/x2063/longitudinal`)

| column | value |
|---|---|
| `Last_HbA1c_Value` | 11.3 |
| `first_dyslipidemia_date` | 2025-10-12 |
| `flag_dm_circulatory` | 1 |
| `flag_dm_eye` | 1 |
| `flag_dm_neuropathy` | 1 |
| `flag_dm_foot` | 1 |
| `l12m_IP_admissions_DiaborHTNrelated` | 1 |
| `AGE` | 65 |
| `GENDER` | M |
| `cohort_t2d_l12m` | 1 |
| `flag_dm_hypoglycaemia_l12m` | 0 |
| `Last_SystolicPressure_Value` | 119 |
| `Last_DiastolicPressure_Value` | 61 |
| `last_ip_discharge_date` | 2025-12-08 |
| `ed_visits_l12m` | 0 |
| `last_ed_visit_date` | 2025-01-21 |
| `cohort_htn_l12m` | 0 |
| `flag_ckd` | 0 |
| `Last_eGFR_Value` | — |
| `last_egfr_test_date` | 2025-11-18 |
| `last_urine_albumin_date` | 2025-10-12 |
| `pdc_any_t2d_noninsulin` | — |
| `pdc_any_htn` | — |
| `days_since_t2d_supply_ran_out` | 203 |
| `days_since_htn_supply_ran_out` | 298 |
| `last_foot_exam` | — |
| `flag_dm_foot_ulcer_l12m` | 1 |
| `flag_amputation` | 0 |
| `flag_active_ACEinhibitor` | 0 |
| `last_potassium_date` | 2025-11-18 |
| `flag_active_ARBinhibitor` | 0 |
| `pdc_mra` | — |
| `pdc_thiazide` | — |
| `last_lipid_panel_date` | 2025-10-12 |
| `last_renal_panel_date` | 2025-11-18 |
| `last_hba1c_date2` | 2025-12-05 |
| `last_retinal_screen_date` | 2025-12-30 |
| `last_ophthalmology_visit` | 2025-12-27 |
| `first_e11_date` | 2024-01-11 |
| `first_htn_date` | 2025-01-21 |
| `last_dietitian_visit` | — |
| `last_diabeducator_visit` | — |

### Expected risk result (`GET /api/members/x2063/risk`)

| component | engine | cap | extract reference | rules that scored |
|---|---|---|---|---|
| C · Clinical | **4** | 5 | 4 | RS-C-005 (+4): HbA1c ≥ 10 (T2D only) → 4 points (Last_HbA1c_Value = 11.3) |
| M · Comorbidity | **6** | 6 | 6 | RS-M-009 (+1): Dyslipidaemia → 1 point (first_dyslipidemia_date = 2025-10-12)<br>RS-M-015 (+3): Peripheral arterial disease → 3 points (flag_dm_circulatory = 1)<br>RS-M-016 (+2): Diabetic retinopathy → 2 points (flag_dm_eye = 1)<br>RS-M-017 (+1): Peripheral neuropathy → 1 point (flag_dm_neuropathy = 1)<br>RS-M-018 (+4): Diabetic foot ulcer → 4 points (flag_dm_foot = 1) |
| K · Kidney | **0** | 5 | 0 | — |
| U · Utilisation | **3** | 5 | 3 | RS-U-029 (+3): One unplanned admission → 3 points (l12m_IP_admissions_DiaborHTNrelated = 1) |
| A · Age/sex | **2** | 2 | 2 | RS-A-031b (+2): Man ≥ 60 → 2 points (AGE = 65, GENDER = M) |
| **Total R** | **15** | 23 | 15 (file label "1. Very High") | tier **4 Very high** · cadence Weekly, then every 2–4 weeks |
| Alert / priority | **AMBER · P2** | | | Trig4_post_discharge_care = 1 |
| Safety flag | 0 | | | kidney provisional: 1 |

### Expected trigger evaluations (`GET /api/members/x2063/evaluations`)

| rule | class | result | evidence (inputs read) | next-best action · owner | done when |
|---|---|---|---|---|---|
| Trig3 Hypoglycaemia | Safety | **not_fired** | cohort_t2d_l12m = 1; flag_dm_hypoglycaemia_l12m = 0 | Same-day clinician review, hypo plan, glucagon check · Doctor | Review note and medicine change logged |
| BPU BP urgent | Safety | **not_fired** | Last_SystolicPressure_Value = 119; Last_DiastolicPressure_Value = 61 | Stop the script and escalate the same day · Nurse → doctor | Escalation closed |
| Trig4 Post-discharge care | Acute event | **not_fired** | last_ip_discharge_date = 2025-12-08; ed_visits_l12m = 0; last_ed_visit_date = 2025-01-21 | GP follow-up within 72 h; medicine reconciliation · Coordinator | GP outpatient claim within 7 days |
| Trig1 HbA1c above target | Uncontrolled | **fired** | Last_HbA1c_Value = 11.3 (rule: >= 8) | Glycaemic treatment review · Doctor | Goal, decision and next test date recorded |
| Trig2 BP treatment review | Uncontrolled | **not_fired** | cohort_htn_l12m = 0; Last_SystolicPressure_Value = 119; Last_DiastolicPressure_Value = 61; cohort_t2d_l12m = 1; flag_ckd = 0 | Home BP recheck and clinician review · Nurse | Readings reviewed, next BP date set |
| Trig5 Kidney check | Uncontrolled | **fired** | last_urine_albumin_date = 2025-10-12 (384 days before as-of) (rule: missing_or_gt 365) | Book eGFR and UACR; nephrology if eGFR < 30 · Coordinator | Lab claim with a result |
| Trig9 Medication adherence | Barrier | **fired** | days_since_t2d_supply_ran_out = 203 (rule: > 30) | Refill and barrier check; pharmacist if 3 or more classes · Coordinator / pharmacist | Next fill dispensed within 14 days |
| Trig13 High-risk foot | Verified gap | **fired** | last_foot_exam = none on record (rule: missing_or_gt 365) | Foot exam; podiatry if high risk · Nurse | Exam claim |
| Trig7 Potassium due | Verified gap | **not_fired** | cohort_htn_l12m = 0; flag_active_ACEinhibitor = 0; last_potassium_date = 2025-11-18; flag_active_ARBinhibitor = 0; pdc_mra = —; pdc_thiazide = — | Add K+ to the next lab order · Coordinator | Lab claim |
| Trig11 Annual labs | Verified gap | **fired** | last_lipid_panel_date = 2025-10-12 (384 days before as-of) (rule: missing_or_gt 365) | One bundled lab visit · Coordinator | Lab claims |
| Trig6 HbA1c test due | Verified gap | **fired** | last_hba1c_date2 = 2025-12-05 (330 days before as-of) (rule: missing_or_gt 180) | Book HbA1c at an in-network lab · Coordinator | Lab claim |
| Trig12 Eye exam due | Verified gap | **not_fired** | cohort_t2d_l12m = 1; last_retinal_screen_date = 2025-12-30; last_ophthalmology_visit = 2025-12-27 | Confirm the last exam or refer · Nurse | Report or referral claim |
| Trig10 New diagnosis | Patient goal | **not_fired** | first_e11_date = 2024-01-11; first_htn_date = 2025-01-21 | Baseline assessment and DSMES referral · Nurse | Assessment documented |
| Trig8 Nutrition and education | Patient goal | **fired** | last_dietitian_visit = none on record (rule: missing_or_gt 365); last_diabeducator_visit = none on record (rule: missing_or_gt 365) | Self-management goal, dietitian · Nurse | Goal set and reviewed |

### Expected care plan (`GET /api/members/x2063/care-plan`)

| slot | rank | need | class | gap state | due | action (owner) |
|---|---|---|---|---|---|---|
| CURRENT | 1 | Trig1 HbA1c above target | Uncontrolled | Potential | 2026-11-27 | Glycaemic treatment review (Doctor) |
| CURRENT | 2 | Trig5 Kidney check | Uncontrolled | Potential | 2026-11-27 | Book eGFR and UACR; nephrology if eGFR < 30 (Coordinator) |
| CURRENT | 3 | Trig9 Medication adherence | Barrier | Potential | 2026-11-27 | Refill and barrier check; pharmacist if 3 or more classes (Coordinator / pharmacist) |
| NEXT | 4 | Trig6 HbA1c test due | Verified gap | Potential | 2026-12-20 | — |
| NEXT | 5 | Trig13 High-risk foot | Verified gap | Potential | 2026-12-20 | — |
| NEXT | 6 | Trig11 Annual labs | Verified gap | Potential | 2026-12-20 | — |
| FUTURE | 7 | Trig8 Nutrition and education | Patient goal | Potential | 2026-12-04 | — |

### Expected worklist appearance

| | |
|---|---|
| Nurse | Sara Mansour (U-0161) |
| List | today · programme rank 13 · nurse rank 7 |
| Outreach | P2 · due 2026-11-21 |
| Current needs | HbA1c above target · Kidney check · Medication adherence |
| Consent before the demo | pending |

### Script to walk through

1. **Studio → Care intelligence**: search `x2063`. Check R = 15/23, tier 4, AMBER P2, the 7 fired triggers in the rulebook table and the care plan CURRENT/NEXT/FUTURE above. Open "Why this score" to see column → value → rule → result.
2. **Portal** (login sara / 1234): the member is on the today list. Open the member: before consent only the header, why-we-are-calling and the consent card render.
3. **Consent → granted**, **Call → reached**: the clinical sections render; the outreach closes and a cadence check-in is scheduled.
4. **Member 360**: history is from raw claims (claim ids, lab series, medicines, admissions); the longitudinal values stay in the Intelligence tab.
5. **Actions**: agree the first CURRENT need, mark the second done, decline the third. Expected: agreed → Scheduled + "Check it happened"; done → Reported + "Verify in claims"; declined → 90-day hold + re-offer; the NEXT needs are promoted into CURRENT with new actions.
6. **Tasks** shows the follow-ups; **Timeline** shows every event; **Studio → Care intelligence** shows the same member updated. **Run rules now** keeps all nurse work (idempotent run).
7. `npm run reset` returns to the starting state.

---

## Demo member 2 · Type 2 diabetes and hypertension · `x206`

High risk (tier 3) with HbA1c above goal, uncontrolled blood pressure, a kidney check due and an admission in the raw claims; both trigger families apply.

### Identity (longitudinal + crosswalk)

| | |
|---|---|
| Masked member id | `x206` (same id in both Excel sources) |
| Display pseudonym | Daniel Sheikh |
| Age / gender / nationality | 54 / M / BANGLADESHI |
| Policy type | Key Clients |
| Pathway | T2D·HTN (cohort_t2d_l12m = 1, cohort_htn_l12m = 1) |
| Persona (extract) | 1. Complications |

### Member 360 from raw claims (`GET /api/members/x206/360`)

| | |
|---|---|
| Claims / activity lines | 96 / 340 (2024-01-13 → 2026-10-09) |
| Payable total | AED 73200 |
| Admissions (IP) / ED visits (all time) | 1 / 0 |
| Last 12 months to as-of | 35 claims, 0 admissions, 0 ED, AED 10397 |
| Chronic condition codes | E11.9, I10, E11.65, E78.5, E11.22, E11.319, E11.39, E11.40 |
| Lab series (code · n · last) | BMI 39156-5 · 15 · 27.41 on 2026-01-11<br>Creatinine 14682-9 · 15 · 94.5 on 2026-05-14<br>Cholesterol 14647-2 · 9 · 3.04 on 2026-05-14<br>Systolic BP 8480-6 · 5 · 154 on 2025-08-31<br>Diastolic BP 8462-4 · 5 · 75 on 2025-08-31<br>HbA1c 4548-4 · 3 · 9.1 on 2026-01-11 |
| Medicines (most recent fills) | Rosuvastatin Calcium,Ezetimibe (3 fills, last 2026-10-09)<br>Clofen (2 fills, last 2026-09-25)<br>Codeine,Paracetamol (Acetaminophen) (2 fills, last 2026-09-25)<br>Missing Drug (70 fills, last 2026-09-25)<br>Aspirin Protect (9 fills, last 2026-08-29)<br>Clopidocor (3 fills, last 2026-08-29) |
| Facilities most used | NMC Royal Hospital LTD - Abu Dhabi (22)<br>Al Dhafra Family Medicine Center (14)<br>Al Dhafra Family Medicine Center Pharmacy (13) |

### Longitudinal inputs read by the rules (`GET /api/members/x206/longitudinal`)

| column | value |
|---|---|
| `Last_HbA1c_Value` | 9.5 |
| `cohort_htn_l12m` | 1 |
| `first_dyslipidemia_date` | 2026-03-10 |
| `flag_ischemic_heart_disease` | 1 |
| `flag_dm_eye` | 1 |
| `flag_dm_neuropathy` | 1 |
| `Last_eGFR_Value` | 78 |
| `AGE` | 54 |
| `GENDER` | M |
| `cohort_t2d_l12m` | 1 |
| `flag_dm_hypoglycaemia_l12m` | 0 |
| `Last_SystolicPressure_Value` | 154 |
| `Last_DiastolicPressure_Value` | 75 |
| `last_ip_discharge_date` | 2025-10-30 |
| `ed_visits_l12m` | 0 |
| `last_ed_visit_date` | — |
| `flag_ckd` | 0 |
| `last_egfr_test_date` | 2026-09-24 |
| `last_urine_albumin_date` | 2026-09-24 |
| `pdc_any_t2d_noninsulin` | 0.91 |
| `pdc_any_htn` | 0.96 |
| `days_since_t2d_supply_ran_out` | -19 |
| `days_since_htn_supply_ran_out` | -27 |
| `last_foot_exam` | — |
| `flag_dm_foot_ulcer_l12m` | 0 |
| `flag_amputation` | 0 |
| `flag_active_ACEinhibitor` | 0 |
| `last_potassium_date` | 2026-09-24 |
| `flag_active_ARBinhibitor` | 0 |
| `pdc_mra` | — |
| `pdc_thiazide` | 0.39 |
| `last_lipid_panel_date` | 2026-09-24 |
| `last_renal_panel_date` | 2026-09-24 |
| `last_hba1c_date2` | 2026-09-24 |
| `last_retinal_screen_date` | 2026-05-24 |
| `last_ophthalmology_visit` | 2026-01-11 |
| `first_e11_date` | 2024-03-17 |
| `first_htn_date` | 2024-10-07 |
| `last_dietitian_visit` | — |
| `last_diabeducator_visit` | — |

### Expected risk result (`GET /api/members/x206/risk`)

| component | engine | cap | extract reference | rules that scored |
|---|---|---|---|---|
| C · Clinical | **5** | 5 | 5 | RS-C-004 (+3): HbA1c 9–9.9 (T2D only) → 3 points (Last_HbA1c_Value = 9.5)<br>RS-C-006 (+2): Hypertension diagnosis → 2 points (cohort_htn_l12m = 1) |
| M · Comorbidity | **6** | 6 | 6 | RS-M-009 (+1): Dyslipidaemia → 1 point (first_dyslipidemia_date = 2026-03-10)<br>RS-M-012 (+3): CAD / MI → 3 points (flag_ischemic_heart_disease = 1)<br>RS-M-016 (+2): Diabetic retinopathy → 2 points (flag_dm_eye = 1)<br>RS-M-017 (+1): Peripheral neuropathy → 1 point (flag_dm_neuropathy = 1) |
| K · Kidney | **0** | 5 | 0 | RS-K-020 (+0): eGFR ≥ 60 → 0 points (Last_eGFR_Value = 78) |
| U · Utilisation | **0** | 5 | 0 | — |
| A · Age/sex | **1** | 2 | 1 | RS-A-031a (+1): Man 40–59 → 1 point (AGE = 54, GENDER = M) |
| **Total R** | **12** | 23 | 12 (file label "2. High") | tier **3 High** · cadence Baseline, W2, M1, M2, M3, M4, M6, M9, M12 |
| Alert / priority | **AMBER · P2** | | | Trig4_post_discharge_care = 1 |
| Safety flag | 0 | | | kidney provisional: 0 |

### Expected trigger evaluations (`GET /api/members/x206/evaluations`)

| rule | class | result | evidence (inputs read) | next-best action · owner | done when |
|---|---|---|---|---|---|
| Trig3 Hypoglycaemia | Safety | **not_fired** | cohort_t2d_l12m = 1; flag_dm_hypoglycaemia_l12m = 0 | Same-day clinician review, hypo plan, glucagon check · Doctor | Review note and medicine change logged |
| BPU BP urgent | Safety | **not_fired** | Last_SystolicPressure_Value = 154; Last_DiastolicPressure_Value = 75 | Stop the script and escalate the same day · Nurse → doctor | Escalation closed |
| Trig4 Post-discharge care | Acute event | **not_fired** | last_ip_discharge_date = 2025-10-30; ed_visits_l12m = 0; last_ed_visit_date = — | GP follow-up within 72 h; medicine reconciliation · Coordinator | GP outpatient claim within 7 days |
| Trig1 HbA1c above target | Uncontrolled | **fired** | Last_HbA1c_Value = 9.5 (rule: >= 8) | Glycaemic treatment review · Doctor | Goal, decision and next test date recorded |
| Trig2 BP treatment review | Uncontrolled | **fired** | Last_SystolicPressure_Value = 154 (rule: >= 140) | Home BP recheck and clinician review · Nurse | Readings reviewed, next BP date set |
| Trig5 Kidney check | Uncontrolled | **not_fired** | Last_eGFR_Value = 78; cohort_t2d_l12m = 1; last_egfr_test_date = 2026-09-24; last_urine_albumin_date = 2026-09-24 | Book eGFR and UACR; nephrology if eGFR < 30 · Coordinator | Lab claim with a result |
| Trig9 Medication adherence | Barrier | **not_fired** | pdc_any_t2d_noninsulin = 0.91; pdc_any_htn = 0.96; days_since_t2d_supply_ran_out = -19; days_since_htn_supply_ran_out = -27 | Refill and barrier check; pharmacist if 3 or more classes · Coordinator / pharmacist | Next fill dispensed within 14 days |
| Trig13 High-risk foot | Verified gap | **fired** | last_foot_exam = none on record (rule: missing_or_gt 365) | Foot exam; podiatry if high risk · Nurse | Exam claim |
| Trig7 Potassium due | Verified gap | **not_fired** | cohort_htn_l12m = 1; flag_active_ACEinhibitor = 0; last_potassium_date = 2026-09-24; flag_active_ARBinhibitor = 0; pdc_mra = —; pdc_thiazide = 0.39 | Add K+ to the next lab order · Coordinator | Lab claim |
| Trig11 Annual labs | Verified gap | **not_fired** | last_lipid_panel_date = 2026-09-24; last_renal_panel_date = 2026-09-24 | One bundled lab visit · Coordinator | Lab claims |
| Trig6 HbA1c test due | Verified gap | **not_fired** | cohort_t2d_l12m = 1; last_hba1c_date2 = 2026-09-24; Last_HbA1c_Value = 9.5 | Book HbA1c at an in-network lab · Coordinator | Lab claim |
| Trig12 Eye exam due | Verified gap | **not_fired** | cohort_t2d_l12m = 1; last_retinal_screen_date = 2026-05-24; last_ophthalmology_visit = 2026-01-11 | Confirm the last exam or refer · Nurse | Report or referral claim |
| Trig10 New diagnosis | Patient goal | **not_fired** | first_e11_date = 2024-03-17; first_htn_date = 2024-10-07 | Baseline assessment and DSMES referral · Nurse | Assessment documented |
| Trig8 Nutrition and education | Patient goal | **fired** | last_dietitian_visit = none on record (rule: missing_or_gt 365); last_diabeducator_visit = none on record (rule: missing_or_gt 365) | Self-management goal, dietitian · Nurse | Goal set and reviewed |

### Expected care plan (`GET /api/members/x206/care-plan`)

| slot | rank | need | class | gap state | due | action (owner) |
|---|---|---|---|---|---|---|
| CURRENT | 1 | Trig1 HbA1c above target | Uncontrolled | Potential | 2026-11-27 | Glycaemic treatment review (Doctor) |
| CURRENT | 2 | Trig2 BP treatment review | Uncontrolled | Potential | 2026-11-27 | Home BP recheck and clinician review (Nurse) |
| CURRENT | 3 | Trig13 High-risk foot | Verified gap | Potential | 2026-12-20 | Foot exam; podiatry if high risk (Nurse) |
| NEXT | 4 | Trig8 Nutrition and education | Patient goal | Potential | 2026-12-04 | — |

### Expected worklist appearance

| | |
|---|---|
| Nurse | Omar Khalid (U-0150) |
| List | today · programme rank 35 · nurse rank 11 |
| Outreach | P2 · due 2026-11-21 |
| Current needs | HbA1c above target · BP treatment review · High-risk foot |
| Consent before the demo | pending |

### Script to walk through

1. **Studio → Care intelligence**: search `x206`. Check R = 12/23, tier 3, AMBER P2, the 4 fired triggers in the rulebook table and the care plan CURRENT/NEXT/FUTURE above. Open "Why this score" to see column → value → rule → result.
2. **Portal** (login omar / 1234): the member is on the today list. Open the member: before consent only the header, why-we-are-calling and the consent card render.
3. **Consent → granted**, **Call → reached**: the clinical sections render; the outreach closes and a cadence check-in is scheduled.
4. **Member 360**: history is from raw claims (claim ids, lab series, medicines, admissions); the longitudinal values stay in the Intelligence tab.
5. **Actions**: agree the first CURRENT need, mark the second done, decline the third. Expected: agreed → Scheduled + "Check it happened"; done → Reported + "Verify in claims"; declined → 90-day hold + re-offer; the NEXT needs are promoted into CURRENT with new actions.
6. **Tasks** shows the follow-ups; **Timeline** shows every event; **Studio → Care intelligence** shows the same member updated. **Run rules now** keeps all nurse work (idempotent run).
7. `npm run reset` returns to the starting state.

---

## Screenshots (`docs/demo-scenarios/screenshots/`)

| file | what it shows |
|---|---|
| `studio-01-builder.png` | Studio screen 1 · cohort & campaign builder with live counts from the longitudinal table |
| `studio-02-intelligence.png` | Studio screen 2 · programme KPIs and the ranked member list |
| `studio-02-intelligence-x2063.png` | Screen 2 for demo member 1 (x2063): R 15/23, tier 4, AMBER P2, fired triggers, care plan |
| `studio-02-intelligence-x206.png` | Screen 2 for demo member 2 (x206): R 12/23, tier 3, AMBER P2 |
| `studio-03-portal.png` | Studio screen 3 · the nurse's worklist with the portal embedded |
| `studio-04-x206-after-portal.png` | Screen 2 after the nurse's actions on x206: "1 reported · 1 consented", consent granted |
| `portal-01-login.png` | Portal login (demo accounts) |
| `portal-02-queue.png` | Omar Khalid's queue in rulebook order (RED / safety first) |
| `portal-03-member-x2063.png`, `portal-03-member-x206.png` | Member workspace before consent: header, why we're calling, consent card; everything else locked (G2) |
| `portal-07-x206-after-consent.png` | Consent granted on a recorded call: review, actions and Member 360 unlock |
| `portal-08-x206-actions.png` | Review of raw-claims history and the per-need actions |
| `portal-09-x206-after-outcomes.png` | After agree / done: care plan re-ranked, next need promoted |
| `portal-10-x206-care-plan.png` | Care gaps & plan tab: CURRENT / NEXT / FUTURE / CLOSED with gap states |
| `portal-11-x206-member360.png` | Member 360 from raw claims: cover, diagnoses, labs, medicines, claim ids |
| `portal-12-x206-timeline.png` | Timeline of every persisted event |
| `portal-13-tasks-after.png` | Tasks: the follow-ups the write-back rules created |
| `portal-04-tasks.png`, `portal-05-care-plans.png`, `portal-06-analytics.png` | Tasks, care plans and shift analytics pages in the clean state |
