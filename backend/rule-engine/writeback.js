/**
 * Data flow C · portal write-back. Every nurse input becomes an event row (Layer E) and is applied at once through
 * rule_writeback (rulebook §5), so the nurse sees the next need promoted; the next intelligence run re-scores on top.
 *   consent   → consent_event (G2: nothing clinical renders before 'granted')
 *   call      → contact_attempt (+ call_interaction when reached); not reached → retry rule (3 attempts, P1 escalates)
 *   assertion → member_assertion (never closes a gap by itself)
 *   outcome   → disposition_event on a need/action → rule_writeback: done → Reported + "Verify in claims"; agreed → Scheduled + "Check it happened";
 *               declined → 90-day hold + re-offer; carried → stays CURRENT; the freed CURRENT slot promotes the next need
 */
const { Rules, num } = require('./rules');
const E = require('./engine');
const U = require('../importers/util');

const runDate = db => db.get("SELECT value FROM app_setting WHERE key='run_date'").value;
const assert = (c, msg) => { if (!c) { const e = new Error(msg); e.status = 400; throw e; } };

function recordConsent(db, { member_id, consent_status, nurse_id, call_id, scope = 'outreach', duration_seconds, note }) {
  assert(['granted', 'declined', 'withdrawn', 'pending'].includes(consent_status), 'consent_status must be granted | declined | withdrawn | pending');
  const id = db.run('INSERT INTO consent_event (member_id, call_id, nurse_id, consent_status, scope, recorded_at, duration_seconds, note) VALUES (?,?,?,?,?,?,?,?)', [member_id, call_id || null, nurse_id || null, consent_status, scope, U.now(), duration_seconds || null, note || null]).lastId;
  if (consent_status === 'declined' || consent_status === 'withdrawn') {       // G1c: declined consent removes the member from outreach
    for (const a of db.all("SELECT action_id FROM action WHERE member_id = ? AND status = 'open' AND kind IN ('call','nudge','retry','follow_up')", [member_id])) E.closeAction(db, a.action_id, 'cancelled');
  }
  audit(db, nurse_id, 'consent_event', `${member_id}: ${consent_status}`);
  return { consent_event_id: id, consent_status };
}
function consentStatus(db, memberId) { const r = db.get('SELECT consent_status, recorded_at FROM consent_event WHERE member_id = ? ORDER BY recorded_at DESC, consent_event_id DESC LIMIT 1', [memberId]); return r ? r.consent_status : 'pending'; }

function recordCall(db, { member_id, nurse_id, action_id, campaign_id, reached, result, response, notes, red_flag }) {
  const R = new Rules(db);
  const attempt = db.run('INSERT INTO contact_attempt (member_id, nurse_id, action_id, campaign_id, channel, started_at, ended_at, reached, result) VALUES (?,?,?,?,?,?,?,?,?)', [member_id, nurse_id || null, action_id || null, campaign_id || null, 'call', U.now(), U.now(), reached ? 1 : 0, result || (reached ? 'reached' : 'no_answer')]).lastId;
  let call_id = null, created = [];
  if (reached) {
    call_id = db.run('INSERT INTO call_interaction (attempt_id, member_id, nurse_id, stage, red_flag, response, notes, started_at) VALUES (?,?,?,?,?,?,?,?)', [attempt, member_id, nurse_id || null, 'consent', red_flag ? 1 : 0, response || null, notes || null, U.now()]).lastId;
    // a reached call closes the open outreach and schedules the next cadence check-in
    const open = db.get("SELECT * FROM action WHERE member_id = ? AND kind IN ('call','retry','nudge') AND status = 'open' ORDER BY due_date LIMIT 1", [member_id]);
    if (open) {
      E.closeAction(db, open.action_id, 'done');
      db.run('INSERT INTO disposition_event (member_id, action_id, call_id, outcome, recorded_by, recorded_at, processed_at) VALUES (?,?,?,?,?,?,?)', [member_id, open.action_id, call_id, 'reached', nurse_id || null, U.now(), U.now()]);
      const tier = (db.get('SELECT tier FROM member_risk_result WHERE member_id = ? ORDER BY run_id DESC LIMIT 1', [member_id]) || {}).tier || 2;
      const steps = R.cadence.filter(c => num(c.tier) === tier).map(c => num(c.day_offset)).filter(d => d > 0).sort((a, b) => a - b);
      const next = steps.length ? steps[0] : 14;
      created.push(E.createAction(db, { member_id, kind: 'follow_up', title: 'Cadence check-in', channel: 'Call', assignee: open.assignee || nurse_id, due_date: E.addDays(runDate(db), next), parent_action_id: open.action_id, source: 'followup' }));
    }
    if (red_flag) created.push(E.createAction(db, { member_id, kind: 'escalation', title: 'RED flag on the call: same-day clinician review (script stopped)', channel: 'Call', owner_role: 'Clinical lead', assignee: 'U-0310', due_date: runDate(db), source: 'followup' }));
  } else {
    const wb = R.writeback.not_reached || {};
    const cap = num(wb.max_attempts) || 3, after = num(wb.retry_after_days) || 1;
    const tries = db.get("SELECT count(*) AS n FROM contact_attempt WHERE member_id = ? AND reached = 0", [member_id]).n;
    const open = db.get("SELECT * FROM action WHERE member_id = ? AND kind IN ('call','retry') AND status = 'open' ORDER BY due_date LIMIT 1", [member_id]);
    if (open) E.closeAction(db, open.action_id, 'done');
    db.run('INSERT INTO disposition_event (member_id, action_id, outcome, recorded_by, recorded_at, processed_at) VALUES (?,?,?,?,?,?)', [member_id, open ? open.action_id : null, 'not_reached', nurse_id || null, U.now(), U.now()]);
    const pr = (db.get('SELECT contact_priority FROM member_alert WHERE member_id = ? ORDER BY run_id DESC LIMIT 1', [member_id]) || {}).contact_priority;
    if (tries < cap) created.push(E.createAction(db, { member_id, kind: 'retry', title: `Retry call (attempt ${tries + 1} of ${cap})`, channel: 'Call', assignee: (open && open.assignee) || nurse_id, due_date: E.addDays(runDate(db), after), attempt: tries + 1, parent_action_id: open ? open.action_id : null, source: 'followup' }));
    else if (pr === 'P1') created.push(E.createAction(db, { member_id, kind: 'escalation', title: `P1 member not reached after ${cap} attempts: clinical lead to decide`, channel: 'Call', owner_role: 'Clinical lead', assignee: 'U-0310', due_date: runDate(db), parent_action_id: open ? open.action_id : null, source: 'followup' }));
  }
  audit(db, nurse_id, 'contact_attempt', `${member_id}: ${reached ? 'reached' : 'not reached'}`);
  return { attempt_id: attempt, call_id, created_actions: created };
}
function setCallStage(db, callId, stage) { db.run('UPDATE call_interaction SET stage = ?, ended_at = CASE WHEN ? = ? THEN ? ELSE ended_at END WHERE call_id = ?', [stage, stage, 'closed', U.now(), callId]); }

function recordAssertion(db, { member_id, need_id, call_id, assertion_text, nurse_id }) {
  assert(assertion_text, 'assertion_text is required');
  const id = db.run('INSERT INTO member_assertion (member_id, call_id, need_id, assertion_text, recorded_by, recorded_at) VALUES (?,?,?,?,?,?)', [member_id, call_id || null, need_id || null, assertion_text, nurse_id || null, U.now()]).lastId;
  if (need_id) { const n = db.get('SELECT * FROM care_need WHERE need_id = ?', [need_id]); if (n && n.gap_state === 'Potential') { E.gapEvent(db, n, 'Verified', 'nurse:' + (nurse_id || '?'), assertion_text); db.run("UPDATE care_need SET gap_state = 'Verified' WHERE need_id = ?", [need_id]); } }
  return { assertion_id: id };
}

/** The nurse's decision on a need or an action. outcome ∈ rule_writeback.outcome (done | declined | not_reached | carried | agreed). */
function recordOutcome(db, { member_id, need_id, action_id, call_id, outcome, note, nurse_id }) {
  const R = new Rules(db);
  const rule = R.writeback[outcome];
  assert(rule, `outcome must be one of ${Object.keys(R.writeback).join(' | ')}`);
  let action = action_id ? db.get('SELECT * FROM action WHERE action_id = ?', [action_id]) : null;
  let need = need_id ? db.get('SELECT * FROM care_need WHERE need_id = ?', [need_id]) : (action && action.need_id ? db.get('SELECT * FROM care_need WHERE need_id = ?', [action.need_id]) : null);
  if (!action && need) action = db.get("SELECT * FROM action WHERE need_id = ? AND status = 'open' ORDER BY action_id DESC LIMIT 1", [need.need_id]);
  assert(need || action, 'need_id or action_id is required');
  member_id = member_id || (need || action).member_id;
  const by = nurse_id || null, today = runDate(db);
  const disp = db.run('INSERT INTO disposition_event (member_id, need_id, action_id, call_id, outcome, note, recorded_by, recorded_at, processed_at) VALUES (?,?,?,?,?,?,?,?,?)', [member_id, need ? need.need_id : null, action ? action.action_id : null, call_id || null, outcome, note || null, by, U.now(), U.now()]).lastId;
  const created = [];
  if (need) {
    const sets = [], args = [];
    if (rule.need_status) { sets.push('status = ?'); args.push(rule.need_status); }
    if (rule.need_slot) { sets.push('slot = ?'); args.push(rule.need_slot); }
    if (rule.gap_state) { sets.push('gap_state = ?'); args.push(rule.gap_state); E.gapEvent(db, need, rule.gap_state, 'nurse:' + (by || '?'), note || outcome); }
    if (rule.hold_days) { sets.push('hold_until = ?'); args.push(E.addDays(today, num(rule.hold_days))); }
    if (rule.need_status && rule.need_status !== 'open') { sets.push('closed_at = ?'); args.push(U.now()); }
    if (sets.length) db.run(`UPDATE care_need SET ${sets.join(', ')} WHERE need_id = ?`, [...args, need.need_id]);
  }
  if (action && rule.action_status && rule.action_status !== 'open') E.closeAction(db, action.action_id, rule.action_status);
  if (action && outcome === 'agreed') db.run('UPDATE action SET agreed = 1 WHERE action_id = ?', [action.action_id]);
  const assignee = (action && action.assignee) || by;
  // follow-ups the rulebook asks for
  if (outcome === 'done' && need) created.push(E.createAction(db, { member_id, need_id: need.need_id, kind: 'follow_up', title: `Verify in claims: ${need.done_when}`, channel: 'Claims', owner_role: 'Coordinator', assignee, due_date: E.addDays(today, 14), parent_action_id: action ? action.action_id : null, source: 'followup' }));
  if (outcome === 'agreed' && need) created.push(E.createAction(db, { member_id, need_id: need.need_id, kind: 'follow_up', title: `Check it happened: ${need.done_when}`, channel: 'Call', owner_role: need.action_owner, assignee, due_date: need.due_date || E.addDays(today, 7), parent_action_id: action ? action.action_id : null, source: 'followup' }));
  if (outcome === 'declined' && need) created.push(E.createAction(db, { member_id, need_id: need.need_id, kind: 'follow_up', title: `Re-offer: ${need.next_best_action}`, channel: 'Call', owner_role: need.action_owner, assignee, due_date: E.addDays(today, num(rule.hold_days) || 90), parent_action_id: action ? action.action_id : null, source: 'followup' }));
  // promote the next need into CURRENT (G7: one action per CURRENT need)
  if (num(rule.promote_next)) E.reslot(db, R, member_id, null, assignee);
  audit(db, by, 'disposition_event', `${member_id}: ${outcome}${need ? ' on ' + need.trigger_code : ''}`);
  return { disposition_id: disp, created_actions: created, need: need ? db.get('SELECT * FROM care_need WHERE need_id = ?', [need.need_id]) : null };
}

function completeTask(db, taskId, { nurse_id, booking_date, note }) {
  const t = db.get('SELECT * FROM task WHERE task_id = ?', [taskId]); assert(t, 'task not found');
  if (booking_date) { db.run('UPDATE task SET booking_date = ? WHERE task_id = ?', [booking_date, taskId]); const a = db.get('SELECT * FROM action WHERE action_id = ?', [t.action_id]); if (a && a.need_id) { db.run('INSERT INTO appointment (member_id, need_id, action_id, appointment_type, scheduled_date, status, booked_by, booked_at) VALUES (?,?,?,?,?,?,?,?)', [t.member_id, a.need_id, a.action_id, 'booking', booking_date, 'booked', nurse_id || null, U.now()]); const n = db.get('SELECT * FROM care_need WHERE need_id = ?', [a.need_id]); if (n && ['Potential', 'Verified'].includes(n.gap_state)) { E.gapEvent(db, n, 'Scheduled', 'nurse:' + (nurse_id || '?'), 'Booked for ' + booking_date); db.run("UPDATE care_need SET gap_state = 'Scheduled' WHERE need_id = ?", [a.need_id]); } } return { task: db.get('SELECT * FROM task WHERE task_id = ?', [taskId]) }; }
  if (t.action_id) { const a = db.get('SELECT * FROM action WHERE action_id = ?', [t.action_id]); if (a && a.need_id && a.kind === 'care_plan') return recordOutcome(db, { member_id: t.member_id, action_id: a.action_id, outcome: 'done', nurse_id, note }); E.closeAction(db, t.action_id, 'done'); }
  else db.run("UPDATE task SET status = 'done', completed_at = ? WHERE task_id = ?", [U.now(), taskId]);
  audit(db, nurse_id, 'task', `${t.member_id}: task ${taskId} done`);
  return { task: db.get('SELECT * FROM task WHERE task_id = ?', [taskId]) };
}
function audit(db, actor, entity, detail) { db.run('INSERT INTO audit_event (at, actor, operation, entity, detail, endpoint) VALUES (?,?,?,?,?,?)', [U.now(), actor || 'portal', 'WRITE', entity, detail, '/api/portal']); }

module.exports = { recordConsent, consentStatus, recordCall, setCallStage, recordAssertion, recordOutcome, completeTask };
