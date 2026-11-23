const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const { parse } = require('csv-parse/sync');

const ROOT = path.resolve(__dirname, '..', '..');
const SEED = path.join(ROOT, 'data', 'seed');
const SOURCE = path.join(ROOT, 'data', 'source');

function readCsv(file, opts = {}) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  return parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true, bom: true, delimiter: opts.delimiter || ',', trim: false });
}

/** Stream a (possibly gzipped) CSV line by line; calls onRow(objectOfStrings). Handles quoted fields with embedded commas/quotes (no embedded newlines in our seeds). */
async function streamCsv(file, onRow, { gz = file.endsWith('.gz') } = {}) {
  let input = fs.createReadStream(file);
  if (gz) input = input.pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let header = null, n = 0;
  for await (const line of rl) {
    if (!line) continue;
    const cells = splitCsvLine(line);
    if (!header) { header = cells.map(h => h.replace(/^﻿/, '')); continue; }
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = cells[i] === undefined ? '' : cells[i];
    await onRow(row, n++);
  }
  return n;
}

function splitCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const nul = v => (v === undefined || v === null || v === '' || v === 'NULL' || v === 'null') ? null : v;
const num = v => { v = nul(v); if (v === null) return null; const n = Number(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
/** Dates arrive as ISO (seed CSV), "M/D/YYYY" (longitudinal TSV) or Excel serials. Returns YYYY-MM-DD or null. */
function isoDate(v) {
  v = nul(v); if (v === null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  if (/^\d{5}$/.test(s)) { const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000); return d.toISOString().slice(0, 10); }
  return null;
}
const daysBetween = (fromIso, toIso) => Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86400000);
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

/** Read an .xlsx sheet into row objects (used only by `npm run setup:from-excel`). */
function readXlsxSheet(file, sheetName) {
  const XLSX = require('xlsx');
  const wb = XLSX.readFile(file, { cellDates: true, dense: true });
  const ws = wb.Sheets[sheetName || wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
  for (const r of rows) for (const k of Object.keys(r)) if (r[k] instanceof Date) r[k] = r[k].toISOString().slice(0, 10);   // bind-safe: dates as ISO text
  return rows;
}

function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }

module.exports = { ROOT, SEED, SOURCE, readCsv, streamCsv, nul, num, isoDate, daysBetween, now, readXlsxSheet, log };
