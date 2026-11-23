/**
 * Layer A importer: raw claims workbook(s) → data/db/claims.sqlite
 * Default input: data/seed/claims_activity.csv.gz (+ lab_results.csv, observation_dictionary.csv), produced 1:1 from the three
 * Raw_Claims_250_Members_Part_N_of_3.xlsx files (sheet "in" concatenated, "Lab Results" de-duplicated on OBSERVATION_SK).
 * `--from-excel` reads the .xlsx files in data/source directly instead (slower, needs ~2 GB RAM).
 */
const fs = require('fs');
const path = require('path');
const { openDatabase } = require('../database/adapter');
const U = require('./util');

const CHRONIC = /^(E11|I1[0-5]|N18|E78|E66|I50|I25|I63|I48|E10|E13|E16|E87|G62|H36|I70|I73|L97|Z89)/;

async function importClaims({ fromExcel = false } = {}) {
  const db = await openDatabase('claims', { fresh: true });
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'schema_claims.sql'), 'utf8'));
  db.db.run('PRAGMA foreign_keys = OFF');   // facts are loaded before their dimensions; integrity is checked at the end
  const t0 = Date.now();
  const members = new Map(), policies = new Map(), providers = new Map(), clinicians = new Map(), dx = new Map(), claims = new Map();
  const insAct = db.prepare(`INSERT INTO claim_activity (claim_id, mask_id, activity_id, activity_detail_id, activity_detail_type, activity_desc, service_id, service_desc,
    service_group, cpt_category, cost_block, benefit_group_type, benefit_desc, health_code, diagnosis_id, clinician_id, service_date, payable, claimed, denial,
    drug_quantity, package_size, package_unit, dosage_form, generic_name, drug_category, drug_tier, concatenated, category, major)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  let n = 0;
  db.begin();
  const onRow = (r) => {
    const mid = U.nul(r.mask_id); if (!mid) return;
    const date = U.isoDate(r.DATEOFSERVICE);
    const pay = U.num(r.PAYABLE) || 0, clm = U.num(r.CLAIMED) || 0, den = U.num(r.DENIAL) || 0;
    // dimensions
    let m = members.get(mid);
    if (!m) { m = { mask_id: mid, gender: U.nul(r.GENDER), age_category: U.nul(r.AGECATEGORY), member_relation: U.nul(r.MEMBERRELATION), principal_id: U.nul(r.E_PRINCIPAL_ID), first: date, last: date, claims: new Set(), acts: 0, pay: 0 }; members.set(mid, m); }
    if (date) { if (!m.first || date < m.first) m.first = date; if (!m.last || date > m.last) { m.last = date; m.age_category = U.nul(r.AGECATEGORY) || m.age_category; m.member_relation = U.nul(r.MEMBERRELATION) || m.member_relation; } }
    m.acts++; m.pay += pay; m.claims.add(r.CLAIM_ID);
    const pk = mid + '|' + r.POLICY_ID;
    if (!policies.has(pk)) policies.set(pk, { mask_id: mid, policy_id: U.nul(r.POLICY_ID), e_policy_id: U.nul(r.E_POLICY_ID), main_policy_group_id: U.nul(r.MAINPOLICYGROUP_ID), e_mpg_id: U.nul(r.E_MPG_ID), policy_group_id: U.nul(r.POLICYGROUP_ID), e_pg_id: U.nul(r.E_PG_ID),
      effective_date: U.isoDate(r.EFFECTIVEDATE), expiry_date: U.isoDate(r.EXPIRYDATE), cancellation_date: U.isoDate(r.CANCELLATIONDATE), member_effective_date: U.isoDate(r.MEM_EFF_DATE), enrollment_date: U.isoDate(r.ENROLLMENTDATE), deletion_date: U.isoDate(r.DELETIONDATE),
      product: U.nul(r.PRODUCT), plan: U.nul(r.PLAN), package_id: U.nul(r.PACKAGE_ID), package_type: U.nul(r.PACKAGETYPE), network_id: U.nul(r.NETWORK_ID), network_desc: U.nul(r.NETOWRK_DESC), network_group_auh: U.nul(r.NETWORKGROUPAUH), network_group_dxb: U.nul(r.NETWORKGROUPDXB), network_group: U.nul(r.NETWORKGROUP), business_uy: U.nul(r.BUSINESS_UY), claims: new Set() });
    policies.get(pk).claims.add(r.CLAIM_ID);
    if (U.nul(r.PROVIDER_ID) && !providers.has(r.PROVIDER_ID)) providers.set(r.PROVIDER_ID, [r.PROVIDER_ID, U.nul(r.FACILITY_NAME), U.nul(r.FACILITY_TYPE), U.nul(r.GROUPLEVEL), U.nul(r.GROUPOWNERLEVEL), U.nul(r.SUPERGROUPLEVEL), U.nul(r.REGION), U.nul(r.TERRITORY)]);
    if (U.nul(r.CLINICIAN_ID) && !clinicians.has(r.CLINICIAN_ID)) clinicians.set(r.CLINICIAN_ID, [r.CLINICIAN_ID, U.nul(r.CLINICIAN_NAME), U.nul(r.PROFESSION), U.nul(r.SPECIALTY)]);
    if (U.nul(r.DIAGNOSIS_ID) && !dx.has(r.DIAGNOSIS_ID)) dx.set(r.DIAGNOSIS_ID, [r.DIAGNOSIS_ID, U.nul(r.GROUP2), U.nul(r.GROUP3), U.nul(r.GROUP4), CHRONIC.test(r.DIAGNOSIS_ID) ? 1 : 0]);
    let c = claims.get(r.CLAIM_ID);
    if (!c) { c = { claim_id: r.CLAIM_ID, mask_id: mid, episode_id: U.nul(r.EPISODE_ID), audit_id: U.nul(r.AUDIT_ID), policy_id: U.nul(r.POLICY_ID), provider_id: U.nul(r.PROVIDER_ID), clinician_id: U.nul(r.CLINICIAN_ID), bg_ipop: U.nul(r.BG_IPOP), admit_desc: U.nul(r.ADMIT_DESC), discharge_desc: U.nul(r.DISC_DESCRIPTION),
      service_date: date, service_date_to: date, admit_date: U.isoDate(r.ADMIT_DATE), discharge_date: U.isoDate(r.DISCHARGE_DATE), los_days: U.num(r.LOS_DAYS), cyyyymm: U.nul(r.CYYYYMM), cy: U.num(r.CY), invoice_status: U.nul(r.INVOICESTATUS), primary_diagnosis_id: U.nul(r.DIAGNOSIS_ID), category: U.nul(r.CATEGORY), major: U.nul(r.MAJOR), n: 0, pay: 0, clm: 0, den: 0 }; claims.set(r.CLAIM_ID, c); }
    if (date) { if (!c.service_date || date < c.service_date) c.service_date = date; if (!c.service_date_to || date > c.service_date_to) c.service_date_to = date; }
    if (c.bg_ipop !== 'IP' && r.BG_IPOP === 'IP') c.bg_ipop = 'IP';
    c.n++; c.pay += pay; c.clm += clm; c.den += den;
    insAct([r.CLAIM_ID, mid, U.nul(r.ACTIVITY_ID), U.nul(r.ACTIVITYDETAIL_ID), U.nul(r.ACTIVITYDETAILTYPE_ID), U.nul(r.ACTIVITY_DESC), U.nul(r.SERVICE_ID), U.nul(r.SER_DESC), U.nul(r.SERVICEGROUP), U.nul(r.CPTCATEGORY3), U.nul(r.COSTBLOCK), U.nul(r.BENEFITGROUPTYPE2), U.nul(r.BENEFIT_DESC), U.nul(r.HEALTHCODE), U.nul(r.DIAGNOSIS_ID), U.nul(r.CLINICIAN_ID), date, pay, clm, den,
      U.num(r.DRUG_QUANTITY), U.nul(r.PACKAGESIZE), U.nul(r.PACKAGEUNIT), U.nul(r.DOSAGEFORM), U.nul(r.GENERICNAME), U.nul(r.DRUG_CATEGORY), U.nul(r.DRUG_TIERS), U.nul(r.Concatenated), U.nul(r.CATEGORY), U.nul(r.MAJOR)]);
    n++;
    if (n % 20000 === 0) U.log(`  claims: ${n} activity rows`);
  };
  const sources = [];
  if (fromExcel) {
    for (const f of fs.readdirSync(U.SOURCE).filter(f => /^Raw_Claims.*\.xlsx$/i.test(f)).sort()) {
      U.log('reading', f); const rows = U.readXlsxSheet(path.join(U.SOURCE, f), 'in'); rows.forEach(onRow); sources.push({ f, n: rows.length });
    }
  } else {
    const f = path.join(U.SEED, 'claims_activity.csv.gz');
    const cnt = await U.streamCsv(f, onRow); sources.push({ f: 'claims_activity.csv.gz', n: cnt });
  }
  insAct.free();
  // dimensions + facts
  const insM = db.prepare('INSERT INTO member VALUES (?,?,?,?,?,?,?,?,?,?)');
  for (const m of members.values()) insM([m.mask_id, m.gender, m.age_category, m.member_relation, m.principal_id, m.first, m.last, m.claims.size, m.acts, Math.round(m.pay * 100) / 100]);
  insM.free();
  const insP = db.prepare('INSERT INTO member_policy VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const p of policies.values()) insP([p.mask_id, p.policy_id, p.e_policy_id, p.main_policy_group_id, p.e_mpg_id, p.policy_group_id, p.e_pg_id, p.effective_date, p.expiry_date, p.cancellation_date, p.member_effective_date, p.enrollment_date, p.deletion_date, p.product, p.plan, p.package_id, p.package_type, p.network_id, p.network_desc, p.network_group_auh, p.network_group_dxb, p.network_group, p.business_uy, p.claims.size]);
  insP.free();
  const insPr = db.prepare('INSERT INTO provider VALUES (?,?,?,?,?,?,?,?)'); for (const v of providers.values()) insPr(v); insPr.free();
  const insCl = db.prepare('INSERT INTO clinician VALUES (?,?,?,?)'); for (const v of clinicians.values()) insCl(v); insCl.free();
  const insDx = db.prepare('INSERT INTO diagnosis_code VALUES (?,?,?,?,?)'); for (const v of dx.values()) insDx(v); insDx.free();
  const insC = db.prepare('INSERT INTO claim VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const c of claims.values()) insC([c.claim_id, c.mask_id, c.episode_id, c.audit_id, c.policy_id, c.provider_id, clinicians.has(c.clinician_id) ? c.clinician_id : null, c.bg_ipop, c.admit_desc, c.discharge_desc, c.service_date, c.service_date_to, c.admit_date, c.discharge_date, c.los_days, c.cyyyymm, c.cy, c.invoice_status, dx.has(c.primary_diagnosis_id) ? c.primary_diagnosis_id : null, c.category, c.major, c.n, Math.round(c.pay * 100) / 100, Math.round(c.clm * 100) / 100, Math.round(c.den * 100) / 100]);
  insC.free();
  db.commit();
  U.log(`  claims: ${n} activities, ${claims.size} claims, ${members.size} members, ${providers.size} providers, ${clinicians.size} clinicians, ${dx.size} diagnosis codes`);

  // Lab results (linked to claims through ACTIVITY_ID → member and date)
  db.begin();
  const actIndex = new Map();
  for (const r of db.all('SELECT activity_id, mask_id, service_date, claim_id FROM claim_activity WHERE activity_id IS NOT NULL')) if (!actIndex.has(r.activity_id)) actIndex.set(r.activity_id, r);
  const insL = db.prepare('INSERT OR IGNORE INTO lab_observation VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  let labs = 0, linked = 0;
  const labRow = (r) => {
    const val = U.nul(r.REQUESTEDVALUE) || U.nul(r.APPROVEDVALUE);
    let vnum = null, vunit = U.nul(r.Units);
    if (val) { const m = String(val).match(/^\s*([<>]?=?\s*-?\d+(?:\.\d+)?)\s*(?:\/\s*(.*))?$/); if (m) { vnum = Number(m[1].replace(/[<>=\s]/g, '')); if (m[2]) vunit = m[2].trim(); } }
    const a = actIndex.get(String(r.ACTIVITY_ID)); if (a) linked++;
    insL([String(r.OBSERVATION_SK), U.nul(r.ACTIVITY_SK), U.nul(r.ACTIVITY_ID), U.nul(r.OBSERVATIONTYPE_SK), U.nul(r.OBSERVATION_ID), U.nul(r.CODE), U.nul(r.Description), U.nul(r.VALUETYPE), U.nul(r.REQUESTEDVALUE), U.nul(r.APPROVEDVALUE), U.nul(r.OBSERVATIONTYPE_ID), U.nul(r.OBJECTTYPE), U.nul(r.SRC_SYS_ID), U.nul(r.Units),
      vnum, vunit, a ? a.mask_id : null, a ? a.service_date : null, a ? a.claim_id : null]);
    labs++;
  };
  let dict = [];
  if (fromExcel) {
    const f = fs.readdirSync(U.SOURCE).filter(f => /^Raw_Claims.*\.xlsx$/i.test(f)).sort()[0];
    U.readXlsxSheet(path.join(U.SOURCE, f), 'Lab Results').forEach(labRow);
    dict = U.readXlsxSheet(path.join(U.SOURCE, f), 'Sheet2');
  } else {
    U.readCsv(path.join(U.SEED, 'lab_results.csv')).forEach(labRow);
    dict = U.readCsv(path.join(U.SEED, 'observation_dictionary.csv'));
  }
  insL.free();
  const insD = db.prepare('INSERT INTO observation_dictionary VALUES (?,?,?,?,?)');
  for (const d of dict) insD([U.nul(d.Type), U.nul(d.Code), U.nul(d.Description), U.nul(d.Value), U.nul(d.ValueType)]);
  insD.free();
  for (const s of sources) db.run('INSERT INTO import_log (source_file, sheet, rows_read, rows_loaded, started_at, finished_at) VALUES (?,?,?,?,?,?)', [s.f, 'in', s.n, n, U.now(), U.now()]);
  db.run('INSERT INTO import_log (source_file, sheet, rows_read, rows_loaded, started_at, finished_at) VALUES (?,?,?,?,?,?)', ['Raw_Claims_250_Members (all parts)', 'Lab Results', labs, labs, U.now(), U.now()]);
  db.commit();
  db.db.run('PRAGMA foreign_keys = ON');
  const fk = db.all('PRAGMA foreign_key_check');
  if (fk.length) U.log(`  WARNING: ${fk.length} foreign-key violations`, fk.slice(0, 3));
  db._dirty = true;
  U.log(`  labs: ${labs} observations, ${linked} linked to a claim activity, ${dict.length} dictionary rows · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  db.save();
  return { activities: n, claims: claims.size, members: members.size, labs, linked, seconds: (Date.now() - t0) / 1000, db };
}

module.exports = { importClaims };
if (require.main === module) importClaims({ fromExcel: process.argv.includes('--from-excel') }).then(r => { delete r.db; console.log(r); });
