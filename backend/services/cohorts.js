/**
 * Cohort builder: the Studio's rule JSON → SQL over member_longitudinal (rulebook §2: raw inputs only, never risk outputs).
 * Rule shape: {id, f (field), op, v, v2, vs (codes), l (lab)}. Unknown fields are reported as unsupported, never silently dropped.
 */
const crypto = require('crypto');
const U = require('../importers/util');

const OPS = { '≥': '>=', '≤': '<=', '=': '=', '>=': '>=', '<=': '<=', '>': '>', '<': '<' };
const LABS = { hba1c: 'Last_HbA1c_Value', egfr: 'Last_eGFR_Value', uacr: 'Last_UACR_Value', sbp: 'Last_SystolicPressure_Value', dbp: 'Last_DiastolicPressure_Value', bmi: 'Last_MeasuredBMI_Value' };
const LAB_DATES = { hba1c: 'last_hba1c_date2', egfr: 'last_egfr_test_date', uacr: 'last_urine_albumin_date', ldl: 'last_lipid_panel_date', k: 'last_potassium_date' };
const DX = { E11: 'cohort_t2d_l12m', I10: 'cohort_htn_l12m', E78: 'flag_dyslipidemia_l12m', E66: 'flag_obesity', N18: 'flag_ckd', I50: 'flag_heart_failure', I25: 'flag_ischemic_heart_disease', I63: 'flag_stroke', I73: 'flag_pad_l12m' };
const NEWDX = { E11: 'first_e11_date', I10: 'first_htn_date' };
const SPEC = { ENDO: 'last_endocrinology_visit', CARD: 'last_cardiology_visit', NEPH: 'last_nephrology_visit', OPH: 'last_ophthalmology_visit', DIET: 'last_dietitian_visit', POD: 'last_podiatry_visit' };
const CHRONIC_FLAGS = ['cohort_t2d_l12m', 'cohort_htn_l12m', 'flag_dyslipidemia_l12m', 'flag_obesity', 'flag_ckd', 'flag_heart_failure', 'flag_ischemic_heart_disease', 'flag_stroke'];
const col = c => `m."${c}"`;
const days = c => `(julianday(:asof) - julianday(${col(c)}))`;      // days before the as-of date
const NUM = { age: col('AGE'), ncc: '(' + CHRONIC_FLAGS.map(f => `COALESCE(${col(f)},0)`).join('+') + ')', ed: col('ed_visits_l12m'), ip: col('ip_admissions_l12m'), nofu: days('last_visit_date'),
  pdc: `(100*MIN(COALESCE(${col('pdc_any_t2d_noninsulin')},1), COALESCE(${col('pdc_any_htn')},1)))`, poly: col('active_drug_class_count'), innet: `(100*${col('phg_share_l12m_encounters')})`, cost: col('l12m_payable_DiaborHTNrelated') };
const FLAG = { readm: `(${col('second_last_ip_discharge_date')} IS NOT NULL AND julianday(${col('last_ip_admit_date')}) - julianday(${col('second_last_ip_discharge_date')}) <= 30)`, pregnant: `${col('flag_excl_pregnant_postpartum')} = 1`, onco: `${col('flag_oncology_l24m')} = 1` };

function numCond(expr, op, v, v2) {
  if (op === 'between') return [`${expr} BETWEEN ? AND ?`, [Number(v), Number(v2)]];
  return [`${expr} ${OPS[op] || '>='} ?`, [Number(v)]];
}
/** → {sql, params, reason}. sql null = the extract cannot answer this rule. */
function compileRule(r) {
  const f = r.f || r.field; let vs = r.vs || r.codes || []; if (typeof vs === 'string') vs = JSON.parse(vs || '[]');
  const op = r.op || r.operator || '≥', v = r.v !== undefined ? r.v : r.value, v2 = r.v2 !== undefined ? r.v2 : r.value2;
  const ok = (sql, params = [], reason = null) => ({ sql, params, reason });
  const no = reason => ({ sql: null, params: [], reason });
  try {
    if (f in NUM) { const [s, p] = numCond(NUM[f], op, v, v2); return ok(s, p); }
    if (f in FLAG) return ok(FLAG[f]);
    if (f === 'gender') return vs.length ? ok(`${col('GENDER')} IN (${vs.map(() => '?').join(',')})`, vs) : no('pick a value');
    if (f === 'nat') { const p = []; if (vs.includes('UAE')) p.push(`UPPER(${col('NATIONALITY')}) = 'EMIRATI'`); if (vs.includes('EXP')) p.push(`UPPER(${col('NATIONALITY')}) <> 'EMIRATI'`); return p.length ? ok('(' + p.join(' OR ') + ')') : no('pick a value'); }
    if (f === 'plan') { const like = { ENH: `${col('policy_type')} LIKE 'Group%'`, KEY: `${col('policy_type')} = 'Key Clients'`, IND: `UPPER(${col('policy_type')}) = 'INDIVIDUAL'` }; const p = vs.filter(c => like[c]).map(c => like[c]); return p.length ? ok('(' + p.join(' OR ') + ')') : no('pick a value'); }
    if (f === 'dx' || f === 'newdx') { const T = f === 'dx' ? DX : NEWDX; const known = vs.filter(c => T[c]); if (!known.length) return no(vs.length ? 'not in the extract: ' + vs.join(', ') : 'pick a value');
      const parts = known.map(c => f === 'dx' ? `${col(T[c])} = 1` : `${days(T[c])} <= 90`); return ok('(' + parts.join(' OR ') + ')', [], known.length === vs.length ? null : 'ignored: ' + vs.filter(c => !T[c]).join(', ')); }
    if (f === 'lab') { const c = LABS[r.l]; if (!c) return no(`${r.l} is not in the extract`); const [s, p] = numCond(col(c), op, v, v2); return ok(s, p); }
    if (f === 'labage') { const c = LAB_DATES[r.l]; if (!c) return no(`${r.l} test date is not in the extract`); return ok(`(${col(c)} IS NULL OR ${days(c)} > ?)`, [Number(v)]); }
    if (f === 'eye') return ok(`(${col('last_retinal_screen_date')} IS NULL OR ${days('last_retinal_screen_date')} > 730)`);
    if (f === 'foot') return ok(`(${col('last_foot_exam')} IS NULL OR ${days('last_foot_exam')} > 365)`);
    if (f === 'spec') { const p = vs.filter(c => SPEC[c]).map(c => `${days(SPEC[c])} <= 365`); if (vs.includes('GP')) p.push(`${col('gp_claims_6m')} >= 1`); return p.length ? ok('(' + p.join(' OR ') + ')') : no('not in the extract'); }
    if (f === 'atc') { const m = { A10: `${col('t2d_drug_classes_l12m')} IS NOT NULL`, A10A: `${col('flag_active_insulin')} = 1`, C09: `(${col('flag_active_ACEinhibitor')} = 1 OR ${col('flag_active_ARBinhibitor')} = 1)`, C07: `${col('active_drug_classes')} LIKE '%BETA_BLOCKER%'`, C03: `${col('active_drug_classes')} LIKE '%THIAZIDE%'`, C08: `${col('pdc_ccb')} IS NOT NULL` };
      const p = vs.filter(c => m[c]).map(c => m[c]); return p.length ? ok('(' + p.join(' OR ') + ')') : no('medicine class not in the extract'); }
    if (f === 'contacted') return ok(`EXISTS (SELECT 1 FROM contact_attempt c WHERE c.member_id = m.mask_id AND julianday(:asof) - julianday(c.started_at) <= ?)`, [Number(v)]);
    if (f === 'optout') return ok(`EXISTS (SELECT 1 FROM consent_event ce WHERE ce.member_id = m.mask_id AND ce.consent_status = 'declined' AND ce.recorded_at = (SELECT MAX(recorded_at) FROM consent_event x WHERE x.member_id = m.mask_id))`);
    if (f && f.startsWith('x:')) { const c = f.slice(2); const t = r.type; if (t === 'flag' || (v === undefined && !vs.length)) return ok(`${col(c)} = 1`); if (vs.length) return ok(`${col(c)} IN (${vs.map(() => '?').join(',')})`, vs); const [s, p] = numCond(col(c), op, v, v2); return ok(s, p); }
  } catch (e) { return no('value missing'); }
  return no('not in the extract (' + f + ')');
}
function baseSql(base) {
  if (base === 'seha') return [`${col('phg_share_l12m_encounters')} > 0`, 'members with any encounter at PHG (SEHA / SSMC)'];
  if (base === 'pura') return ['0', 'PURA app users are not in this extract'];
  return ['1=1', 'every member in the longitudinal extract'];
}
const asof = db => db.get("SELECT value FROM app_setting WHERE key='as_of_date'").value;
/** :asof is rewritten to the as-of date from app_setting (a fixed ISO literal), so every rule binds positionally. */
function withAsof(db, sql) { return sql.replace(/:asof/g, `'${asof(db)}'`); }

function estimate(db, cb) {
  const [base, baseNote] = baseSql(cb.base || 'daman');
  const cnt = (w, p) => db.get(withAsof(db, `SELECT count(*) AS n FROM member_longitudinal m WHERE ${w}`), p).n;
  const B = cnt(base, []);
  const inc = cb.inc || [], exc = cb.exc || [];
  const steps = [], alone = {}, unsupported = [], compiled = [];
  for (const r of inc) { const c = compileRule(r); if (!c.sql) { unsupported.push({ id: r.id, field: r.f, reason: c.reason }); continue; } if (c.reason) unsupported.push({ id: r.id, field: r.f, reason: c.reason }); compiled.push([r, c]); alone[r.id] = cnt(`(${base}) AND ${c.sql}`, c.params); }
  let where = base, wp = [];
  if (cb.logic === 'any' && compiled.length) { where = `(${base}) AND (${compiled.map(([, c]) => c.sql).join(' OR ')})`; wp = compiled.flatMap(([, c]) => c.params); steps.push({ id: 'any', t: `Any of ${compiled.length} rules`, n: cnt(where, wp) }); }
  else for (const [r, c] of compiled) { where = `${where} AND ${c.sql}`; wp = wp.concat(c.params); steps.push({ id: r.id, n: cnt(where, wp) }); }
  for (const r of exc) { const c = compileRule(r); if (!c.sql) { unsupported.push({ id: r.id, field: r.f, reason: c.reason, exclusion: true }); continue; } where = `${where} AND NOT ${c.sql}`; wp = wp.concat(c.params); steps.push({ id: r.id, n: cnt(where, wp), ex: true }); }
  const n = cnt(where, wp);
  const sql = withAsof(db, `SELECT m.mask_id FROM member_longitudinal m WHERE ${where}`);
  return { B, n, steps, alone, unsupported, base_note: baseNote, sql, params: wp, profile: profile(db, sql, wp) };
}
function profile(db, sql, params) {
  const rows = db.all(sql.replace('SELECT m.mask_id', 'SELECT m.mask_id, m."AGE" AS age, m."GENDER" AS g, m."policy_type" AS plan, m."phg_share_l12m_encounters" AS phg, m."Last_HbA1c_Value" AS a1, m."NATIONALITY" AS nat'), params);
  const n = rows.length || 1, share = f => Math.round(100 * rows.filter(f).length / n) / 100;
  const bands = [['18–39', 0, 39], ['40–54', 40, 54], ['55–64', 55, 64], ['65+', 65, 200]];
  const names = db.all('SELECT member_id, display_name, initials FROM member_identifier_crosswalk');
  const nm = new Map(names.map(r => [r.member_id, r]));
  return { age: bands.map(([b, lo, hi]) => [b, share(m => (m.age || 0) >= lo && (m.age || 0) <= hi)]), sex: [['Women', share(m => m.g === 'F')], ['Men', share(m => m.g === 'M')]],
    plan: [['Group', share(m => /^group$/i.test(m.plan || ''))], ['Key Clients', share(m => m.plan === 'Key Clients')], ['Individual', share(m => /individual/i.test(m.plan || ''))]],
    net: [['Any PHG encounter', share(m => (m.phg || 0) > 0)], ['No PHG encounter', share(m => !((m.phg || 0) > 0))]],
    sample: rows.slice(0, 12).map(m => ({ id: m.mask_id, name: (nm.get(m.mask_id) || {}).display_name, ini: (nm.get(m.mask_id) || {}).initials, age: m.age, sex: m.g, facts: [m.a1 != null ? `HbA1c ${Number(m.a1).toFixed(1)}%` : null, m.plan].filter(Boolean) })) };
}
function membersFor(db, cb) { const e = estimate(db, cb); return db.all(e.sql, e.params).map(r => r.mask_id); }
const holdout = (cohortId, memberId, pct = 10) => parseInt(crypto.createHash('md5').update(`${cohortId}:${memberId}`).digest('hex').slice(0, 8), 16) % 100 < pct;

function saveCohort(db, c) {
  const old = db.get('SELECT version FROM cohort WHERE cohort_id = ?', [c.id]);
  const ver = old ? old.version + 1 : 1;
  const inc = (c.inc || []).map((r, i) => ({ id: r.id || i + 1, ...r })), exc = (c.exc || []).map((r, i) => ({ id: r.id || inc.length + i + 1, ...r }));
  const def = { base: c.base || 'daman', logic: c.logic || 'all', inc, exc };
  const est = estimate(db, def);
  db.transaction(() => {
    if (old) db.run('UPDATE cohort SET version=?, name=?, base=?, logic=?, refresh=?, definition_json=?, compiled_sql=?, updated_at=? WHERE cohort_id=?', [ver, c.name, def.base, def.logic, c.refresh || 'Nightly', JSON.stringify(def), est.sql, U.now(), c.id]);
    else db.run('INSERT INTO cohort (cohort_id, version, name, base, logic, refresh, definition_json, compiled_sql, row_count, owner, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [c.id, ver, c.name, def.base, def.logic, c.refresh || 'Nightly', JSON.stringify(def), est.sql, 0, c.owner || 'U-0201', U.now(), U.now()]);
    [...inc.map(r => [r, 0]), ...exc.map(r => [r, 1])].forEach(([r, ex], i) => db.run('INSERT INTO cohort_rule VALUES (?,?,?,?,?,?,?,?,?,?)', [`${c.id}-v${ver}-R${i + 1}`, c.id, ver, r.f, r.op || null, r.v == null ? null : String(r.v), r.v2 == null ? null : String(r.v2), JSON.stringify(r.vs || []), r.l || null, ex]));
  });
  const n = runCohort(db, c.id);
  return { cohort_id: c.id, version: ver, row_count: n, unsupported: est.unsupported };
}
function runCohort(db, cohortId, pct = 10) {
  const c = db.get('SELECT * FROM cohort WHERE cohort_id = ?', [cohortId]);
  const ids = membersFor(db, JSON.parse(c.definition_json));
  db.transaction(() => {
    db.run('DELETE FROM cohort_member WHERE cohort_id = ?', [cohortId]);
    for (const m of ids) db.run('INSERT INTO cohort_member VALUES (?,?,?,?,?)', [cohortId, m, c.version, holdout(cohortId, m, pct) ? 1 : 0, U.now()]);
    db.run('UPDATE cohort SET row_count = ? WHERE cohort_id = ?', [ids.length, cohortId]);
  });
  return ids.length;
}
function saveCampaign(db, c) {
  db.transaction(() => {
    db.run('INSERT OR REPLACE INTO campaign (campaign_id, name, goal, mode, triggers_json, channels, nurses, calls_per_day, holdout_pct, start_date, weeks, priority, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [c.id, c.name, c.goal || null, c.mode || 'automated', c.triggers ? JSON.stringify(c.triggers) : null, c.channels || null, c.nurses || null, c.calls_per_day || null, c.holdout == null ? 10 : c.holdout, c.start || null, c.weeks || null, c.priority || 9, c.status || 'Draft', c.by || 'U-0201', U.now(), U.now()]);
    db.run('DELETE FROM campaign_cohort WHERE campaign_id = ?', [c.id]);
    for (const k of c.include || []) db.run('INSERT OR IGNORE INTO campaign_cohort VALUES (?,?,?)', [c.id, k, 'include']);
    for (const k of c.exclude || []) db.run('INSERT OR IGNORE INTO campaign_cohort VALUES (?,?,?)', [c.id, k, 'exclude']);
  });
  return c.id;
}
/** Members a live campaign reaches: include − exclude − holdout − extract Exclusion = 1 − consent declined (G1c). */
function campaignMembers(db, campaignId) {
  return db.all(`SELECT DISTINCT cm.member_id FROM campaign_cohort cc JOIN cohort_member cm ON cm.cohort_id = cc.cohort_id
    JOIN member_longitudinal m ON m.mask_id = cm.member_id
    WHERE cc.campaign_id = ? AND cc.role = 'include' AND cm.holdout = 0 AND COALESCE(m."Exclusion", 0) <> 1
      AND NOT EXISTS (SELECT 1 FROM campaign_cohort x JOIN cohort_member xm ON xm.cohort_id = x.cohort_id WHERE x.campaign_id = cc.campaign_id AND x.role = 'exclude' AND xm.member_id = cm.member_id)
      AND NOT EXISTS (SELECT 1 FROM consent_event ce WHERE ce.member_id = cm.member_id AND ce.consent_status = 'declined'
                      AND ce.recorded_at = (SELECT MAX(recorded_at) FROM consent_event y WHERE y.member_id = cm.member_id))`, [campaignId]).map(r => r.member_id);
}
function cohortOut(db, c) { const d = JSON.parse(c.definition_json || '{}'); return { id: c.cohort_id, version: c.version, name: c.name, base: c.base, logic: c.logic, refresh: c.refresh, inc: d.inc || [], exc: d.exc || [], n: c.row_count, sql: c.compiled_sql, owner: c.owner, updated_at: c.updated_at }; }
function campaignOut(db, c) { const cc = db.all('SELECT cohort_id, role FROM campaign_cohort WHERE campaign_id = ?', [c.campaign_id]); return { id: c.campaign_id, name: c.name, goal: c.goal, mode: c.mode, triggers: c.triggers_json ? JSON.parse(c.triggers_json) : null, channels: c.channels, nurses: c.nurses, calls_per_day: c.calls_per_day, holdout: c.holdout_pct, start: c.start_date, weeks: c.weeks, priority: c.priority, status: c.status, include: cc.filter(x => x.role === 'include').map(x => x.cohort_id), exclude: cc.filter(x => x.role === 'exclude').map(x => x.cohort_id), updated_at: c.updated_at }; }

module.exports = { compileRule, estimate, membersFor, saveCohort, runCohort, saveCampaign, campaignMembers, cohortOut, campaignOut, holdout };
