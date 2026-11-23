/** Member 360 · everything here is read from claims.sqlite (data flow A). No longitudinal value is used for history. */
const LAB_NAMES = { '4548-4': 'HbA1c', '14682-9': 'Creatinine', '14749-6': 'Glucose', '39156-5': 'BMI', '8867-4': 'Heart rate', '8310-5': 'Body temperature', '9279-1': 'Respiratory rate', '14957-5': 'Urine albumin', '718-7': 'Haemoglobin', '14647-2': 'Cholesterol', '14646-4': 'HDL cholesterol', '2089-1': 'LDL cholesterol', '13457-7': 'LDL cholesterol', '2571-8': 'Triglycerides', '14927-8': 'Triglycerides', '33914-3': 'eGFR', '62238-1': 'eGFR', '69405-9': 'eGFR', '48642-3': 'eGFR', '48643-1': 'eGFR', '2823-3': 'Potassium', '6298-4': 'Potassium', '2951-2': 'Sodium', '8480-6': 'Systolic BP', '8462-4': 'Diastolic BP', '2160-0': 'Creatinine', '14958-3': 'UACR', '9318-7': 'UACR', '32294-1': 'UACR', '1988-5': 'CRP', '3016-3': 'TSH', '1742-6': 'ALT', '1920-8': 'AST', '2345-7': 'Glucose', '1558-6': 'Fasting glucose', '14771-0': 'Fasting glucose', '17856-6': 'HbA1c', '4549-2': 'HbA1c', '2085-9': 'HDL cholesterol', '2093-3': 'Cholesterol', '3094-0': 'Urea', '14937-7': 'Urea', '2885-2': 'Protein', '1751-7': 'Albumin', '6299-2': 'Urea nitrogen', '2777-1': 'Phosphate', '17861-6': 'Calcium', '2075-0': 'Chloride', '3024-7': 'Thyroxine', '2132-9': 'Vitamin B12', '1989-3': 'Vitamin D', '14635-7': 'Vitamin D', '789-8': 'Red cells', '6690-2': 'White cells', '777-3': 'Platelets', '4544-3': 'Haematocrit', 'UND': 'Undefined code' };
const KEY_LABS = ['4548-4', '17856-6', '14682-9', '2160-0', '33914-3', '62238-1', '69405-9', '48642-3', '14958-3', '9318-7', '32294-1', '2089-1', '13457-7', '14647-2', '2093-3', '2823-3', '6298-4', '14749-6', '2345-7', '1558-6', '14771-0', '39156-5', '8480-6', '8462-4'];

function member(claims, id) { return claims.get('SELECT * FROM member WHERE mask_id = ?', [id]); }
function policies(claims, id) { return claims.all('SELECT * FROM member_policy WHERE mask_id = ? ORDER BY effective_date DESC', [id]); }
function conditions(claims, id) {
  return claims.all(`SELECT d.diagnosis_id, dc.group3, dc.group4, d.first_date, d.last_date, d.claim_count, dc.is_chronic_marker FROM diagnosis d JOIN diagnosis_code dc ON dc.diagnosis_id = d.diagnosis_id WHERE d.mask_id = ? ORDER BY dc.is_chronic_marker DESC, d.claim_count DESC`, [id]);
}
function encounters(claims, id, { type, limit = 500 } = {}) {
  return claims.all(`SELECT e.*, p.facility_name, p.facility_type, p.group_owner_level, c.clinician_name, c.specialty, dc.group4 AS diagnosis_desc FROM encounter e LEFT JOIN provider p ON p.provider_id = e.provider_id LEFT JOIN clinician c ON c.clinician_id = e.clinician_id LEFT JOIN diagnosis_code dc ON dc.diagnosis_id = e.primary_diagnosis_id
    WHERE e.mask_id = ? ${type ? 'AND e.encounter_type = ?' : ''} ORDER BY e.service_date DESC LIMIT ?`, type ? [id, type, limit] : [id, limit]);
}
function claimsList(claims, id, { from, to, limit = 200, offset = 0 } = {}) {
  const w = ['c.mask_id = ?'], p = [id]; if (from) { w.push('c.service_date >= ?'); p.push(from); } if (to) { w.push('c.service_date <= ?'); p.push(to); }
  const rows = claims.all(`SELECT c.*, p.facility_name, p.facility_type, cl.clinician_name, cl.specialty, dc.group4 AS diagnosis_desc FROM claim c LEFT JOIN provider p ON p.provider_id = c.provider_id LEFT JOIN clinician cl ON cl.clinician_id = c.clinician_id LEFT JOIN diagnosis_code dc ON dc.diagnosis_id = c.primary_diagnosis_id WHERE ${w.join(' AND ')} ORDER BY c.service_date DESC, c.claim_id LIMIT ? OFFSET ?`, [...p, limit, offset]);
  return { total: claims.get(`SELECT count(*) AS n FROM claim c WHERE ${w.join(' AND ')}`, p).n, rows };
}
function claimDetail(claims, claimId) {
  const c = claims.get('SELECT c.*, p.facility_name, p.facility_type, cl.clinician_name, cl.specialty FROM claim c LEFT JOIN provider p ON p.provider_id = c.provider_id LEFT JOIN clinician cl ON cl.clinician_id = c.clinician_id WHERE c.claim_id = ?', [claimId]);
  if (!c) return null;
  c.activities = claims.all('SELECT a.*, dc.group4 AS diagnosis_desc FROM claim_activity a LEFT JOIN diagnosis_code dc ON dc.diagnosis_id = a.diagnosis_id WHERE a.claim_id = ? ORDER BY a.service_date, a.activity_row_id', [claimId]);
  c.labs = claims.all('SELECT * FROM lab_observation WHERE claim_id = ? ORDER BY code', [claimId]);
  return c;
}
function labs(claims, id, { code, limit = 2000 } = {}) {
  const rows = claims.all(`SELECT l.*, a.activity_desc FROM lab_observation l LEFT JOIN claim_activity a ON a.activity_id = l.activity_id AND a.claim_id = l.claim_id WHERE l.mask_id = ? ${code ? 'AND l.code = ?' : ''} ORDER BY l.result_date DESC, l.code LIMIT ?`, code ? [id, code, limit] : [id, limit]);
  for (const r of rows) r.name = LAB_NAMES[r.code] || r.description || r.code;
  return rows;
}
/** Labs grouped by code with the series (oldest → newest), for Member 360 charts. Values are parsed from REQUESTEDVALUE; the raw string is kept. */
function labSeries(claims, id) {
  const rows = labs(claims, id, { limit: 5000 }).filter(r => r.value_num !== null).reverse();
  const g = {};
  for (const r of rows) { const k = r.code; (g[k] = g[k] || { code: k, name: LAB_NAMES[k] || r.description || k, unit: r.value_unit || r.units, points: [] }).points.push({ date: r.result_date, value: r.value_num, raw: r.requested_value, claim_id: r.claim_id, observation_sk: r.observation_sk }); }
  return Object.values(g).map(s => ({ ...s, last: s.points[s.points.length - 1], n: s.points.length, key: KEY_LABS.includes(s.code) ? 1 : 0 })).sort((a, b) => b.key - a.key || b.n - a.n);
}
function medications(claims, id) {
  return claims.all(`SELECT generic_name, dosage_form, count(*) AS fills, MIN(service_date) AS first_fill, MAX(service_date) AS last_fill, SUM(drug_quantity) AS quantity, SUM(payable) AS payable, MAX(drug_tier) AS drug_tier,
    (SELECT claim_id FROM pharmacy_claim p2 WHERE p2.mask_id = p.mask_id AND p2.generic_name = p.generic_name ORDER BY service_date DESC LIMIT 1) AS last_claim_id
    FROM pharmacy_claim p WHERE mask_id = ? GROUP BY generic_name, dosage_form ORDER BY last_fill DESC`, [id]);
}
function medicationFills(claims, id, generic) { return claims.all('SELECT * FROM pharmacy_claim WHERE mask_id = ? AND generic_name = ? ORDER BY service_date DESC', [id, generic]); }
function procedures(claims, id, limit = 300) { return claims.all('SELECT * FROM procedure_activity WHERE mask_id = ? ORDER BY service_date DESC LIMIT ?', [id, limit]); }
function providers(claims, id) {
  return claims.all(`SELECT p.provider_id, p.facility_name, p.facility_type, p.group_owner_level, p.region, count(*) AS claims, SUM(c.payable) AS payable, MAX(c.service_date) AS last_visit FROM claim c JOIN provider p ON p.provider_id = c.provider_id WHERE c.mask_id = ? GROUP BY p.provider_id ORDER BY claims DESC`, [id]);
}
function clinicians(claims, id) {
  return claims.all(`SELECT cl.clinician_id, cl.clinician_name, cl.specialty, cl.profession, count(DISTINCT a.claim_id) AS claims, MAX(a.service_date) AS last_seen FROM claim_activity a JOIN clinician cl ON cl.clinician_id = a.clinician_id WHERE a.mask_id = ? GROUP BY cl.clinician_id ORDER BY claims DESC LIMIT 25`, [id]);
}
function costs(claims, id) {
  return { by_year: claims.all('SELECT cy AS year, count(*) AS claims, SUM(payable) AS payable, SUM(claimed) AS claimed, SUM(denial) AS denial FROM claim WHERE mask_id = ? GROUP BY cy ORDER BY cy', [id]),
    by_cost_block: claims.all('SELECT cost_block, count(*) AS activities, SUM(payable) AS payable FROM claim_activity WHERE mask_id = ? GROUP BY cost_block ORDER BY payable DESC', [id]),
    by_type: claims.all("SELECT encounter_type, count(*) AS claims, SUM(payable) AS payable FROM encounter WHERE mask_id = ? GROUP BY encounter_type", [id]) };
}
function utilisation(claims, id, asOf) {
  const since = asOf ? new Date(Date.parse(asOf) - 365 * 86400000).toISOString().slice(0, 10) : '1900-01-01';
  const r = claims.get(`SELECT SUM(encounter_type='IP') AS admissions_12m, SUM(encounter_type='ED') AS ed_visits_12m, SUM(encounter_type='OP') AS op_visits_12m, SUM(payable) AS payable_12m, count(*) AS claims_12m FROM encounter WHERE mask_id = ? AND service_date > ? AND service_date <= ?`, [id, since, asOf || '2999-12-31']);
  const all = claims.get(`SELECT SUM(encounter_type='IP') AS admissions, SUM(encounter_type='ED') AS ed_visits, SUM(encounter_type='OP') AS op_visits, SUM(payable) AS payable, count(*) AS claims, MIN(service_date) AS first_claim, MAX(service_date) AS last_claim FROM encounter WHERE mask_id = ?`, [id]);
  return { window_start: since, window_end: asOf, last_12m: r, all_time: all };
}
function summary(claims, id, asOf) {
  const m = member(claims, id); if (!m) return null;
  const pol = policies(claims, id)[0] || {};
  return { ...m, plan: pol.plan, product: pol.product, network: pol.network_desc, policy_id: pol.policy_id, utilisation: utilisation(claims, id, asOf), chronic_conditions: conditions(claims, id).filter(c => c.is_chronic_marker).slice(0, 12), key_labs: labSeries(claims, id).filter(s => s.key).slice(0, 8), medications: medications(claims, id).slice(0, 12), providers: providers(claims, id).slice(0, 5) };
}
module.exports = { member, policies, conditions, encounters, claimsList, claimDetail, labs, labSeries, medications, medicationFills, procedures, providers, clinicians, costs, utilisation, summary, LAB_NAMES };
