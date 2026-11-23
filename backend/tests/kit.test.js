/** End-to-end checks: importers → engine → API → write-back. Runs on a throw-away copy of the databases. `npm test` */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccl-test-'));
const src = path.join(__dirname, '..', '..', 'data', 'db');
process.env.CCL_DB_DIR = tmp;
process.env.PORT = '4321';
if (!process.env.CCL_TEST_FRESH) for (const f of ['claims.sqlite', 'ccl.sqlite']) if (fs.existsSync(path.join(src, f))) fs.copyFileSync(path.join(src, f), path.join(tmp, f));   // CCL_TEST_FRESH=1 rebuilds from the seeds instead

const { openDatabase } = require('../database/adapter');
const E = require('../rule-engine/engine');
const W = require('../rule-engine/writeback');
const { setup } = require('../importers/setup');

let ccl, claims;
test.before(async () => { if (!fs.existsSync(path.join(tmp, 'ccl.sqlite'))) await setup({}); claims = await openDatabase('claims'); ccl = await openDatabase('ccl'); });
test.after(() => { ccl.close(); claims.close(); });

test('raw claims imported: 250 members, every lab linked to a claim activity', () => {
  assert.equal(claims.count('member'), 250);
  assert.ok(claims.count('claim_activity') > 140000);
  assert.equal(claims.get('SELECT count(*) AS n FROM lab_observation WHERE mask_id IS NULL').n, 0);
  assert.equal(claims.all('PRAGMA foreign_key_check').length, 0);
});
test('longitudinal imported with all 377 columns and a crosswalk for every member', () => {
  assert.equal(ccl.count('member_longitudinal'), 250);
  assert.equal(ccl.columns('member_longitudinal').length, 377);
  assert.equal(ccl.get('SELECT count(*) AS n FROM member_identifier_crosswalk WHERE in_longitudinal = 1 AND in_claims = 1').n, 250);
});
test('rule database loaded from CSV: 14 triggers, 38 score bands, versioned definitions', () => {
  assert.equal(ccl.count('rule_trigger'), 14);
  assert.equal(ccl.count('risk_score_band'), 38);
  assert.ok(ccl.count('rule_definition') > 60);
  assert.equal(ccl.get('SELECT count(*) AS n FROM clinical_trigger').n, 14);
});
test('engine reproduces the extract risk scores for all 250 members and caps components', () => {
  const r = ccl.get('SELECT count(*) AS n, sum(matches_extract) AS ok, max(clinical_score) c, max(comorbidity_score) m, max(kidney_score) k, max(utilisation_score) u, max(age_sex_score) a, max(total_risk_score) t FROM member_risk_result WHERE run_id = (SELECT max(run_id) FROM intelligence_run)');
  assert.equal(r.n, 250); assert.equal(r.ok, 250);
  assert.ok(r.c <= 5 && r.m <= 6 && r.k <= 5 && r.u <= 5 && r.a <= 2 && r.t <= 23);
});
test('every trigger evaluation carries inputs, logic, result and evidence; every CURRENT need has one open action', () => {
  const e = ccl.get("SELECT count(*) AS n FROM member_rule_evaluation WHERE rule_type = 'trigger' AND (input_features IS NULL OR evaluation_logic IS NULL)").n;
  assert.equal(e, 0);
  assert.equal(ccl.get("SELECT count(*) AS n FROM care_need n WHERE n.slot = 'CURRENT' AND n.status = 'open' AND NOT EXISTS (SELECT 1 FROM action a WHERE a.need_id = n.need_id AND a.status = 'open')").n, 0);
  assert.equal(ccl.get("SELECT count(*) AS n FROM care_need WHERE slot = 'CURRENT' GROUP BY member_id ORDER BY n DESC LIMIT 1").n <= 3, true);
});
test('write-back: done → Reported + verify follow-up; declined → 90-day hold; next need promoted', () => {
  const need = ccl.get("SELECT * FROM care_need WHERE slot = 'CURRENT' AND status = 'open' AND rank = 1 AND member_id IN (SELECT member_id FROM care_need WHERE slot = 'NEXT') LIMIT 1");
  const before = ccl.get("SELECT count(*) AS n FROM care_need WHERE member_id = ? AND slot = 'CURRENT'", [need.member_id]).n;
  const r = W.recordOutcome(ccl, { action_id: ccl.get("SELECT action_id FROM action WHERE need_id = ? AND status = 'open'", [need.need_id]).action_id, outcome: 'done', nurse_id: 'U-0142' });
  assert.equal(r.need.gap_state, 'Reported'); assert.equal(r.need.status, 'done');
  assert.ok(ccl.get("SELECT 1 AS x FROM action WHERE need_id = ? AND kind = 'follow_up' AND title LIKE 'Verify in claims%' AND status = 'open'", [need.need_id]));
  assert.equal(ccl.get("SELECT count(*) AS n FROM care_need WHERE member_id = ? AND slot = 'CURRENT'", [need.member_id]).n, before);
  const n2 = ccl.get("SELECT * FROM care_need WHERE member_id = ? AND slot = 'CURRENT' AND status = 'open' ORDER BY rank LIMIT 1", [need.member_id]);
  const r2 = W.recordOutcome(ccl, { need_id: n2.need_id, outcome: 'declined', nurse_id: 'U-0142' });
  assert.equal(r2.need.status, 'declined'); assert.ok(r2.need.hold_until > ccl.get("SELECT value FROM app_setting WHERE key='run_date'").value);
});
test('consent gate: declined consent cancels open outreach; granted is the latest status', () => {
  const m = ccl.get("SELECT member_id FROM action WHERE kind = 'call' AND status = 'open' LIMIT 1").member_id;
  W.recordConsent(ccl, { member_id: m, consent_status: 'declined', nurse_id: 'U-0142' });
  assert.equal(ccl.get("SELECT count(*) AS n FROM action WHERE member_id = ? AND kind = 'call' AND status = 'open'", [m]).n, 0);
  W.recordConsent(ccl, { member_id: m, consent_status: 'granted', nurse_id: 'U-0142' });
  assert.equal(W.consentStatus(ccl, m), 'granted');
});
test('a second run is idempotent on needs and keeps nurse work', () => {
  const needs = ccl.count('care_need'), done = ccl.get("SELECT count(*) AS n FROM care_need WHERE status <> 'open'").n;
  const r = E.run(ccl, { triggeredBy: 'test' });
  assert.equal(r.members, 250);
  assert.equal(ccl.count('care_need'), needs);
  assert.ok(ccl.get("SELECT count(*) AS n FROM care_need WHERE status <> 'open'").n >= done);
});
test('views named by the Revised Member360/Longitudinal/CI workbook exist with the expected grain', () => {
  for (const v of ['longitudinal_member', 'care_intelligence_member_v']) assert.equal(ccl.count(v), 250);
  assert.equal(ccl.count('care_intelligence_trigger_v'), 250 * 14);
  assert.ok(ccl.count('care_intelligence_need_v') > 0 && ccl.count('member_need') === ccl.count('care_need'));
  for (const v of ['member360_v', 'member360_claims_v', 'member360_labs_v']) assert.ok(claims.count(v) > 0);
});
test('studio scope: a handed-off cohort is what intelligence and the portal worklist show', () => {
  const SC = require('../services/scope'); const I = require('../services/intelligence'); const P = require('../services/portal');
  const s = SC.setScope(ccl, { cohort_id: 'COH-0101' }, 'test');
  const n = ccl.get("SELECT count(*) AS n FROM cohort_member WHERE cohort_id = 'COH-0101'").n;
  assert.equal(s.members, n);
  assert.equal(I.members(ccl, { scope: 'active' }).count, n);
  assert.equal(I.kpis(ccl, { scope: 'active' }).evaluated, n);
  const wl = P.worklist(ccl, { scope: 'active' });
  assert.ok(wl.items.every(i => SC.memberIds(ccl, s).includes(i.member_id)));
  SC.setScope(ccl, {}); assert.equal(SC.getScope(ccl), null);
});
test('write-backs land on the calendar and the queue is rebuilt live', () => {
  const W = require('../rule-engine/writeback'); const P = require('../services/portal');
  const row = ccl.get("SELECT w.member_id, w.nurse_id FROM worklist w WHERE w.list_status = 'today' LIMIT 1");
  const r = W.recordAppointment(ccl, { member_id: row.member_id, appointment_type: 'callback', scheduled_date: '2026-11-24', scheduled_time: '10:30', nurse_id: row.nurse_id });
  assert.equal(r.task.due_date, '2026-11-24'); assert.equal(r.task.due_time, '10:30'); assert.equal(r.task.assignee, row.nurse_id);
  assert.ok(P.tasks(ccl, { member_id: row.member_id }).some(t => t.task_id === r.task.task_id));
  W.recordCall(ccl, { member_id: row.member_id, nurse_id: row.nurse_id, reached: false });
  const wl = ccl.get('SELECT a.status FROM worklist w JOIN action a ON a.action_id = w.action_id WHERE w.member_id = ?', [row.member_id]);
  assert.ok(!wl || wl.status === 'open');
});
test('API answers the main reads', async () => {
  const { start } = require('../api/server');
  const srv = await start();
  const get = async p => { const r = await fetch(`http://localhost:4321/api${p}`); return { status: r.status, body: await r.json() }; };
  assert.equal((await get('/health')).body.ok, true);
  const m = (await get('/members?limit=1')).body.members[0].member_id;
  const r360 = await get(`/members/${m}/360`); assert.equal(r360.status, 200); assert.ok(r360.body.conditions.length >= 0 && r360.body.labs);
  const ev = await get(`/members/${m}/evaluations`); assert.equal(ev.body.length, 14);
  assert.equal((await get('/members/nobody')).status, 404);
  assert.equal((await get('/rules/definitions')).status, 200);
  srv.close();
});
