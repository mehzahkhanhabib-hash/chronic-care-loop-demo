/** Builder field catalogue: the rules the backend's cohort compiler understands (backend/services/cohorts.js).
 *  Rulebook §2: cohort filters are raw inputs only; risk scores, triggers and personas are outputs and are never selectable. */
export const COND = [['E11', 'Type 2 diabetes'], ['I10', 'Hypertension'], ['E78', 'Dyslipidaemia'], ['E66', 'Obesity'], ['N18', 'Chronic kidney disease'], ['I50', 'Heart failure'], ['I25', 'Coronary artery disease'], ['I63', 'Stroke'], ['I73', 'Peripheral arterial disease']];
export const LABS = { hba1c: ['HbA1c', '%', '≥', 8], egfr: ['eGFR', 'mL/min', '≤', 60], uacr: ['UACR', 'mg/g', '≥', 30], sbp: ['Systolic BP', 'mmHg', '≥', 140], dbp: ['Diastolic BP', 'mmHg', '≥', 90], bmi: ['BMI', 'kg/m²', '≥', 30] };
export const LAB_DATES = { hba1c: 'HbA1c', egfr: 'eGFR', uacr: 'UACR', ldl: 'LDL / lipid panel', k: 'Potassium' };
export const SPEC = [['GP', 'GP / family medicine'], ['ENDO', 'Endocrinology'], ['CARD', 'Cardiology'], ['NEPH', 'Nephrology'], ['OPH', 'Ophthalmology'], ['DIET', 'Dietitian'], ['POD', 'Podiatry']];
export const ATC = [['A10', 'Diabetes medicines'], ['A10A', 'Insulin'], ['C09', 'ACE / ARB'], ['C07', 'Beta blockers'], ['C03', 'Thiazide diuretics'], ['C08', 'Calcium-channel blockers']];
export const F = {
  age: { cat: 'Who they are', label: 'Age', type: 'num', unit: 'years', op: 'between', v: 40, v2: 65, col: 'AGE' },
  gender: { cat: 'Who they are', label: 'Gender', type: 'enum', opts: [['F', 'Female'], ['M', 'Male']], col: 'GENDER' },
  nat: { cat: 'Who they are', label: 'Nationality', type: 'enum', opts: [['UAE', 'UAE national'], ['EXP', 'Expatriate']], col: 'NATIONALITY' },
  plan: { cat: 'Who they are', label: 'Plan type', type: 'enum', opts: [['ENH', 'Group'], ['KEY', 'Key Clients'], ['IND', 'Individual']], col: 'policy_type' },
  dx: { cat: 'Health', label: 'Has condition', type: 'code', opts: COND, sub: 'condition flags in the extract', col: 'cohort_* / flag_*' },
  newdx: { cat: 'Health', label: 'Newly diagnosed', type: 'code', opts: COND.slice(0, 2), sub: 'first code in the last 90 days', col: 'first_e11_date / first_htn_date' },
  ncc: { cat: 'Health', label: 'Chronic conditions', type: 'num', unit: 'conditions', op: '≥', v: 2, col: 'count of condition flags' },
  lab: { cat: 'Tests & results', label: 'Latest result', type: 'lab', sub: 'last value in the extract', col: 'Last_*_Value' },
  labage: { cat: 'Tests & results', label: 'Test overdue', type: 'labage', sub: 'no result in N days', col: 'last_*_date' },
  ed: { cat: 'Visits & admissions', label: 'ED visits · 12 months', type: 'num', unit: 'visits', op: '≥', v: 2, col: 'ed_visits_l12m' },
  ip: { cat: 'Visits & admissions', label: 'Admissions · 12 months', type: 'num', unit: 'stays', op: '≥', v: 1, col: 'ip_admissions_l12m' },
  readm: { cat: 'Visits & admissions', label: 'Readmitted within 30 days', type: 'bool', col: 'last_ip_admit_date vs second_last_ip_discharge_date' },
  nofu: { cat: 'Visits & admissions', label: 'No visit for', type: 'num', unit: 'days', op: '≥', v: 180, col: 'last_visit_date' },
  spec: { cat: 'Visits & admissions', label: 'Saw a specialist · 12 months', type: 'code', opts: SPEC, col: 'last_*_visit' },
  atc: { cat: 'Medicines', label: 'Takes medicine class', type: 'code', opts: ATC, col: 'flag_active_* / active_drug_classes' },
  pdc: { cat: 'Medicines', label: 'Adherence (PDC)', type: 'num', unit: '%', op: '≤', v: 80, col: 'pdc_any_t2d_noninsulin / pdc_any_htn' },
  poly: { cat: 'Medicines', label: 'Medicine classes', type: 'num', unit: 'classes', op: '≥', v: 5, col: 'active_drug_class_count' },
  eye: { cat: 'Screenings', label: 'Eye exam not on record', type: 'bool', sub: '24 months', col: 'last_retinal_screen_date' },
  foot: { cat: 'Screenings', label: 'Foot exam not on record', type: 'bool', sub: '12 months', col: 'last_foot_exam' },
  innet: { cat: 'Network & cost', label: 'Visits in PHG network', type: 'num', unit: '%', op: '≤', v: 25, col: 'phg_share_l12m_encounters' },
  cost: { cat: 'Network & cost', label: 'Claims cost · 12 months', type: 'num', unit: 'AED', op: '≥', v: 50000, col: 'l12m_payable_DiaborHTNrelated' },
  contacted: { cat: 'Engagement & consent', label: 'Contacted by the care team', type: 'num', unit: 'days ago or less', op: '≤', v: 90, excl: 1, col: 'contact_attempt' },
  optout: { cat: 'Engagement & consent', label: 'Opted out of contact', type: 'bool', excl: 1, col: 'consent_event' },
  pregnant: { cat: 'Engagement & consent', label: 'Currently pregnant', type: 'bool', excl: 1, col: 'flag_excl_pregnant_postpartum' },
  onco: { cat: 'Engagement & consent', label: 'Active cancer treatment', type: 'bool', excl: 1, col: 'flag_oncology_l24m' },
};
export const CATS = ['Who they are', 'Health', 'Tests & results', 'Visits & admissions', 'Medicines', 'Screenings', 'Network & cost', 'Engagement & consent'];
export const NOT_SELECTABLE = ['Risk score and tier', 'Triggers (Trig1–13, BPU)', 'Persona', 'Alert colour'];
export const BASES = [{ id: 'daman', label: 'Daman members', src: 'Longitudinal extract' }, { id: 'seha', label: 'SEHA patients', src: 'PHG / SEHA encounters' }, { id: 'pura', label: 'PURA app users', src: 'Not in this extract' }];
export const TEMPLATES = [
  { name: 'Diabetes · above goal', d: 'Type 2 diabetes with HbA1c at or above 8%', inc: [{ f: 'dx', vs: ['E11'] }, { f: 'lab', l: 'hba1c', op: '≥', v: 8 }], exc: [{ f: 'optout' }] },
  { name: 'Hypertension · drifting from care', d: 'Hypertension and no visit for 180 days', inc: [{ f: 'dx', vs: ['I10'] }, { f: 'nofu', op: '≥', v: 180 }], exc: [{ f: 'optout' }] },
  { name: 'Post-discharge chronic', d: 'Any chronic condition and an admission in 12 months', inc: [{ f: 'ncc', op: '≥', v: 1 }, { f: 'ip', op: '≥', v: 1 }], exc: [{ f: 'optout' }] },
  { name: 'Diabetes · eye and foot gaps', d: 'Type 2 diabetes with no eye or foot exam on record', inc: [{ f: 'dx', vs: ['E11'] }, { f: 'eye' }, { f: 'foot' }], exc: [{ f: 'optout' }] },
];
let rid = 1000;
export function newRule(f, preset) {
  const d = F[f]; const r = { id: ++rid, f };
  if (d.type === 'num') { r.op = d.op; r.v = d.v; r.v2 = d.v2 ?? d.v; }
  else if (d.type === 'enum' || d.type === 'code') r.vs = [];
  else if (d.type === 'lab') { r.l = 'hba1c'; r.op = LABS.hba1c[2]; r.v = LABS.hba1c[3]; r.v2 = LABS.hba1c[3] + 2; }
  else if (d.type === 'labage') { r.l = 'hba1c'; r.v = 180; }
  return Object.assign(r, preset || {});
}
export const ruleOn = r => { const d = F[r.f]; return !!d && !((d.type === 'enum' || d.type === 'code') && !(r.vs || []).length); };
export function ruleText(r) {
  const d = F[r.f]; if (!d) return r.f;
  if (d.type === 'num') return `${d.label} ${r.op === 'between' ? r.v + '–' + r.v2 : r.op + ' ' + (+r.v >= 1000 ? Number(r.v).toLocaleString('en-US') : r.v)}${d.unit ? ' ' + d.unit : ''}`;
  if (d.type === 'bool') return d.label;
  if (d.type === 'enum' || d.type === 'code') return `${d.label}: ${(r.vs || []).map(v => (d.opts.find(o => o[0] === v) || [v, v])[1]).join(' or ') || 'any'}`;
  if (d.type === 'lab') { const L = LABS[r.l] || LABS.hba1c; return `${L[0]} ${r.op === 'between' ? r.v + '–' + r.v2 : r.op + ' ' + r.v} ${L[1]}`; }
  if (d.type === 'labage') return `${LAB_DATES[r.l] || r.l} not done in ${r.v} days`;
  return d.label;
}
export const strip = r => ({ id: r.id, f: r.f, op: r.op, v: r.v, v2: r.v2, vs: r.vs || [], l: r.l });
/** Very small natural-language parser for the "describe people" box (feature catalogue only). */
export function parseDescription(text) {
  const t = (text || '').toLowerCase(); const inc = [], exc = [];
  const parts = t.split(/\b(?:excluding|except|but not|without)\b/); const pos = parts[0], neg = parts.slice(1).join(' ');
  const lex = [[/type\s*2\s*diabet\w*|\bdiabet\w*|\bt2d\b/, 'E11'], [/hypertens\w*|high blood pressure|\bhtn\b/, 'I10'], [/kidney disease|\bckd\b/, 'N18'], [/heart failure/, 'I50'], [/dyslipid\w*|cholesterol/, 'E78'], [/obes\w*/, 'E66'], [/stroke/, 'I63'], [/coronary|\bcad\b|heart disease/, 'I25']];
  const codes = s => lex.filter(([re]) => re.test(s)).map(([, c]) => c);
  const pc = codes(pos); if (pc.length) inc.push(newRule('dx', { vs: pc }));
  const nc = codes(neg); if (nc.length) exc.push(newRule('dx', { vs: nc }));
  const a1 = pos.match(/hba1c\D{0,12}(above|over|>|≥|at least)\s*(\d+(?:\.\d+)?)/); if (a1) inc.push(newRule('lab', { l: 'hba1c', op: '≥', v: Number(a1[2]) }));
  const bp = pos.match(/(?:bp|blood pressure|systolic)\D{0,12}(above|over|>|≥)\s*(\d{2,3})/); if (bp) inc.push(newRule('lab', { l: 'sbp', op: '≥', v: Number(bp[2]) }));
  if (/no (eye|retina)/.test(pos)) inc.push(newRule('eye')); if (/no foot/.test(pos)) inc.push(newRule('foot'));
  if (/refill|adheren|missing (their )?medic/.test(pos)) inc.push(newRule('pdc', { op: '≤', v: 80 }));
  if (/admi(tted|ssion)|discharg/.test(pos)) inc.push(newRule('ip', { op: '≥', v: 1 }));
  if (/\bed\b|emergency/.test(pos)) inc.push(newRule('ed', { op: '≥', v: 2 }));
  const age = pos.match(/(?:over|above|older than)\s*(\d{2})/); if (age) inc.push(newRule('age', { op: '≥', v: Number(age[1]) }));
  if (/opt(ed)?[- ]?out/.test(neg) || /opted out/.test(t)) exc.push(newRule('optout'));
  if (/pregnan/.test(neg)) exc.push(newRule('pregnant')); if (/cancer|oncolog/.test(neg)) exc.push(newRule('onco'));
  return { inc, exc };
}
