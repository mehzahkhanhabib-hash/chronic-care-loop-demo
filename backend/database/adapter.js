/**
 * Database adapter: one small module every service goes through.
 * Default engine is SQLite via sql.js (pure WebAssembly: no native build, runs on any Windows/macOS/Linux Node).
 * Two files: claims.sqlite (Layer A, raw claims; written only by the importer) and ccl.sqlite (Layers B–E).
 * To migrate to MySQL later, implement the same four methods (run/get/all/exec) over a mysql2 pool and
 * swap `openDatabase` — services never touch sql.js directly.
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_DIR = path.resolve(process.env.CCL_DB_DIR || path.join(__dirname, '..', '..', 'data', 'db'));
let SQL = null;

async function engine() {
  if (!SQL) SQL = await initSqlJs();
  return SQL;
}

class Database {
  constructor(name, db) {
    this.name = name;
    this.file = path.join(DB_DIR, name + '.sqlite');
    this.db = db;
    this._dirty = false;
    this._timer = null;
    this._inTx = 0;
    this.db.run('PRAGMA foreign_keys = ON');
  }
  /** INSERT/UPDATE/DELETE. Returns {changes, lastId}. */
  run(sql, params = []) {
    this.db.run(sql, params);
    this._dirty = true;
    this._scheduleSave();
    const changes = this.db.getRowsModified();
    const r = this.db.exec('SELECT last_insert_rowid() AS id');
    return { changes, lastId: r.length ? r[0].values[0][0] : null };
  }
  /** One row as an object, or null. */
  get(sql, params = []) {
    const st = this.db.prepare(sql);
    try {
      st.bind(params);
      return st.step() ? st.getAsObject() : null;
    } finally { st.free(); }
  }
  /** All rows as objects. */
  all(sql, params = []) {
    const st = this.db.prepare(sql);
    const out = [];
    try {
      st.bind(params);
      while (st.step()) out.push(st.getAsObject());
    } finally { st.free(); }
    return out;
  }
  /** Run a multi-statement script (DDL). */
  exec(sql) { this.db.exec(sql); this._dirty = true; this._scheduleSave(); }
  /** Prepared statement for bulk inserts: returns a function(paramsArray). Call .free() when done. */
  prepare(sql) {
    const st = this.db.prepare(sql);
    const fn = (params) => { st.run(params); };
    fn.free = () => st.free();
    this._dirty = true;
    return fn;
  }
  transaction(fn) {
    this.begin();
    try { const r = fn(); this.commit(); return r; }
    catch (e) { this.rollback(); throw e; }
  }
  /** Explicit transaction control for bulk loads (saves are held back until commit). */
  begin() { this.db.run('BEGIN'); this._inTx++; }
  commit() { this.db.run('COMMIT'); this._inTx = Math.max(0, this._inTx - 1); this._dirty = true; this._scheduleSave(); }
  rollback() { this.db.run('ROLLBACK'); this._inTx = Math.max(0, this._inTx - 1); }
  tables() { return this.all("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name"); }
  columns(table) { return this.all(`PRAGMA table_info("${table}")`); }
  count(table) { return this.get(`SELECT count(*) AS n FROM "${table}"`).n; }
  _scheduleSave() {
    if (this._timer) return;
    this._timer = setTimeout(() => { this._timer = null; this.save(); }, 400);
  }
  /** Persist to disk (debounced automatically after every write; also called on exit). */
  save() {
    if (!this._dirty) return;
    if (this._inTx) { this._scheduleSave(); return; }
    fs.mkdirSync(DB_DIR, { recursive: true });
    const data = this.db.export();
    fs.writeFileSync(this.file + '.tmp', Buffer.from(data));
    fs.renameSync(this.file + '.tmp', this.file);
    this._dirty = false;
  }
  close() { this.save(); this.db.close(); }
}

/** Open (or create) a database file by name: 'claims' or 'ccl'. */
async function openDatabase(name, { fresh = false } = {}) {
  const S = await engine();
  const file = path.join(DB_DIR, name + '.sqlite');
  let db;
  if (!fresh && fs.existsSync(file)) db = new S.Database(fs.readFileSync(file));
  else db = new S.Database();
  const wrapped = new Database(name, db);
  if (fresh) wrapped._dirty = true;
  return wrapped;
}

function exists(name) { return fs.existsSync(path.join(DB_DIR, name + '.sqlite')); }

module.exports = { openDatabase, exists, DB_DIR };
