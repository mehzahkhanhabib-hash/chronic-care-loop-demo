/** Care Intelligence reads (data flow B): risk, evaluations, alerts, care plan, worklist. Everything comes from Layer D tables. */
const SC = require('./scope');
const latestRun = db => (db.get('SELECT * FROM intelligence_run WHERE finished_at IS NOT NULL ORDER BY run_id DESC LIMIT 1') || {});
const name = (db, id) => db.get('SELECT display_name, initials FROM member_identifier_crosswalk WHERE member_id = ?', [id]) || {};

function identity(db, id) {
  const m = db.get('SELECT mask_id, "GENDER" AS gender, "AGE" AS age, "NATIONALITY" AS nationality, policy_group, policy_type, cohort_t2d_l12m, cohort_htn_l12m, t2d_identified_by, htn_identified_by, "Persona" AS persona, "Cohort_allocation" AS allocation, "Exclusion" AS exclusion FROM member_longitudinal WHERE mask_id = ?', [id]);
  if (!m) return null;
  const x = name(db, id);
  const lang = ['EMIRATI', 'SAUDI', 'OMANI', 'EGYPTIAN', 'JORDANIAN', 'SYRIAN', 'LEBANESE', 'PALESTINIAN', 'SUDANESE', 'YEMENI', 'IRAQI'].includes(String(m.nationality || '').toUpperCase()) ? 'Arabic' : 'English';
  return { member_id: id, display_name: x.display_name, initials: x.initials, pseudonym: true, ...m, language: lang, pathway: m.cohort_t2d_l12m && m.cohort_htn_l12m ? 'T2D·HTN' : m.cohort_t2d_l12m ? 'T2D' : m.cohort_htn_l12m ? 'HTN' : 'none' };
}
function risk(db, id, runId) {
  runId = runId || latestRun(db).run_id;
  const r = db.get('SELECT * FROM member_risk_result WHERE member_id = ? AND run_id = ?', [id, runId]); if (!r) return null;
  const comps = db.all('SELECT * FROM rule_risk_component');
  r.components = comps.map(c => ({ component: c.component, name: c.name, cap: Number(c.cap), formula: c.formula, score: r[{ C: 'clinical_score', M: 'comorbidity_score', K: 'kidney_score', U: 'utilisation_score', A: 'age_sex_score' }[c.component]], extract_score: r[{ C: 'extract_clinical_score', M: 'extract_comorbidity_score', K: 'extract_kidney_score', U: 'extract_utilisation_score', A: 'extract_age_sex_score' }[c.component]],
    rules: db.all("SELECT rule_id, input_features, input_values_json, evaluation_logic, points_awarded, clinical_evidence FROM member_rule_evaluation WHERE member_id = ? AND run_id = ? AND rule_type = 'risk_points' AND rule_id LIKE ?", [id, runId, `RS-${c.component}-%`]).map(e => ({ ...e, input_values: JSON.parse(e.input_values_json || '{}') })) }));
  r.tier_rule = db.get('SELECT * FROM rule_tier WHERE tier = ?', [String(r.tier)]);
  r.alert = db.get('SELECT * FROM member_alert WHERE member_id = ? AND run_id = ?', [id, runId]);
  return r;
}
function evaluations(db, id, runId) {
  runId = runId || latestRun(db).run_id;
  const rows = db.all(`SELECT e.*, t.name AS trigger_name, t.pathway, t.class AS need_class, c.sort_order AS class_order, c.label AS class_label, t.sort_order AS trigger_order, t.raw_data_rulebook, t.fires_when_rulebook, a.action_code, a.channel, a.escalate_to, a.evidence AS proof_required
    FROM member_rule_evaluation e JOIN rule_trigger t ON t.trigger_code = e.rule_id JOIN rule_need_class c ON c.class = t.class LEFT JOIN rule_action a ON a.trigger_code = t.trigger_code
    WHERE e.member_id = ? AND e.run_id = ? AND e.rule_type = 'trigger' ORDER BY c.sort_order, t.sort_order`, [id, runId]);
  const needs = Object.fromEntries(db.all('SELECT * FROM care_need WHERE member_id = ?', [id]).map(n => [n.trigger_code, n]));
  return rows.map(e => ({ ...e, input_values: JSON.parse(e.input_values_json || '{}'), need: needs[e.rule_id] || null }));
}
function carePlan(db, id) {
  const cp = db.get('SELECT * FROM care_plan WHERE member_id = ?', [id]);
  const needs = db.all(`SELECT n.*, t.name AS need, c.label AS class_label, t.pathway FROM care_need n JOIN rule_trigger t ON t.trigger_code = n.trigger_code JOIN rule_need_class c ON c.class = n.need_class WHERE n.member_id = ? ORDER BY CASE n.slot WHEN 'CURRENT' THEN 0 WHEN 'NEXT' THEN 1 WHEN 'FUTURE' THEN 2 ELSE 3 END, n.rank, n.class_order, n.trigger_order`, [id]);
  for (const n of needs) {
    n.action = db.get("SELECT * FROM action WHERE need_id = ? ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END, action_id DESC LIMIT 1", [n.need_id]);
    n.last_outcome = db.get('SELECT outcome, note, recorded_by, recorded_at FROM disposition_event WHERE need_id = ? ORDER BY disposition_id DESC LIMIT 1', [n.need_id]);
    n.gap_events = db.all('SELECT from_state, to_state, moved_by, evidence, recorded_at FROM care_gap_event WHERE need_id = ? ORDER BY gap_event_id', [n.need_id]);
    n.assertions = db.all('SELECT assertion_text, recorded_by, recorded_at FROM member_assertion WHERE need_id = ? ORDER BY assertion_id', [n.need_id]);
  }
  return { care_plan: cp, needs, current: needs.filter(n => n.slot === 'CURRENT'), next: needs.filter(n => n.slot === 'NEXT'), future: needs.filter(n => n.slot === 'FUTURE'), closed: needs.filter(n => n.slot === 'CLOSED') };
}
function actions(db, id) { return db.all(`SELECT a.*, p.title AS came_from, (SELECT outcome FROM disposition_event d WHERE d.action_id = a.parent_action_id ORDER BY disposition_id DESC LIMIT 1) AS because_outcome, u.name AS assignee_name FROM action a LEFT JOIN action p ON p.action_id = a.parent_action_id LEFT JOIN nurse_user u ON u.user_id = a.assignee WHERE a.member_id = ? ORDER BY CASE WHEN a.status = 'open' THEN 0 ELSE 1 END, a.due_date, a.action_id`, [id]); }
function timeline(db, id) {
  const ev = [];
  for (const r of db.all('SELECT * FROM consent_event WHERE member_id = ?', [id])) ev.push({ at: r.recorded_at, type: 'consent', text: `Consent ${r.consent_status}`, by: r.nurse_id, ref: r.consent_event_id });
  for (const r of db.all('SELECT * FROM contact_attempt WHERE member_id = ?', [id])) ev.push({ at: r.started_at, type: 'call', text: r.reached ? 'Call: reached' : `Call: ${r.result || 'not reached'}`, by: r.nurse_id, ref: r.attempt_id });
  for (const r of db.all('SELECT d.*, n.trigger_code FROM disposition_event d LEFT JOIN care_need n ON n.need_id = d.need_id WHERE d.member_id = ?', [id])) ev.push({ at: r.recorded_at, type: 'disposition', text: `${r.outcome}${r.trigger_code ? ' · ' + r.trigger_code : ''}${r.note ? ': ' + r.note : ''}`, by: r.recorded_by, ref: r.disposition_id });
  for (const r of db.all('SELECT * FROM member_assertion WHERE member_id = ?', [id])) ev.push({ at: r.recorded_at, type: 'assertion', text: `Member said: ${r.assertion_text}`, by: r.recorded_by, ref: r.assertion_id });
  for (const r of db.all('SELECT g.*, n.trigger_code FROM care_gap_event g JOIN care_need n ON n.need_id = g.need_id WHERE g.member_id = ?', [id])) ev.push({ at: r.recorded_at, type: 'gap', text: `${r.trigger_code}: ${r.from_state || 'new'} → ${r.to_state} (${r.moved_by})`, by: r.moved_by, ref: r.gap_event_id });
  for (const r of db.all('SELECT * FROM appointment WHERE member_id = ?', [id])) ev.push({ at: r.booked_at, type: 'appointment', text: `Booked ${r.appointment_type} for ${r.scheduled_date}`, by: r.booked_by, ref: r.appointment_id });
  for (const r of db.all('SELECT * FROM nurse_note WHERE member_id = ?', [id])) ev.push({ at: r.created_at, type: 'note', text: r.text, by: r.nurse_id, ref: r.note_id });
  for (const r of db.all("SELECT * FROM action WHERE member_id = ? AND source <> 'engine'", [id])) ev.push({ at: r.created_at, type: 'action', text: `New action: ${r.title} (due ${r.due_date})`, by: r.assignee, ref: r.action_id });
  return ev.sort((a, b) => (b.at || '').localeCompare(a.at || '') || b.ref - a.ref);
}
function longitudinal(db, id) {
  const row = db.get('SELECT * FROM member_longitudinal WHERE mask_id = ?', [id]); if (!row) return null;
  const fields = db.all('SELECT * FROM longitudinal_field');
  return { member_id: id, columns: fields.length, values: row, fields };
}
/** Screen-2 list: every member with latest risk, alert, fired triggers, campaign and worklist status. */
function members(db, query = {}) {
  const { q, tier, alert, campaign, limit = 500 } = query;
  const run = latestRun(db).run_id;
  const w = ['r.run_id = ?'], p = [run];
  const scope = SC.resolve(db, query);
  if (scope) w.push(`x.member_id IN (${scope.sqlList})`);
  if (q) { w.push('(x.member_id LIKE ? OR x.display_name LIKE ?)'); p.push(`%${q}%`, `%${q}%`); }
  if (tier) { w.push('r.tier = ?'); p.push(Number(tier)); }
  if (alert) { w.push('a.alert_colour = ?'); p.push(alert); }
  if (campaign) { w.push('cm.campaign_id = ?'); p.push(campaign); }
  const rows = db.all(`SELECT x.member_id, x.display_name, x.initials, l."AGE" AS age, l."GENDER" AS gender, l."NATIONALITY" AS nationality, l.policy_type AS plan, r.pathway, r.total_risk_score, r.tier, r.tier_label, r.safety_flag, r.kidney_provisional, r.clinical_score, r.comorbidity_score, r.kidney_score, r.utilisation_score, r.age_sex_score,
      a.alert_colour, a.contact_priority, a.reasons AS alert_reasons, cm.campaign_id, c.name AS campaign_name, w.list_status, w.nurse_id, u.name AS nurse_name, w.due_by, w.current_needs, w.rank_no,
      (SELECT count(*) FROM member_rule_evaluation e WHERE e.member_id = x.member_id AND e.run_id = r.run_id AND e.rule_type = 'trigger' AND e.evaluation_result = 'fired') AS triggers_fired,
      (SELECT count(*) FROM member_rule_evaluation e WHERE e.member_id = x.member_id AND e.run_id = r.run_id AND e.rule_type = 'trigger' AND e.evaluation_result = 'cannot_tell') AS triggers_cannot_tell,
      (SELECT count(*) FROM care_need n WHERE n.member_id = x.member_id AND n.status = 'open') AS open_needs,
      (SELECT consent_status FROM consent_event ce WHERE ce.member_id = x.member_id ORDER BY recorded_at DESC, consent_event_id DESC LIMIT 1) AS consent_status
    FROM member_identifier_crosswalk x JOIN member_longitudinal l ON l.mask_id = x.member_id JOIN member_risk_result r ON r.member_id = x.member_id JOIN member_alert a ON a.member_id = x.member_id AND a.run_id = r.run_id
    LEFT JOIN campaign_member cm ON cm.member_id = x.member_id AND cm.run_id = r.run_id LEFT JOIN campaign c ON c.campaign_id = cm.campaign_id LEFT JOIN worklist w ON w.member_id = x.member_id AND w.run_id = r.run_id LEFT JOIN nurse_user u ON u.user_id = w.nurse_id
    WHERE ${w.join(' AND ')} ORDER BY (r.safety_flag = 1 OR a.alert_colour = 'RED') DESC, r.tier DESC, r.total_risk_score DESC, x.member_id LIMIT ?`, [...p, limit]);
  return { run_id: run, count: rows.length, scope: scope ? { kind: scope.kind, id: scope.id, label: scope.label, members: scope.ids.length } : null,
    members: rows.map(r => ({ ...r, consent_status: r.consent_status || 'pending', control_group: scope && scope.holdout.has(r.member_id) ? 1 : 0 })) };
}
function programme(db) {
  const run = latestRun(db).run_id;
  return db.all(`SELECT t.trigger_code, t.name, t.pathway, t.class, c.label AS class_label, c.sort_order AS class_order, t.sort_order AS trigger_order, a.title AS next_best_action, a.owner_role, a.done_when,
      SUM(e.evaluation_result = 'fired') AS fired, SUM(e.evaluation_result = 'cannot_tell') AS cannot_tell, SUM(e.evaluation_result = 'not_fired') AS not_fired, count(*) AS evaluated,
      (SELECT count(*) FROM care_need n WHERE n.trigger_code = t.trigger_code AND n.status = 'open') AS open_needs,
      (SELECT count(*) FROM care_need n WHERE n.trigger_code = t.trigger_code AND n.slot = 'CURRENT') AS in_current,
      (SELECT count(*) FROM care_need n WHERE n.trigger_code = t.trigger_code AND n.gap_state = 'Reported') AS reported,
      (SELECT count(*) FROM care_need n WHERE n.trigger_code = t.trigger_code AND n.gap_state = 'Closed') AS closed_in_claims,
      (SELECT count(*) FROM care_need n WHERE n.trigger_code = t.trigger_code AND n.status = 'declined') AS declined
    FROM rule_trigger t JOIN rule_need_class c ON c.class = t.class LEFT JOIN rule_action a ON a.trigger_code = t.trigger_code LEFT JOIN member_rule_evaluation e ON e.rule_id = t.trigger_code AND e.rule_type = 'trigger' AND e.run_id = ?
    GROUP BY t.trigger_code ORDER BY c.sort_order, t.sort_order`, [run]);
}
function kpis(db, query = {}) {
  const run = latestRun(db);
  const scope = SC.resolve(db, query);
  const F = scope ? ` AND member_id IN (${scope.sqlList})` : '';
  const one = sql => Object.values(db.get(sql.replace(/\{Fn\}/g, F.replace('member_id', 'n.member_id')).replace(/\{F\}/g, F)))[0];
  return { run_id: run.run_id, run_date: run.run_date, rule_version: run.rule_version, scope: scope ? { kind: scope.kind, id: scope.id, label: scope.label, members: scope.ids.length } : null, members: scope ? scope.ids.length : one('SELECT count(*) FROM member_longitudinal'), evaluated: one(`SELECT count(*) FROM member_risk_result WHERE run_id = ${run.run_id || 0}{F}`),
    triggers_fired: one(`SELECT count(*) FROM member_rule_evaluation WHERE run_id = ${run.run_id || 0} AND rule_type='trigger' AND evaluation_result='fired'{F}`), cannot_tell: one(`SELECT count(*) FROM member_rule_evaluation WHERE run_id = ${run.run_id || 0} AND rule_type='trigger' AND evaluation_result='cannot_tell'{F}`),
    care_plans: one('SELECT count(*) FROM care_plan WHERE 1=1{F}'), open_needs: one("SELECT count(*) FROM care_need WHERE status='open'{F}"), current_needs: one("SELECT count(*) FROM care_need WHERE slot='CURRENT'{F}"), current_without_action: one("SELECT count(*) FROM care_need n WHERE n.slot='CURRENT' AND n.status='open' AND NOT EXISTS (SELECT 1 FROM action a WHERE a.need_id=n.need_id AND a.status='open') {Fn}"),
    on_todays_list: one("SELECT count(*) FROM worklist WHERE list_status='today'{F}"), queued: one("SELECT count(*) FROM worklist WHERE list_status='queued'{F}"), nudges: one("SELECT count(*) FROM action WHERE status='open' AND kind='nudge'{F}"), open_follow_ups: one("SELECT count(*) FROM action WHERE status='open' AND kind='follow_up'{F}"), open_escalations: one("SELECT count(*) FROM action WHERE status='open' AND kind='escalation'{F}"),
    reported_not_in_claims: one("SELECT count(*) FROM care_need WHERE gap_state='Reported'{F}"), closed_in_claims: one("SELECT count(*) FROM care_need WHERE gap_state='Closed'{F}"), consented: one("SELECT count(DISTINCT member_id) FROM consent_event WHERE consent_status='granted'{F}"), red: one(`SELECT count(*) FROM member_alert WHERE run_id = ${run.run_id || 0} AND alert_colour='RED'{F}`), amber: one(`SELECT count(*) FROM member_alert WHERE run_id = ${run.run_id || 0} AND alert_colour='AMBER'{F}`) };
}
module.exports = { latestRun, identity, risk, evaluations, carePlan, actions, timeline, longitudinal, members, programme, kpis };
