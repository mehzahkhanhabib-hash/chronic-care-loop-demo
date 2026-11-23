/** Portal reads: worklist per nurse, tasks, analytics. Writes live in rule-engine/writeback.js. */
const I = require('./intelligence');
const SC = require('./scope');
function worklist(db, query = {}) {
  const { nurse_id, status } = query;
  const run = I.latestRun(db).run_id;
  const w = ['w.run_id = ?'], p = [run];
  const scope = SC.resolve(db, query);
  if (scope) w.push(`w.member_id IN (${scope.sqlList})`);
  if (nurse_id) { w.push('w.nurse_id = ?'); p.push(nurse_id); }
  if (status) { w.push('w.list_status = ?'); p.push(status); }
  const rows = db.all(`SELECT w.*, x.display_name, x.initials, l."AGE" AS age, l."GENDER" AS gender, l."NATIONALITY" AS nationality, l.policy_type AS plan, r.total_risk_score, r.tier_label, r.pathway, u.name AS nurse_name, a.title AS action_title, a.kind AS action_kind, a.attempt, a.status AS action_status, c.name AS campaign_name,
      (SELECT consent_status FROM consent_event ce WHERE ce.member_id = w.member_id ORDER BY recorded_at DESC, consent_event_id DESC LIMIT 1) AS consent_status,
      (SELECT count(*) FROM contact_attempt ca WHERE ca.member_id = w.member_id) AS attempts,
      (SELECT MAX(started_at) FROM contact_attempt ca WHERE ca.member_id = w.member_id) AS last_contact,
      (SELECT n.trigger_code FROM care_need n WHERE n.member_id = w.member_id AND n.slot = 'CURRENT' AND n.status = 'open' ORDER BY n.rank LIMIT 1) AS top_trigger,
      (SELECT n.evidence FROM care_need n WHERE n.member_id = w.member_id AND n.slot = 'CURRENT' AND n.status = 'open' ORDER BY n.rank LIMIT 1) AS top_evidence,
      al.reasons AS alert_reasons
    FROM worklist w JOIN member_identifier_crosswalk x ON x.member_id = w.member_id JOIN member_longitudinal l ON l.mask_id = w.member_id JOIN member_risk_result r ON r.member_id = w.member_id AND r.run_id = w.run_id
    JOIN member_alert al ON al.member_id = w.member_id AND al.run_id = w.run_id LEFT JOIN nurse_user u ON u.user_id = w.nurse_id LEFT JOIN action a ON a.action_id = w.action_id LEFT JOIN campaign c ON c.campaign_id = w.campaign_id
    WHERE ${w.join(' AND ')} ORDER BY w.nurse_rank`, p);
  return { run_id: run, count: rows.length, scope: scope ? { kind: scope.kind, id: scope.id, label: scope.label, members: scope.ids.length } : null, items: rows.map(r => ({ ...r, consent_status: r.consent_status || 'pending' })) };
}
function tasks(db, { nurse_id, status, member_id, kind } = {}) {
  const w = ['1=1'], p = [];
  if (nurse_id) { w.push('t.assignee = ?'); p.push(nurse_id); } if (status) { w.push('t.status = ?'); p.push(status); } if (member_id) { w.push('t.member_id = ?'); p.push(member_id); } if (kind) { w.push('t.task_kind = ?'); p.push(kind); }
  return db.all(`SELECT t.*, x.display_name, a.kind AS action_kind, a.need_id, a.owner_role, a.parent_action_id, n.trigger_code, n.slot, n.gap_state, u.name AS assignee_name FROM task t JOIN member_identifier_crosswalk x ON x.member_id = t.member_id LEFT JOIN action a ON a.action_id = t.action_id LEFT JOIN care_need n ON n.need_id = a.need_id LEFT JOIN nurse_user u ON u.user_id = t.assignee WHERE ${w.join(' AND ')} ORDER BY CASE WHEN t.status = 'open' THEN 0 ELSE 1 END, t.due_date, t.task_id`, p);
}
function analytics(db, { nurse_id } = {}) {
  const f = nurse_id ? ' AND assignee = ?' : '', p = nurse_id ? [nurse_id] : [];
  const today = db.get("SELECT value FROM app_setting WHERE key='run_date'").value;
  return { today, calls_made: db.get(`SELECT count(*) AS n FROM contact_attempt WHERE 1=1${nurse_id ? ' AND nurse_id = ?' : ''}`, p).n, reached: db.get(`SELECT count(*) AS n FROM contact_attempt WHERE reached = 1${nurse_id ? ' AND nurse_id = ?' : ''}`, p).n,
    consents: db.get(`SELECT count(*) AS n FROM consent_event WHERE consent_status = 'granted'${nurse_id ? ' AND nurse_id = ?' : ''}`, p).n, declined: db.get(`SELECT count(*) AS n FROM consent_event WHERE consent_status IN ('declined','withdrawn')${nurse_id ? ' AND nurse_id = ?' : ''}`, p).n,
    tasks_open: db.get(`SELECT count(*) AS n FROM task WHERE status = 'open'${f}`, p).n, tasks_done: db.get(`SELECT count(*) AS n FROM task WHERE status <> 'open'${f}`, p).n,
    tasks_by_kind: db.all(`SELECT task_kind, status, count(*) AS n FROM task WHERE 1=1${f} GROUP BY task_kind, status`, p),
    outcomes: db.all(`SELECT outcome, count(*) AS n FROM disposition_event WHERE 1=1${nurse_id ? ' AND recorded_by = ?' : ''} GROUP BY outcome`, p),
    gaps: db.all('SELECT gap_state, count(*) AS n FROM care_need GROUP BY gap_state'), worklist: db.all(`SELECT list_status, count(*) AS n FROM worklist w WHERE w.run_id = (SELECT MAX(run_id) FROM intelligence_run)${nurse_id ? ' AND nurse_id = ?' : ''} GROUP BY list_status`, p),
    per_nurse: db.all("SELECT u.user_id, u.name, u.role, u.daily_capacity, (SELECT count(*) FROM worklist w WHERE w.nurse_id = u.user_id AND w.list_status = 'today' AND w.run_id = (SELECT MAX(run_id) FROM intelligence_run)) AS today, (SELECT count(*) FROM worklist w WHERE w.nurse_id = u.user_id AND w.list_status = 'queued' AND w.run_id = (SELECT MAX(run_id) FROM intelligence_run)) AS queued, (SELECT count(*) FROM task t WHERE t.assignee = u.user_id AND t.status = 'open') AS open_tasks, (SELECT count(*) FROM contact_attempt c WHERE c.nurse_id = u.user_id) AS calls FROM nurse_user u WHERE u.daily_capacity IS NOT NULL") };
}
module.exports = { worklist, tasks, analytics };
