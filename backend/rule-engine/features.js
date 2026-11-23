/**
 * Feature access for the rule engine. One member's longitudinal row → two maps:
 *   raw : the source values (text/number/ISO date) for display and evidence
 *   v   : the evaluation vector: numbers as numbers, dates as "days before the as-of date" (how the rulebook phrases every date rule)
 * Nothing is recalculated from claims here: every value is read from member_longitudinal (guardrail: longitudinal is the feature source).
 */
function loadFieldTypes(db) { const m = new Map(); for (const r of db.all('SELECT field, type FROM longitudinal_field')) m.set(r.field, r.type); return m; }
const PLAUSIBLE = { Last_HbA1c_Value: [3, 20], Last_SystolicPressure_Value: [60, 260], Last_DiastolicPressure_Value: [30, 160], Last_eGFR_Value: [1, 200], Last_UACR_Value: [0, 10000], Last_MeasuredBMI_Value: [10, 80], AGE: [0, 110] };

function vectorise(row, types, asOf) {
  const raw = {}, v = {}, dropped = [];
  const asOfMs = Date.parse(asOf);
  for (const [k, val] of Object.entries(row)) {
    if (val === null || val === undefined || val === '') { raw[k] = null; v[k] = null; continue; }
    const t = types.get(k);
    if (t === 'date') {
      const ms = Date.parse(val);
      raw[k] = val; v[k] = Number.isFinite(ms) ? Math.round((asOfMs - ms) / 86400000) : null;
    } else if (typeof val === 'number') {
      raw[k] = val; v[k] = val;
      if (PLAUSIBLE[k] && (val < PLAUSIBLE[k][0] || val > PLAUSIBLE[k][1])) { v[k] = null; raw[k] = null; dropped.push(`${k}=${val}`); }   // G0 plausibility
    } else { raw[k] = val; v[k] = val; }
  }
  return { raw, v, dropped };
}
function loadMembers(db, asOf) {
  const types = loadFieldTypes(db);
  return db.all('SELECT * FROM member_longitudinal').map(r => ({ member_id: r.mask_id, ...vectorise(r, types, asOf) }));
}
function loadMember(db, memberId, asOf) {
  const r = db.get('SELECT * FROM member_longitudinal WHERE mask_id = ?', [memberId]);
  return r ? { member_id: r.mask_id, ...vectorise(r, loadFieldTypes(db), asOf) } : null;
}
module.exports = { loadMembers, loadMember, vectorise, loadFieldTypes, PLAUSIBLE };
