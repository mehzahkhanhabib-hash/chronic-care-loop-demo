-- Views named as in CCC_Revised_Raw_Member360_Longitudinal_Care_Intelligence.xlsx (created by importers/rules.js after the rule tables exist).
CREATE VIEW IF NOT EXISTS longitudinal_member AS SELECT * FROM member_longitudinal;
CREATE VIEW IF NOT EXISTS trigger_input_binding AS SELECT rule_table || ':' || rule_key || ':' || field AS binding_id, rule_key AS rule_id, field AS longitudinal_column, role, note FROM rule_input WHERE rule_table = 'rule_trigger';
CREATE VIEW IF NOT EXISTS member_trigger_result AS
  SELECT evaluation_id AS trigger_result_id, run_id, member_id, rule_id AS trigger_id, evaluation_result AS state, input_features, input_values_json AS evidence_json, clinical_evidence, evaluation_logic, evaluated_at
  FROM member_rule_evaluation WHERE rule_type = 'trigger';
CREATE VIEW IF NOT EXISTS member_need AS
  SELECT need_id, member_id, trigger_code AS trigger_id, last_evaluation_id AS trigger_result_id, need_class, rank AS position, slot AS lane, status, gap_state, due_date, next_best_action AS nba_text, action_owner, done_when, opened_run_id AS run_id
  FROM care_need;
CREATE VIEW IF NOT EXISTS care_intelligence_member_v AS
  SELECT r.run_id, r.member_id, l."Last_HbA1c_Value" AS latest_hba1c_value, l."Last_HbA1c_Date" AS latest_hba1c_date, l."Last_SystolicPressure_Value" AS latest_sbp, l."Last_DiastolicPressure_Value" AS latest_dbp, l."Last_eGFR_Value" AS latest_egfr,
         r.total_risk_score AS risk_score, r.tier AS risk_tier, r.tier_label, a.alert_colour, r.safety_flag, a.contact_priority, r.pathway, r.extract_total_risk_score AS snapshot_total_risk_score, r.extract_risk_tier AS snapshot_risk_tier,
         (SELECT consent_status FROM consent_event c WHERE c.member_id = r.member_id ORDER BY recorded_at DESC, consent_event_id DESC LIMIT 1) AS consent_status
  FROM member_risk_result r JOIN member_alert a ON a.run_id = r.run_id AND a.member_id = r.member_id JOIN member_longitudinal l ON l.mask_id = r.member_id
  WHERE r.run_id = (SELECT MAX(run_id) FROM intelligence_run WHERE finished_at IS NOT NULL);
CREATE VIEW IF NOT EXISTS care_intelligence_trigger_v AS
  SELECT e.evaluation_id AS trigger_result_id, e.run_id, e.member_id, e.rule_id AS trigger_id, t.name AS trigger_name, e.evaluation_result AS trigger_state, e.input_values_json AS evidence_json, e.clinical_evidence, e.evaluation_logic AS condition_text, e.rule_version
  FROM member_rule_evaluation e JOIN rule_trigger t ON t.trigger_code = e.rule_id
  WHERE e.rule_type = 'trigger' AND e.run_id = (SELECT MAX(run_id) FROM intelligence_run WHERE finished_at IS NOT NULL);
CREATE VIEW IF NOT EXISTS care_intelligence_need_v AS
  SELECT n.need_id, n.last_evaluation_id AS trigger_result_id, n.member_id, n.trigger_code AS trigger_id, t.name AS trigger_name, n.need_class, c.sort_order AS class_order, n.rank AS need_position, n.slot AS lane, n.status, n.gap_state, n.due_date,
         n.next_best_action AS nba_text, n.action_owner AS owner, n.done_when, n.evidence AS why_now
  FROM care_need n JOIN rule_trigger t ON t.trigger_code = n.trigger_code JOIN rule_need_class c ON c.class = n.need_class;
CREATE VIEW IF NOT EXISTS care_intelligence_worklist_v AS
  SELECT w.run_id, w.member_id, w.nurse_id, u.name AS nurse_name, w.rank_no, w.nurse_rank, w.list_status, w.contact_priority, w.alert_colour, w.tier, w.safety_flag, w.campaign_id, w.action_id, w.due_by, w.current_needs
  FROM worklist w LEFT JOIN nurse_user u ON u.user_id = w.nurse_id WHERE w.run_id = (SELECT MAX(run_id) FROM worklist);
