/**
 * Layer B importer: 250_members_longitudinal_data.xlsx (377 columns) → member_longitudinal in data/db/ccl.sqlite
 * Every source column is kept with its original header as the column name (quoted identifiers), values stored as text
 * exactly as in the file ("NULL" → SQL NULL). Typed access happens in rule-engine/features.js using longitudinal_field.type.
 * Default input is data/seed/member_longitudinal.tsv (a 1:1 export of the sheet); `--from-excel` reads the .xlsx.
 */
const fs = require('fs');
const path = require('path');
const U = require('./util');

const FIRST = {
  'M|arab': ['Ahmed', 'Mohammed', 'Khalid', 'Saeed', 'Omar', 'Hamad', 'Rashid', 'Salem', 'Majid', 'Sultan', 'Yousef', 'Abdulla'],
  'F|arab': ['Fatima', 'Mariam', 'Aisha', 'Noura', 'Hessa', 'Latifa', 'Shamsa', 'Alya', 'Moza', 'Sara', 'Reem', 'Amna'],
  'M|other': ['Rajesh', 'Vikram', 'Joseph', 'Imran', 'Suresh', 'Daniel', 'Arun', 'Tariq', 'George', 'Faisal', 'Anil', 'Peter'],
  'F|other': ['Priya', 'Maria', 'Anita', 'Grace', 'Shabana', 'Lakshmi', 'Nadia', 'Rose', 'Farah', 'Meera', 'Lina', 'Jasmine'],
};
const LAST = { arab: ['Al Hammadi', 'Al Mazrouei', 'Al Suwaidi', 'Al Nuaimi', 'Al Kaabi', 'Al Shamsi', 'Al Mansoori', 'Al Dhaheri', 'Al Ketbi', 'Al Marri'],
  other: ['Nair', 'Shetty', 'Mathew', 'Sheikh', 'Kumar', 'Santos', 'Haddad', 'Khan', 'Fernandes', 'Pillai'] };
const ARAB = new Set(['EMIRATI', 'UAE', 'SAUDI', 'OMANI', 'EGYPTIAN', 'JORDANIAN', 'SYRIAN', 'LEBANESE', 'PALESTINIAN', 'SUDANESE', 'YEMENI', 'IRAQI', 'BAHRAINI', 'KUWAITI', 'QATARI', 'MOROCCAN', 'TUNISIAN', 'ALGERIAN', 'LIBYAN']);
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
/** Deterministic pseudonym: the sources carry no names; the screens need one. Always shown next to the mask_id. */
function pseudonym(maskId, gender, nationality) {
  const grp = ARAB.has(String(nationality || '').toUpperCase()) ? 'arab' : 'other';
  const g = gender === 'F' ? 'F' : 'M';
  const f = FIRST[g + '|' + grp][hash(maskId + 'f') % 12], l = LAST[grp][hash(maskId + 'l') % 10];
  return { name: f + ' ' + l, initials: f[0] + l.replace('Al ', '')[0] };
}

const NUMERIC = new Set(['num', 'flag', 'share', 'money']);
function sqlType(t) { return NUMERIC.has(t) ? 'REAL' : 'TEXT'; }

async function importLongitudinal(db, { fromExcel = false } = {}) {
  const t0 = Date.now();
  let rows, header;
  if (fromExcel) {
    rows = U.readXlsxSheet(path.join(U.SOURCE, '250_members_longitudinal_data.xlsx'));
    header = Object.keys(rows[0]);
  } else {
    const text = fs.readFileSync(path.join(U.SEED, 'member_longitudinal.tsv'), 'utf8').replace(/^﻿/, '');
    const lines = text.split(/\r?\n/).filter(l => l.length);
    header = lines[0].split('\t');
    rows = lines.slice(1).map(l => { const c = l.split('\t'); const o = {}; header.forEach((h, i) => o[h] = c[i] === undefined ? '' : c[i]); return o; });
  }
  // field catalogue: rule_field.csv (types, groups, descriptions) + glossary
  const fieldRows = U.readCsv(path.join(U.SEED, 'rules', 'rule_field.csv'));
  const meta = new Map(fieldRows.map(r => [r.field, r]));
  db.exec('DROP TABLE IF EXISTS member_longitudinal');
  const cols = header.map(h => { const m = meta.get(h); const t = m ? m.type : (/_date$|_Date$|^last_.*(visit|exam|date)|^first_/.test(h) ? 'date' : 'text'); return { name: h, type: t }; });
  db.exec(`CREATE TABLE member_longitudinal (\n  ${cols.map(c => `"${c.name.replace(/"/g, '""')}" ${c.name === 'mask_id' ? 'TEXT PRIMARY KEY' : sqlType(c.type)}`).join(',\n  ')}\n)`);
  db.begin();
  const ins = db.prepare(`INSERT INTO member_longitudinal VALUES (${header.map(() => '?').join(',')})`);
  for (const r of rows) {
    ins(cols.map(c => { const v = U.nul(r[c.name]); if (v === null) return null; if (NUMERIC.has(c.type)) { const n = U.num(v); return n === null ? null : n; } if (c.type === 'date') return U.isoDate(v) || String(v); return String(v); }));
  }
  ins.free();
  db.run('DELETE FROM longitudinal_field');
  const insF = db.prepare('INSERT OR REPLACE INTO longitudinal_field VALUES (?,?,?,?,?,?)');
  for (const c of cols) { const m = meta.get(c.name) || {}; insF([c.name, m.sql_name || c.name.toLowerCase().replace(/[^a-z0-9_]+/g, '_'), c.type, m.group || null, m.read_by_rules || null, m.description || null]); }
  insF.free();
  db.run('DELETE FROM member_identifier_crosswalk');
  const insX = db.prepare('INSERT INTO member_identifier_crosswalk VALUES (?,?,?,?,?,?,?)');
  for (const r of rows) { const p = pseudonym(r.mask_id, r.GENDER, r.NATIONALITY); insX([r.mask_id, r.mask_id, null, p.name, p.initials, 1, 0]); }
  insX.free();
  db.commit();
  U.log(`  longitudinal: ${rows.length} members × ${header.length} columns · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { members: rows.length, columns: header.length };
}

/** Mark which members also exist in the claims database (called after both importers ran). */
function linkCrosswalk(ccl, claims) {
  const ids = new Set(claims.all('SELECT mask_id FROM member').map(r => r.mask_id));
  ccl.begin();
  for (const r of ccl.all('SELECT member_id FROM member_identifier_crosswalk')) if (ids.has(r.member_id)) ccl.run('UPDATE member_identifier_crosswalk SET claims_mask_id = ?, in_claims = 1 WHERE member_id = ?', [r.member_id, r.member_id]);
  for (const id of ids) if (!ccl.get('SELECT 1 FROM member_identifier_crosswalk WHERE member_id = ?', [id])) { const m = claims.get('SELECT gender FROM member WHERE mask_id = ?', [id]); const p = pseudonym(id, m.gender, ''); ccl.run('INSERT INTO member_identifier_crosswalk VALUES (?,?,?,?,?,?,?)', [id, null, id, p.name, p.initials, 0, 1]); }
  ccl.commit();
  return ccl.get('SELECT sum(in_longitudinal) AS l, sum(in_claims) AS c, sum(in_longitudinal*in_claims) AS both FROM member_identifier_crosswalk');
}

module.exports = { importLongitudinal, linkCrosswalk, pseudonym };
