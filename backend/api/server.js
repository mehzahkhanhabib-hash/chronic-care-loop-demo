/**
 * Express REST API · http://localhost:4000/api
 * One process, two SQLite files (claims.sqlite read-only for Member 360; ccl.sqlite for intelligence and operations).
 * Routes are grouped: members (Member 360 from raw claims), intelligence (care intelligence), studio (cohorts/campaigns/runs),
 * portal (worklist, consent, calls, outcomes, tasks), rules, meta. Full reference: docs/api/API.md
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { openDatabase, exists } = require('../database/adapter');
const M360 = require('../services/member360');
const I = require('../services/intelligence');
const P = require('../services/portal');
const C = require('../services/cohorts');
const E = require('../rule-engine/engine');
const W = require('../rule-engine/writeback');

const PORT = Number(process.env.PORT || 4000);
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

let claims, ccl;
const asOf = () => (ccl.get("SELECT value FROM app_setting WHERE key='as_of_date'") || {}).value;
const wrap = fn => (req, res) => { try { const out = fn(req, res); if (out === undefined) return; if (out === null) return res.status(404).json({ error: 'not found' }); res.json(out); } catch (e) { console.error(e); res.status(e.status || 500).json({ error: e.message }); } };
const member = id => { const x = ccl.get('SELECT * FROM member_identifier_crosswalk WHERE member_id = ?', [id]); if (!x) { const e = new Error(`member ${id} not found`); e.status = 404; throw e; } return x; };
/** Next id in the seed series: COH-0101 … → COH-0106. */
const nextId = (table, col, prefix) => { const n = ccl.all(`SELECT ${col} AS id FROM ${table}`).map(r => Number(String(r.id).replace(prefix, ''))).filter(Number.isFinite); return prefix + String(Math.max(100, ...n) + 1).padStart(4, '0'); };
const audit = (req, entity, detail) => ccl.run('INSERT INTO audit_event (at, actor, operation, entity, detail, endpoint) VALUES (datetime("now"),?,?,?,?,?)', [req.get('x-user') || 'anonymous', req.method === 'GET' ? 'READ' : 'WRITE', entity, detail, req.path]);

// ── meta ──
app.get('/api/health', wrap(() => ({ ok: true, run_date: ccl.get("SELECT value FROM app_setting WHERE key='run_date'").value, as_of: asOf(), rule_version: ccl.get('SELECT rule_version FROM rule_version').rule_version, latest_run: I.latestRun(ccl), members: ccl.count('member_longitudinal'), claims: claims.count('claim'), lab_observations: claims.count('lab_observation') })));
app.get('/api/schema', wrap(() => ({ claims: claims.tables().map(t => ({ ...t, columns: claims.columns(t.name).map(c => ({ name: c.name, type: c.type, pk: c.pk })) })), ccl: ccl.tables().map(t => ({ ...t, columns: ccl.columns(t.name).map(c => ({ name: c.name, type: c.type, pk: c.pk })) })) })));
app.get('/api/lineage', wrap(() => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'mappings', 'lineage.json'), 'utf8'))));
app.get('/api/settings', wrap(() => Object.fromEntries(ccl.all('SELECT key, value FROM app_setting').map(r => [r.key, r.value]))));
app.get('/api/audit', wrap(req => ccl.all('SELECT * FROM audit_event ORDER BY audit_id DESC LIMIT ?', [Number(req.query.limit || 100)])));

// ── auth (local demo only) ──
app.post('/api/auth/login', wrap((req, res) => { const { username, pin } = req.body || {}; const u = ccl.get('SELECT user_id, username, name, role, languages, daily_capacity FROM nurse_user WHERE username = ? AND pin = ? AND active = 1', [String(username || '').toLowerCase(), String(pin || '')]); if (!u) { res.status(401).json({ error: 'Unknown user or PIN. Demo accounts: nadia, omar, sara, layla, rana · PIN 1234' }); return; } return { user: u, token: 'demo-' + u.user_id }; }));
app.get('/api/users', wrap(() => ccl.all('SELECT user_id, username, name, role, languages, daily_capacity FROM nurse_user WHERE active = 1')));

// ── members · Member 360 (raw claims) ──
app.get('/api/members', wrap(req => I.members(ccl, req.query)));
app.get('/api/members/:id', wrap(req => { member(req.params.id); const id = req.params.id; return { identity: I.identity(ccl, id), member360: M360.summary(claims, id, asOf()), risk: I.risk(ccl, id), consent_status: W.consentStatus(ccl, id), assignment: ccl.get('SELECT a.*, u.name AS nurse_name FROM member_assignment a LEFT JOIN nurse_user u ON u.user_id = a.nurse_id WHERE a.member_id = ?', [id]), worklist: ccl.get('SELECT * FROM worklist WHERE member_id = ? ORDER BY run_id DESC LIMIT 1', [id]), care_plan: I.carePlan(ccl, id) }; }));
app.get('/api/members/:id/360', wrap(req => { member(req.params.id); const id = req.params.id; return { member: M360.member(claims, id), identity: I.identity(ccl, id), policies: M360.policies(claims, id), conditions: M360.conditions(claims, id), utilisation: M360.utilisation(claims, id, asOf()), admissions: M360.encounters(claims, id, { type: 'IP' }), ed_visits: M360.encounters(claims, id, { type: 'ED' }), labs: M360.labSeries(claims, id), medications: M360.medications(claims, id), procedures: M360.procedures(claims, id, 100), providers: M360.providers(claims, id), clinicians: M360.clinicians(claims, id), costs: M360.costs(claims, id), source: 'claims.sqlite (Raw_Claims_250_Members_Part_1..3_of_3.xlsx)' }; }));
app.get('/api/members/:id/claims', wrap(req => { member(req.params.id); return M360.claimsList(claims, req.params.id, { from: req.query.from, to: req.query.to, limit: Number(req.query.limit || 200), offset: Number(req.query.offset || 0) }); }));
app.get('/api/claims/:claimId', wrap(req => M360.claimDetail(claims, req.params.claimId)));
app.get('/api/members/:id/encounters', wrap(req => { member(req.params.id); return M360.encounters(claims, req.params.id, { type: req.query.type, limit: Number(req.query.limit || 500) }); }));
app.get('/api/members/:id/labs', wrap(req => { member(req.params.id); return req.query.series ? M360.labSeries(claims, req.params.id) : M360.labs(claims, req.params.id, { code: req.query.code }); }));
app.get('/api/members/:id/medications', wrap(req => { member(req.params.id); return req.query.generic ? M360.medicationFills(claims, req.params.id, req.query.generic) : M360.medications(claims, req.params.id); }));
app.get('/api/members/:id/procedures', wrap(req => { member(req.params.id); return M360.procedures(claims, req.params.id); }));
app.get('/api/members/:id/providers', wrap(req => { member(req.params.id); return { facilities: M360.providers(claims, req.params.id), clinicians: M360.clinicians(claims, req.params.id) }; }));
app.get('/api/members/:id/costs', wrap(req => { member(req.params.id); return M360.costs(claims, req.params.id); }));

// ── care intelligence ──
app.get('/api/members/:id/longitudinal', wrap(req => I.longitudinal(ccl, req.params.id)));
app.get('/api/members/:id/risk', wrap(req => I.risk(ccl, req.params.id, req.query.run_id)));
app.get('/api/members/:id/evaluations', wrap(req => { member(req.params.id); return I.evaluations(ccl, req.params.id, req.query.run_id); }));
app.get('/api/members/:id/alerts', wrap(req => ccl.all('SELECT a.*, r.run_date FROM member_alert a JOIN intelligence_run r USING (run_id) WHERE a.member_id = ? ORDER BY a.run_id DESC', [req.params.id])));
app.get('/api/members/:id/care-plan', wrap(req => { member(req.params.id); return I.carePlan(ccl, req.params.id); }));
app.get('/api/members/:id/actions', wrap(req => { member(req.params.id); return I.actions(ccl, req.params.id); }));
app.get('/api/members/:id/tasks', wrap(req => { member(req.params.id); return P.tasks(ccl, { member_id: req.params.id }); }));
app.get('/api/members/:id/timeline', wrap(req => { member(req.params.id); return I.timeline(ccl, req.params.id); }));
app.get('/api/members/:id/explain', wrap(req => { member(req.params.id); return E.preview(ccl, req.params.id); }));
app.get('/api/intelligence/members', wrap(req => I.members(ccl, req.query)));
app.get('/api/intelligence/programme', wrap(() => I.programme(ccl)));
app.get('/api/intelligence/kpis', wrap(() => I.kpis(ccl)));
app.get('/api/intelligence/runs', wrap(() => ccl.all('SELECT * FROM intelligence_run ORDER BY run_id DESC').map(r => ({ ...r, stats: JSON.parse(r.stats_json || '{}') }))));
app.post('/api/intelligence/runs', wrap(req => { const r = E.run(ccl, { triggeredBy: req.get('x-user') || 'api', memberIds: req.body && req.body.member_ids }); return r; }));
app.get('/api/intelligence/runs/:id', wrap(req => { const r = ccl.get('SELECT * FROM intelligence_run WHERE run_id = ?', [req.params.id]); return r && { ...r, stats: JSON.parse(r.stats_json || '{}'), tiers: ccl.all('SELECT tier, tier_label, count(*) AS n FROM member_risk_result WHERE run_id = ? GROUP BY tier ORDER BY tier DESC', [req.params.id]), alerts: ccl.all('SELECT alert_colour, contact_priority, count(*) AS n FROM member_alert WHERE run_id = ? GROUP BY 1, 2', [req.params.id]) }; }));
app.get('/api/intelligence/evaluations', wrap(req => { const run = req.query.run_id || I.latestRun(ccl).run_id; const w = ['run_id = ?'], p = [run]; if (req.query.rule_id) { w.push('rule_id = ?'); p.push(req.query.rule_id); } if (req.query.result) { w.push('evaluation_result = ?'); p.push(req.query.result); } if (req.query.rule_type) { w.push('rule_type = ?'); p.push(req.query.rule_type); } return ccl.all(`SELECT * FROM member_rule_evaluation WHERE ${w.join(' AND ')} ORDER BY member_id LIMIT ?`, [...p, Number(req.query.limit || 1000)]); }));

// ── rules ──
app.get('/api/rules', wrap(() => { const out = {}; for (const t of ccl.tables().filter(t => /^(rule_|risk_score_band|clinical_pathway|rule_version)/.test(t.name) && t.type === 'table')) out[t.name] = ccl.all(`SELECT * FROM "${t.name}"`); return out; }));
app.get('/api/rules/definitions', wrap(() => ccl.all('SELECT * FROM rule_definition ORDER BY rule_type, priority_order, rule_id')));
app.get('/api/rules/:table', wrap(req => { if (!/^[a-z_]+$/.test(req.params.table) || !ccl.tables().some(t => t.name === req.params.table)) return null; return ccl.all(`SELECT * FROM "${req.params.table}"`); }));

// ── studio: cohorts and campaigns ──
app.get('/api/studio/features', wrap(() => ({ groups: ccl.all('SELECT * FROM rule_builder_field_group'), fields: ccl.all('SELECT * FROM longitudinal_field ORDER BY field_group, field'), not_selectable: ['Risk score (extract-computed)', 'Trigger', 'Persona'] })));
app.post('/api/cohorts/estimate', wrap(req => C.estimate(ccl, req.body || {})));
app.get('/api/cohorts', wrap(() => ({ cohorts: ccl.all('SELECT * FROM cohort ORDER BY cohort_id').map(c => C.cohortOut(ccl, c)) })));
app.get('/api/cohorts/:id', wrap(req => { const c = ccl.get('SELECT * FROM cohort WHERE cohort_id = ?', [req.params.id]); return c && { ...C.cohortOut(ccl, c), members: ccl.all('SELECT cm.member_id, cm.holdout, x.display_name FROM cohort_member cm JOIN member_identifier_crosswalk x ON x.member_id = cm.member_id WHERE cm.cohort_id = ? ORDER BY cm.member_id', [req.params.id]) }; }));
app.post('/api/cohorts', wrap(req => { const b = req.body || {}; if (!b.name) throw Object.assign(new Error('name is required'), { status: 400 }); const id = b.id || nextId('cohort', 'cohort_id', 'COH-'); const r = C.saveCohort(ccl, { ...b, id, owner: req.get('x-user') || b.owner }); audit(req, 'cohort', `${id} saved → ${r.row_count} members`); return { ...r, cohort: C.cohortOut(ccl, ccl.get('SELECT * FROM cohort WHERE cohort_id = ?', [id])) }; }));
app.get('/api/campaigns', wrap(() => ({ campaigns: ccl.all('SELECT * FROM campaign ORDER BY priority, campaign_id').map(c => C.campaignOut(ccl, c)) })));
app.post('/api/campaigns', wrap(req => { const b = req.body || {}; if (!b.name) throw Object.assign(new Error('name is required'), { status: 400 }); const id = b.id || nextId('campaign', 'campaign_id', 'CMP-'); C.saveCampaign(ccl, { ...b, id, by: req.get('x-user') || b.by }); audit(req, 'campaign', `${id} saved (${b.status || 'Draft'})`); return { campaign: C.campaignOut(ccl, ccl.get('SELECT * FROM campaign WHERE campaign_id = ?', [id])) }; }));
app.patch('/api/campaigns/:id', wrap(req => { const c = ccl.get('SELECT * FROM campaign WHERE campaign_id = ?', [req.params.id]); if (!c) return null; const b = req.body || {}; for (const k of ['status', 'priority', 'name', 'goal', 'channels', 'nurses', 'calls_per_day']) if (b[k] !== undefined) ccl.run(`UPDATE campaign SET ${k} = ?, updated_at = datetime('now') WHERE campaign_id = ?`, [b[k], req.params.id]); audit(req, 'campaign', `${req.params.id} updated ${JSON.stringify(b)}`); return { campaign: C.campaignOut(ccl, ccl.get('SELECT * FROM campaign WHERE campaign_id = ?', [req.params.id])) }; }));
app.get('/api/campaigns/:id/members', wrap(req => { const run = I.latestRun(ccl).run_id; return ccl.all('SELECT cm.member_id, x.display_name, r.tier, r.total_risk_score, a.alert_colour, a.contact_priority FROM campaign_member cm JOIN member_identifier_crosswalk x ON x.member_id = cm.member_id LEFT JOIN member_risk_result r ON r.member_id = cm.member_id AND r.run_id = cm.run_id LEFT JOIN member_alert a ON a.member_id = cm.member_id AND a.run_id = cm.run_id WHERE cm.campaign_id = ? AND cm.run_id = ? ORDER BY r.tier DESC', [req.params.id, run]); }));

// ── portal ──
app.get('/api/portal/worklist', wrap(req => P.worklist(ccl, req.query)));
app.get('/api/portal/tasks', wrap(req => P.tasks(ccl, req.query)));
app.get('/api/portal/analytics', wrap(req => P.analytics(ccl, req.query)));
app.post('/api/portal/consent', wrap(req => { member(req.body.member_id); return W.recordConsent(ccl, { ...req.body, nurse_id: req.body.nurse_id || req.get('x-user') }); }));
app.get('/api/members/:id/consent', wrap(req => ({ member_id: req.params.id, consent_status: W.consentStatus(ccl, req.params.id), events: ccl.all('SELECT * FROM consent_event WHERE member_id = ? ORDER BY consent_event_id DESC', [req.params.id]) })));
app.post('/api/portal/calls', wrap(req => { member(req.body.member_id); return W.recordCall(ccl, { ...req.body, nurse_id: req.body.nurse_id || req.get('x-user') }); }));
app.patch('/api/portal/calls/:id', wrap(req => { W.setCallStage(ccl, Number(req.params.id), req.body.stage); if (req.body.notes !== undefined) ccl.run('UPDATE call_interaction SET notes = ? WHERE call_id = ?', [req.body.notes, req.params.id]); if (req.body.response !== undefined) ccl.run('UPDATE call_interaction SET response = ? WHERE call_id = ?', [req.body.response, req.params.id]); return ccl.get('SELECT * FROM call_interaction WHERE call_id = ?', [req.params.id]); }));
app.post('/api/portal/assertions', wrap(req => { member(req.body.member_id); return W.recordAssertion(ccl, { ...req.body, nurse_id: req.body.nurse_id || req.get('x-user') }); }));
app.post('/api/portal/outcomes', wrap(req => W.recordOutcome(ccl, { ...req.body, nurse_id: req.body.nurse_id || req.get('x-user') })));
app.post('/api/portal/tasks/:id/complete', wrap(req => W.completeTask(ccl, Number(req.params.id), { ...req.body, nurse_id: req.body.nurse_id || req.get('x-user') })));
app.post('/api/portal/tasks/:id/book', wrap(req => W.completeTask(ccl, Number(req.params.id), { booking_date: req.body.booking_date, nurse_id: req.body.nurse_id || req.get('x-user') })));
app.post('/api/portal/notes', wrap(req => { member(req.body.member_id); const id = ccl.run('INSERT INTO nurse_note (member_id, nurse_id, call_id, text, created_at) VALUES (?,?,?,?,datetime("now"))', [req.body.member_id, req.body.nurse_id || req.get('x-user') || null, req.body.call_id || null, req.body.text]).lastId; return { note_id: id }; }));
app.post('/api/portal/appointments', wrap(req => { member(req.body.member_id); const b = req.body; const id = ccl.run('INSERT INTO appointment (member_id, need_id, action_id, appointment_type, provider_name, scheduled_date, scheduled_time, status, booked_by, booked_at) VALUES (?,?,?,?,?,?,?,?,?,datetime("now"))', [b.member_id, b.need_id || null, b.action_id || null, b.appointment_type || 'booking', b.provider_name || null, b.scheduled_date, b.scheduled_time || null, 'booked', b.nurse_id || req.get('x-user') || null]).lastId; if (b.need_id) { const n = ccl.get('SELECT * FROM care_need WHERE need_id = ?', [b.need_id]); if (n && ['Potential', 'Verified'].includes(n.gap_state)) { E.gapEvent(ccl, n, 'Scheduled', 'nurse:' + (b.nurse_id || '?'), 'Appointment ' + b.scheduled_date); ccl.run("UPDATE care_need SET gap_state = 'Scheduled' WHERE need_id = ?", [b.need_id]); } } return { appointment_id: id }; }));
app.get('/api/members/:id/appointments', wrap(req => ccl.all('SELECT * FROM appointment WHERE member_id = ? ORDER BY scheduled_date', [req.params.id])));
app.post('/api/portal/assign', wrap(req => { member(req.body.member_id); ccl.run('INSERT OR REPLACE INTO member_assignment VALUES (?,?,datetime("now"),?)', [req.body.member_id, req.body.nurse_id, req.get('x-user') || 'portal']); ccl.run("UPDATE action SET assignee = ? WHERE member_id = ? AND status = 'open'", [req.body.nurse_id, req.body.member_id]); ccl.run("UPDATE task SET assignee = ? WHERE member_id = ? AND status = 'open'", [req.body.nurse_id, req.body.member_id]); return { ok: true }; }));

// ── admin ──
app.post('/api/admin/reset', wrap(async (req, res) => { res.json({ ok: true, message: 'Resetting to the demo state; the server reloads its databases in a few seconds.' }); setTimeout(async () => { try { ccl.close(); await require('../importers/setup').setup({ skipClaims: true }); ccl = await openDatabase('ccl'); console.log('reset complete'); } catch (e) { console.error(e); } }, 50); }));

// Built React apps (npm run build) are served by the backend when SERVE_APPS=1 (npm start): /studio and /portal
for (const [route, dir] of [['/studio', 'chronic-care-studio'], ['/portal', 'care-coordinator-portal']]) {
  const dist = path.join(__dirname, '..', '..', 'apps', dir, 'dist');
  if (process.env.SERVE_APPS && fs.existsSync(dist)) { app.use(route, express.static(dist)); app.get(route + '/*', (req, res) => res.sendFile(path.join(dist, 'index.html'))); }
}
app.use((req, res) => res.status(404).json({ error: `no route ${req.method} ${req.path}` }));

async function start() {
  if (!exists('ccl') || !exists('claims')) { console.log('No database yet: running setup (npm run setup) first…'); await require('../importers/setup').setup({}); }
  claims = await openDatabase('claims');
  ccl = await openDatabase('ccl');
  const close = () => { try { ccl.save(); claims.save(); } catch (e) { console.error(e); } process.exit(0); };
  process.on('SIGINT', close); process.on('SIGTERM', close);
  return new Promise(resolve => { const srv = app.listen(PORT, () => { console.log(`Chronic Care Loop API listening on http://localhost:${PORT}/api  (health: /api/health)`); resolve(srv); }); });
}
module.exports = { app, start };
if (require.main === module) start().catch(e => { console.error(e); process.exit(1); });
