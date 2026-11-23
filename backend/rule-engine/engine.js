/**
 * Care Intelligence engine (CCC Rulebook · T2D and Hypertension, 20 Nov 2026).
 * One run = for every member in member_longitudinal:
 *   1 risk components C M K U A from risk_score_band (caps from the table) → total → tier (rule_tier)
 *   2 every trigger in rule_trigger evaluated with rule_condition → fired / cannot_tell / not_fired + evidence
 *   3 safety flag, alert colour (rule_condition type alert) and contact priority (rule_contact_priority)
 *   4 campaign ownership (highest-priority live campaign; business campaigns keep only their triggers)
 *   5 care plan: one care_need per fired trigger; class order → rank → CURRENT 1-3 / NEXT 4-6 / FUTURE; needs whose trigger
 *     stopped firing close in claims; declined needs return after their hold
 *   6 one care-plan action per CURRENT need (next_best_action from rule_action) + one outreach (call by SLA or digital nudge)
 *   7 worklist: rule_queue_order, language match, nurse capacity and continuity
 * Every evaluation is written to member_rule_evaluation with the inputs it read. Nothing clinical is hard-coded here.
 */
const { Rules, num } = require('./rules');
const F = require('./features');
const U = require('../importers/util');
const cohorts = require('../services/cohorts');

const addDays = (iso, d) => { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
const fmt = x => x === null || x === undefined ? 'none on record' : (typeof x === 'number' ? (Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/\.?0+$/, '')) : String(x));

// ── 1 · risk scoring ───────────────────────────────────────────────────────
function bandMatches(b, v) {
  if (b.applies_feature) {
    if (b.applies_value === 'missing') { if (!b.applies_feature.split('+').every(f => v[f] === null || v[f] === undefined)) return false; }
    else if (String(v[b.applies_feature]) !== String(b.applies_value)) return false;
  }
  const x = v[b.feature];
  const lo = b.min === null || b.min === undefined || b.min === '' ? null : Number(b.min), hi = b.max === null || b.max === undefined || b.max === '' ? null : Number(b.max);
  switch (b.op) {
    case 'lt': return typeof x === 'number' && x < hi;
    case 'gte': return typeof x === 'number' && x >= lo;
    case 'between': return typeof x === 'number' && x >= lo && x <= hi;
    case 'eq': return typeof x === 'number' && x === lo;
    case 'text_eq': return x !== null && x !== undefined && String(x) === String(b.min);
    case 'not_null': return x !== null && x !== undefined;
    case 'count_capped': return typeof x === 'number' && x >= lo;
    default: return false;
  }
}
function bandPoints(b, v) { if (b.op === 'count_capped') return Math.min(Number(b.max), Math.floor(v[b.feature])) * Number(b.points); return Number(b.points); }
function scoreRisk(R, m) {
  const comps = {}, evals = [];
  for (const c of R.components) comps[c.component] = { raw: 0, cap: num(c.cap), name: c.name, extract_column: c.extract_column };
  for (const b of R.bands) {
    const inputs = [b.feature].concat(b.applies_feature ? b.applies_feature.split('+') : []);
    const values = Object.fromEntries(inputs.map(f => [f, m.raw[f] === undefined ? null : m.raw[f]]));
    const hit = bandMatches(b, m.v);
    const pts = hit ? bandPoints(b, m.v) : 0;
    if (hit) comps[b.component].raw += pts;
    evals.push({ rule_id: b.rule_id, rule_type: 'risk_points', input_features: inputs.join(','), input_values: values, logic: `${b.label}: ${b.feature} ${b.op} ${[b.min, b.max].filter(x => x !== null && x !== '').join('–')}`.trim(), result: hit ? 'scored' : 'not_fired', points: pts, evidence: hit ? `${b.label} → ${pts} point${pts === 1 ? '' : 's'} (${inputs.map(f => `${f} = ${fmt(m.raw[f])}`).join(', ')})` : null });
  }
  const score = {};
  for (const [k, c] of Object.entries(comps)) score[k] = Math.min(c.cap, c.raw);
  const total = Object.values(score).reduce((a, b) => a + b, 0);
  const tier = R.tier(total);
  const provisional = (m.v.Last_eGFR_Value === null || m.v.Last_eGFR_Value === undefined) && (m.v.Last_UACR_Value === null || m.v.Last_UACR_Value === undefined) ? 1 : 0;
  return { score, total, tier, provisional, evals, extract: { C: m.raw.Clinical_score, M: m.raw.Comorbid_complication_score, K: m.raw.Kidney_score, U: m.raw.Utilization_score, A: m.raw.Age_sex_score, total: m.raw.Total_risk_Score, tier: m.raw.Risk_tier } };
}

// ── 2 · triggers ───────────────────────────────────────────────────────────
function explain(conds, m) {
  return (conds || []).filter(c => !c.column_name.startsWith('cohort_')).map(c => {
    const raw = m.raw[c.column_name], days = m.v[c.column_name];
    const shown = raw === null || raw === undefined ? 'none on record' : (typeof days === 'number' && /date|visit|exam/.test(c.column_name) && typeof raw === 'string' ? `${raw} (${days} days before as-of)` : fmt(raw));
    return `${c.column_name} = ${shown}${c.op === 'is_null' || c.op === 'not_null' ? '' : ` (rule: ${c.op} ${c.value ?? ''})`}`;
  }).join('; ') || 'Rule matched';
}
function evaluateTriggers(R, m, variantSetting) {
  const out = [];
  for (const t of R.triggers) {
    const variant = R.variantFor(t, variantSetting);
    const conds = R.match('trigger', t.trigger_code, variant, m.v);
    const all = Object.values(R.conditions[`trigger|${t.trigger_code}|${variant}`] || {}).flat();
    const inputs = [...new Set(all.map(c => c.column_name))];
    const values = Object.fromEntries(inputs.map(f => [f, m.raw[f] === undefined ? null : m.raw[f]]));
    let result = 'not_fired', evidence = null;
    if (conds) { result = 'fired'; evidence = explain(conds, m); }
    else { const ct = R.match('cannot_tell', t.trigger_code, 'any', m.v); if (ct) { result = 'cannot_tell'; evidence = (ct[ct.length - 1].note) || 'Value missing in the extract'; } }
    const pathwayOk = !t.pathway || t.pathway.includes('·') || (t.pathway === 'T2D' ? m.v.cohort_t2d_l12m === 1 : t.pathway === 'HTN' ? m.v.cohort_htn_l12m === 1 : true);
    if (!pathwayOk && result === 'fired' && variant === 'extract') result = 'not_fired';
    const a = R.actions[t.trigger_code] || {};
    out.push({ trigger: t, variant, inputs, values, result, evidence, logic: `${t.fires_when_rulebook} [${variant}: ${Object.values(R.conditions[`trigger|${t.trigger_code}|${variant}`] || {}).map(g => g.map(c => `${c.column_name} ${c.op} ${c.value ?? ''}`).join(' AND ')).join(' OR ')}]`, action: a });
  }
  return out;
}

// ── 3 · safety, alert, priority ────────────────────────────────────────────
function assessAlert(R, m, firedCodes) {
  const w = { ...m.v, _fired_triggers: firedCodes.size };
  let colour = 'GREEN', rule = null, conds = null;
  for (const a of R.alerts) { if (a.colour === 'GREEN') continue; const c = R.match('alert', a.colour, 'any', w); if (c) { colour = a.colour; rule = a; conds = c; break; } }
  const safety = (m.v.Priority_clinical_review === 1 || m.v.flag_dka_l12m === 1 || m.v.flag_dm_hypoglycaemia_l12m === 1) ? 1 : 0;
  const pr = R.contactPriority(colour, firedCodes);
  const reasons = conds ? conds.map(c => c.column_name === '_fired_triggers' ? `${firedCodes.size} trigger(s) fired` : `${c.column_name} = ${fmt(m.raw[c.column_name])}`).join('; ') : (rule ? rule.criteria : 'At target, nothing open');
  return { colour, rule, reasons, safety, priority: pr.priority, sla: pr.sla_days === null || pr.sla_days === undefined ? null : num(pr.sla_days), channel: pr.channel };
}

// ── helpers for Layer D/E writes ───────────────────────────────────────────
function createAction(db, a) {
  const r = db.run('INSERT INTO action (member_id, need_id, kind, title, channel, owner_role, assignee, due_date, status, attempt, parent_action_id, source, run_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [a.member_id, a.need_id || null, a.kind, a.title, a.channel || null, a.owner_role || null, a.assignee || null, a.due_date || null, 'open', a.attempt || 1, a.parent_action_id || null, a.source || 'engine', a.run_id || null, U.now()]);
  const kindMap = { care_plan: 'nba', call: 'call', nudge: 'nudge', follow_up: 'follow_up', retry: 'call', escalation: 'escalation' };
  db.run('INSERT INTO task (action_id, member_id, title, task_kind, assignee, due_date, status, created_at) VALUES (?,?,?,?,?,?,?,?)', [r.lastId, a.member_id, a.title, kindMap[a.kind] || a.kind, a.assignee || null, a.due_date || null, 'open', U.now()]);
  return r.lastId;
}
function closeAction(db, actionId, status, when) {
  db.run('UPDATE action SET status = ?, closed_at = ? WHERE action_id = ? AND status = ?', [status, when || U.now(), actionId, 'open']);
  db.run("UPDATE task SET status = ?, completed_at = ? WHERE action_id = ? AND status = 'open'", [status === 'done' ? 'done' : status, when || U.now(), actionId]);
}
function gapEvent(db, need, to, by, evidence, runId) {
  if (need.gap_state === to) return;
  db.run('INSERT INTO care_gap_event (need_id, member_id, from_state, to_state, moved_by, evidence, run_id, recorded_at) VALUES (?,?,?,?,?,?,?,?)', [need.need_id, need.member_id, need.gap_state, to, by, evidence || null, runId || null, U.now()]);
}
/** Re-rank one member's open needs (class order, then trigger order), set slots, make sure every CURRENT need has one open action (G7). */
function reslot(db, R, memberId, runId, nurseId) {
  const open = db.all("SELECT * FROM care_need WHERE member_id = ? AND status = 'open' ORDER BY class_order, trigger_order", [memberId]);
  open.forEach((n, i) => db.run('UPDATE care_need SET rank = ?, slot = ? WHERE need_id = ?', [i + 1, R.slotFor(i + 1), n.need_id]));
  db.run("UPDATE care_need SET slot = 'CLOSED', rank = NULL WHERE member_id = ? AND status <> 'open'", [memberId]);
  if (!nurseId) { const r = db.get("SELECT assignee FROM action WHERE member_id = ? AND assignee IS NOT NULL AND status = 'open' ORDER BY created_at DESC LIMIT 1", [memberId]) || db.get('SELECT nurse_id AS assignee FROM member_assignment WHERE member_id = ?', [memberId]); nurseId = r ? r.assignee : null; }
  let made = 0;
  for (const n of db.all("SELECT * FROM care_need WHERE member_id = ? AND slot = 'CURRENT' AND status = 'open'", [memberId])) {
    const live = db.get("SELECT action_id FROM action WHERE need_id = ? AND kind IN ('care_plan','follow_up') AND status = 'open'", [n.need_id]);
    if (!live) { createAction(db, { member_id: memberId, need_id: n.need_id, kind: 'care_plan', title: n.next_best_action, channel: 'Call', owner_role: n.action_owner, assignee: nurseId, due_date: n.due_date, source: 'engine', run_id: runId }); made++; }
  }
  return made;
}

// ── the run ────────────────────────────────────────────────────────────────
function run(db, { triggeredBy = 'api', memberIds = null } = {}) {
  const R = new Rules(db);
  const setting = k => (db.get('SELECT value FROM app_setting WHERE key = ?', [k]) || {}).value;
  const runDate = setting('run_date'), asOf = setting('as_of_date'), variant = setting('trigger_variant') || 'rulebook';
  const started = U.now();
  const runId = db.run('INSERT INTO intelligence_run (rule_version, trigger_variant, run_date, as_of_date, started_at, triggered_by) VALUES (?,?,?,?,?,?)', [R.version, variant, runDate, asOf, started, triggeredBy]).lastId;
  const members = F.loadMembers(db, asOf).filter(m => !memberIds || memberIds.includes(m.member_id));
  const stats = { members: members.length, fired: 0, cannot_tell: 0, needs_opened: 0, needs_closed_in_claims: 0, actions: 0, matches_extract: 0 };
  const nurses = db.all("SELECT * FROM nurse_user WHERE active = 1 AND daily_capacity IS NOT NULL");
  const load = Object.fromEntries(nurses.map(n => [n.user_id, db.get("SELECT count(*) AS n FROM action WHERE assignee = ? AND status = 'open'", [n.user_id]).n]));

  // 4 · campaign ownership
  const owner = new Map();
  db.run('DELETE FROM campaign_member WHERE run_id = ?', [runId]);
  for (const c of db.all("SELECT * FROM campaign WHERE status = 'Live' ORDER BY priority")) {
    const keep = c.mode === 'business' && c.triggers_json ? new Set(JSON.parse(c.triggers_json)) : null;
    for (const mid of cohorts.campaignMembers(db, c.campaign_id)) if (!owner.has(mid)) { owner.set(mid, { campaign: c, keep }); db.run('INSERT OR IGNORE INTO campaign_member VALUES (?,?,?,0)', [runId, c.campaign_id, mid]); }
  }
  stats.campaign_members = owner.size;

  db.begin();
  const insEval = db.prepare('INSERT INTO member_rule_evaluation (run_id, member_id, rule_id, rule_type, rule_version, input_features, input_values_json, evaluation_logic, evaluation_result, points_awarded, clinical_evidence, priority, alert_colour, next_best_action, action_owner, done_when, evaluated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const insRisk = db.prepare('INSERT OR REPLACE INTO member_risk_result VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const insAlert = db.prepare('INSERT OR REPLACE INTO member_alert VALUES (?,?,?,?,?,?,?)');
  const perMember = new Map();
  for (const m of members) {
    const risk = scoreRisk(R, m);
    const trig = evaluateTriggers(R, m, variant);
    const fired = new Set(trig.filter(t => t.result === 'fired').map(t => t.trigger.trigger_code));
    const al = assessAlert(R, m, fired);
    const pathway = m.v.cohort_t2d_l12m === 1 && m.v.cohort_htn_l12m === 1 ? 'T2D·HTN' : m.v.cohort_t2d_l12m === 1 ? 'T2D' : m.v.cohort_htn_l12m === 1 ? 'HTN' : 'none';
    const match = Number(risk.extract.total) === risk.total ? 1 : 0; stats.matches_extract += match;
    insRisk([runId, m.member_id, R.version, risk.score.C, risk.score.M, risk.score.K, risk.score.U, risk.score.A, risk.total, risk.tier.tier, risk.tier.label, risk.provisional, al.safety, pathway,
      num(risk.extract.C), num(risk.extract.M), num(risk.extract.K), num(risk.extract.U), num(risk.extract.A), num(risk.extract.total), risk.extract.tier, match, started]);
    for (const e of risk.evals) if (e.result === 'scored') insEval([runId, m.member_id, e.rule_id, 'risk_points', R.version, e.input_features, JSON.stringify(e.input_values), e.logic, e.result, e.points, e.evidence, null, null, null, null, null, started]);
    for (const t of trig) {
      if (t.result === 'fired') stats.fired++; else if (t.result === 'cannot_tell') stats.cannot_tell++;
      insEval([runId, m.member_id, t.trigger.trigger_code, 'trigger', R.version, t.inputs.join(','), JSON.stringify(t.values), t.logic, t.result, null, t.evidence, al.priority, al.colour, t.action.title || null, t.action.owner_role || null, t.action.done_when || null, started]);
    }
    insEval([runId, m.member_id, 'ALERT-' + al.colour, 'alert', R.version, al.rule ? null : null, JSON.stringify({ fired_triggers: fired.size }), al.rule ? al.rule.criteria : 'At target, nothing open', 'fired', null, al.reasons, al.priority, al.colour, null, null, null, started]);
    insAlert([runId, m.member_id, al.colour, 'ALERT-' + al.colour, al.priority, al.sla, al.reasons]);
    perMember.set(m.member_id, { m, risk, trig, fired, al, pathway });
  }
  insEval.free(); insRisk.free(); insAlert.free();

  // 5 · care plans and needs, only for members a live campaign owns
  for (const [mid, { campaign, keep }] of owner) {
    const x = perMember.get(mid); if (!x) continue;
    const firedKept = new Set([...x.fired].filter(c => !keep || keep.has(c)));
    const cpid = 'CP-' + mid;
    const cadence = x.risk.tier.cadence;
    if (db.get('SELECT 1 FROM care_plan WHERE care_plan_id = ?', [cpid])) db.run('UPDATE care_plan SET pathway = ?, tier = ?, cadence = ?, updated_run_id = ?, updated_at = ? WHERE care_plan_id = ?', [x.pathway, x.risk.tier.tier, cadence, runId, U.now(), cpid]);
    else db.run('INSERT INTO care_plan (care_plan_id, member_id, pathway, tier, cadence, status, created_run_id, updated_run_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)', [cpid, mid, x.pathway, x.risk.tier.tier, cadence, 'active', runId, runId, U.now(), U.now()]);
    for (const t of x.trig) {
      if (t.result !== 'fired' || !firedKept.has(t.trigger.trigger_code)) continue;
      const cls = R.classIndex[t.trigger.class];
      const due = addDays(runDate, num(cls.due_days) || 0);
      const nid = `N-${mid}-${t.trigger.trigger_code}`;
      const need = db.get('SELECT * FROM care_need WHERE need_id = ?', [nid]);
      const evalId = db.get('SELECT evaluation_id FROM member_rule_evaluation WHERE run_id = ? AND member_id = ? AND rule_id = ?', [runId, mid, t.trigger.trigger_code]).evaluation_id;
      if (!need) {
        db.run('INSERT INTO care_need (need_id, care_plan_id, member_id, trigger_code, need_class, class_order, trigger_order, slot, status, gap_state, due_date, evidence, next_best_action, action_owner, done_when, action_code, opened_run_id, opened_at, last_evaluation_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [nid, cpid, mid, t.trigger.trigger_code, t.trigger.class, num(cls.sort_order), num(t.trigger.sort_order), 'FUTURE', 'open', 'Potential', due, t.evidence, t.action.title, t.action.owner_role, t.action.done_when, t.action.action_code, runId, U.now(), evalId]);
        db.run('INSERT INTO care_gap_event (need_id, member_id, from_state, to_state, moved_by, evidence, run_id, recorded_at) VALUES (?,?,?,?,?,?,?,?)', [nid, mid, null, 'Potential', 'engine', t.evidence, runId, U.now()]);
        stats.needs_opened++;
      } else if (need.status === 'declined' && need.hold_until && need.hold_until <= runDate) {      // G4: back after the 90-day hold
        db.run("UPDATE care_need SET status = 'open', hold_until = NULL, gap_state = 'Potential', due_date = ?, evidence = ?, last_evaluation_id = ? WHERE need_id = ?", [due, t.evidence, evalId, nid]);
        gapEvent(db, need, 'Potential', 'engine', 'Hold expired; trigger still fires', runId);
      } else if (need.status === 'open') db.run('UPDATE care_need SET evidence = ?, last_evaluation_id = ? WHERE need_id = ?', [t.evidence, evalId, nid]);
      // done needs stay done (G9)
    }
    // needs whose trigger no longer fires were met in claims → Closed (the only way a gap closes)
    for (const n of db.all("SELECT * FROM care_need WHERE member_id = ? AND (status = 'open' OR gap_state = 'Reported')", [mid])) {
      if (x.fired.has(n.trigger_code)) continue;
      gapEvent(db, n, 'Closed', 'claims', 'Trigger no longer fires in the latest extract', runId);
      db.run("UPDATE care_need SET status = 'done', slot = 'CLOSED', gap_state = 'Closed', closed_at = ? WHERE need_id = ?", [U.now(), n.need_id]);
      for (const a of db.all("SELECT action_id FROM action WHERE need_id = ? AND status = 'open'", [n.need_id])) closeAction(db, a.action_id, 'done');
      stats.needs_closed_in_claims++;
    }
    // nurse: continuity first, then language match, then lightest load
    let nurse = (db.get("SELECT assignee FROM action WHERE member_id = ? AND assignee IS NOT NULL AND status = 'open' ORDER BY created_at DESC LIMIT 1", [mid]) || {}).assignee;
    if (!nurse) {
      const lang = String(x.m.raw.NATIONALITY || '').toUpperCase();
      const prefer = ['EMIRATI', 'SAUDI', 'OMANI', 'EGYPTIAN', 'JORDANIAN', 'SYRIAN', 'LEBANESE', 'PALESTINIAN', 'SUDANESE', 'YEMENI', 'IRAQI'].includes(lang) ? 'Arabic' : 'English';
      const cands = nurses.filter(n => (n.languages || '').includes(prefer));
      nurse = (cands.length ? cands : nurses).sort((a, b) => load[a.user_id] - load[b.user_id])[0].user_id;
      db.run('INSERT OR REPLACE INTO member_assignment VALUES (?,?,?,?)', [mid, nurse, U.now(), 'engine']);
    }
    let made = reslot(db, R, mid, runId, nurse);
    // 6 · one outreach per member: a call by SLA (P1 today, P2 next day, P3 in 3 days) or a digital nudge (P4)
    const hasCurrent = db.get("SELECT 1 FROM care_need WHERE member_id = ? AND slot = 'CURRENT' AND status = 'open'", [mid]);
    const openContact = db.get("SELECT 1 FROM action WHERE member_id = ? AND kind IN ('call','nudge','retry','follow_up') AND status = 'open'", [mid]);
    const recent = db.get("SELECT 1 FROM contact_attempt WHERE member_id = ? AND reached = 1 AND julianday(?) - julianday(started_at) < 14", [mid, runDate]);
    if (hasCurrent && !openContact && !recent) {
      const top = db.get("SELECT * FROM care_need WHERE member_id = ? AND slot = 'CURRENT' AND status = 'open' ORDER BY rank LIMIT 1", [mid]);
      if (x.al.sla === null) createAction(db, { member_id: mid, kind: 'nudge', title: `Digital nudge: ${top.next_best_action}`, channel: 'App / WhatsApp', assignee: nurse, due_date: addDays(runDate, 7), source: 'engine', run_id: runId });
      else createAction(db, { member_id: mid, kind: 'call', title: `${x.al.priority} call: ${R.triggers.find(t => t.trigger_code === top.trigger_code).name}`, channel: 'Call', assignee: nurse, due_date: addDays(runDate, x.al.sla), source: 'engine', run_id: runId });
      made++;
    }
    load[nurse] = (load[nurse] || 0) + made; stats.actions += made;
  }

  // 7 · worklist
  db.run('DELETE FROM worklist WHERE run_id <> ?', [runId]);
  const rows = db.all(`SELECT a.member_id, a.action_id, a.assignee, a.due_date, a.kind, r.tier, r.safety_flag, al.alert_colour, al.contact_priority, al.sla_days, cm.campaign_id, c.priority AS campaign_priority
    FROM action a JOIN member_risk_result r ON r.member_id = a.member_id AND r.run_id = ? JOIN member_alert al ON al.member_id = a.member_id AND al.run_id = ?
    LEFT JOIN campaign_member cm ON cm.member_id = a.member_id AND cm.run_id = ? LEFT JOIN campaign c ON c.campaign_id = cm.campaign_id
    WHERE a.status = 'open' AND a.kind IN ('call','retry','nudge','follow_up','escalation') AND a.action_id = (SELECT MIN(action_id) FROM action b WHERE b.member_id = a.member_id AND b.status = 'open' AND b.kind IN ('call','retry','nudge','follow_up','escalation'))`, [runId, runId, runId]);
  const hoursPast = r => (Date.parse(runDate) - Date.parse(r.due_date || runDate)) / 3600000;
  rows.sort((a, b) => (b.safety_flag || b.alert_colour === 'RED' ? 1 : 0) - (a.safety_flag || a.alert_colour === 'RED' ? 1 : 0) || b.tier - a.tier || (a.campaign_priority || 9) - (b.campaign_priority || 9) || hoursPast(b) - hoursPast(a) || a.member_id.localeCompare(b.member_id));
  const perNurse = {};
  const cap = Object.fromEntries(nurses.map(n => [n.user_id, n.daily_capacity]));
  const insW = db.prepare('INSERT OR REPLACE INTO worklist VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  rows.forEach((r, i) => {
    perNurse[r.assignee] = (perNurse[r.assignee] || 0) + 1;
    // each nurse works the queue in rule order up to daily capacity; follow-ups wait for their date
    const status = r.kind === 'nudge' ? 'nudge' : (r.kind === 'follow_up' && (r.due_date || runDate) > runDate) ? 'scheduled' : (perNurse[r.assignee] <= (cap[r.assignee] || 25) ? 'today' : 'queued');
    if (status === 'scheduled') perNurse[r.assignee]--;
    const needs = db.all("SELECT n.trigger_code, t.name FROM care_need n JOIN rule_trigger t ON t.trigger_code = n.trigger_code WHERE n.member_id = ? AND n.slot = 'CURRENT' AND n.status = 'open' ORDER BY n.rank", [r.member_id]).map(n => n.name).join(' · ');
    insW([runId, r.member_id, r.assignee, i + 1, perNurse[r.assignee], status, r.contact_priority, r.alert_colour, r.tier, r.safety_flag, r.campaign_id, r.action_id, r.due_date, needs]);
  });
  insW.free();
  stats.worklist_members = rows.length;
  db.commit();
  db.run('UPDATE intelligence_run SET finished_at = ?, members_evaluated = ?, stats_json = ? WHERE run_id = ?', [U.now(), members.length, JSON.stringify(stats), runId]);
  db.run('INSERT INTO audit_event (at, actor, operation, entity, detail, endpoint) VALUES (?,?,?,?,?,?)', [U.now(), triggeredBy, 'WRITE', 'intelligence_run', `run ${runId}: ${JSON.stringify(stats)}`, '/api/intelligence/runs']);
  return { run_id: runId, ...stats };
}

/** Evaluate one member without writing anything (used by the "explain" endpoints). */
function preview(db, memberId) {
  const R = new Rules(db);
  const setting = k => (db.get('SELECT value FROM app_setting WHERE key = ?', [k]) || {}).value;
  const m = F.loadMember(db, memberId, setting('as_of_date'));
  if (!m) return null;
  const risk = scoreRisk(R, m), trig = evaluateTriggers(R, m, setting('trigger_variant') || 'rulebook');
  const fired = new Set(trig.filter(t => t.result === 'fired').map(t => t.trigger.trigger_code));
  return { member_id: memberId, risk, triggers: trig, alert: assessAlert(R, m, fired), dropped: m.dropped };
}

module.exports = { run, preview, reslot, createAction, closeAction, gapEvent, addDays, scoreRisk, evaluateTriggers, assessAlert };
