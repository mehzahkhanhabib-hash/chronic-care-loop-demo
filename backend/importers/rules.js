/**
 * Layer C importer: data/seed/rules/*.csv → rule tables in ccl.sqlite (one table per CSV, columns = CSV header, all TEXT),
 * then the design-name views (clinical_trigger, trigger_condition, next_best_action, risk_tier, contact_cadence, priority_rule,
 * alert_rule, rule_input_binding, risk_component) and the rule_definition register (one stable id per rule).
 * The CSVs are the rule database the clinical team edits; nothing clinical is hard-coded in JavaScript.
 */
const fs = require('fs');
const path = require('path');
const U = require('./util');

const RULES_DIR = path.join(U.SEED, 'rules');
const VIEWS = `
CREATE VIEW IF NOT EXISTS clinical_trigger AS SELECT t.trigger_code AS trigger_id, t.name, t.pathway, t.class AS need_class, c.sort_order AS class_order, t.sort_order AS trigger_order,
  t.raw_data_rulebook AS raw_input, t.fires_when_rulebook AS fires_when, t.extract_flag AS source_flag, t.use_variant, t.status AS approval_status, c.due_days
  FROM rule_trigger t JOIN rule_need_class c ON c.class = t.class;
CREATE VIEW IF NOT EXISTS trigger_condition AS SELECT rule_id, rule_type, target AS trigger_id, variant, CAST(group_no AS INTEGER) AS group_no, column_name AS input_feature, op AS operator, value AS threshold, note FROM rule_condition;
CREATE VIEW IF NOT EXISTS next_best_action AS SELECT action_code AS nba_id, trigger_code AS trigger_id, title AS action_text, owner_role, channel, done_when, evidence, prerequisite, escalate_to FROM rule_action;
CREATE VIEW IF NOT EXISTS risk_tier AS SELECT CAST(tier AS INTEGER) AS tier_id, label, CAST(r_min AS INTEGER) AS min_score, CAST(r_max AS INTEGER) AS max_score, campaign_does AS programme_response, cadence, cadence_days FROM rule_tier;
CREATE VIEW IF NOT EXISTS contact_cadence AS SELECT CAST(tier AS INTEGER) AS tier_id, CAST(step AS INTEGER) AS step, label, CAST(day_offset AS INTEGER) AS day_offset, note FROM rule_cadence;
CREATE VIEW IF NOT EXISTS priority_rule AS SELECT priority, alert AS alert_colour, also_requires_trigger, CAST(sla_days AS INTEGER) AS sla_days, channel, meaning FROM rule_contact_priority;
CREATE VIEW IF NOT EXISTS alert_rule AS SELECT colour AS alert_id, CAST(sort_order AS INTEGER) AS severity_order, criteria AS condition_text, response FROM rule_alert;
CREATE VIEW IF NOT EXISTS rule_input_binding AS SELECT rule_table || ':' || rule_key || ':' || field AS binding_id, rule_table, rule_key AS rule_id, input, role, field AS source_column, note FROM rule_input;
CREATE VIEW IF NOT EXISTS risk_component AS SELECT component AS component_id, name, inputs, formula, CAST(cap AS INTEGER) AS component_cap, extract_column AS reference_column FROM rule_risk_component;
`;

function importRules(db) {
  const files = fs.readdirSync(RULES_DIR).filter(f => f.endsWith('.csv')).sort();
  const loaded = {};
  db.begin();
  for (const f of files) {
    const table = f.replace(/\.csv$/, '');
    const rows = U.readCsv(path.join(RULES_DIR, f));
    const cols = Object.keys(rows[0] || {});
    db.exec(`DROP TABLE IF EXISTS "${table}"`);
    db.exec(`CREATE TABLE "${table}" (${cols.map(c => `"${c}" TEXT`).join(', ')})`);
    const ins = db.prepare(`INSERT INTO "${table}" VALUES (${cols.map(() => '?').join(',')})`);
    for (const r of rows) ins(cols.map(c => U.nul(r[c])));
    ins.free();
    loaded[table] = rows.length;
  }
  db.exec(VIEWS);
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'views_revised.sql'), 'utf8'));   // names from the Revised Member360/Longitudinal/CI workbook
  // rule_definition register
  db.run('DELETE FROM rule_definition');
  const ver = db.get('SELECT rule_version FROM rule_version LIMIT 1').rule_version;
  const ins = db.prepare('INSERT INTO rule_definition VALUES (?,?,?,?,?,?,?,?,?)');
  for (const t of db.all('SELECT * FROM rule_trigger')) ins([t.trigger_code, ver, 'trigger', t.pathway, t.name, t.fires_when_rulebook, 'need', Number(t.sort_order), 'Rulebook §3 trigger library']);
  for (const b of db.all('SELECT * FROM risk_score_band')) ins([b.rule_id, ver, 'risk_points', null, b.label, `${b.feature} ${b.op} ${b.min || ''}${b.min && b.max ? '–' : ''}${b.max || ''} → ${b.points} points (cap ${b.cap})`, 'points', null, 'Rulebook §2 risk components']);
  for (const a of db.all('SELECT * FROM rule_alert')) ins(['ALERT-' + a.colour, ver, 'alert', null, a.colour + ' alert', a.criteria, 'colour', Number(a.sort_order), 'Rulebook §4 alert colours']);
  for (const t of db.all('SELECT * FROM rule_tier')) ins(['TIER-' + t.tier, ver, 'tier', null, 'Tier ' + t.tier + ' ' + t.label, `total risk ${t.r_min}–${t.r_max}`, 'tier', Number(t.tier), 'Rulebook §2 tiers and cadence']);
  for (const p of db.all('SELECT * FROM rule_contact_priority')) ins([p.priority + (p.also_requires_trigger ? '-' + p.also_requires_trigger : ''), ver, 'priority', null, p.priority + ' · ' + p.meaning, `alert = ${p.alert}${p.also_requires_trigger ? ' and ' + p.also_requires_trigger + ' fired' : ''}`, 'priority', null, 'Rulebook §4 contact priority and SLA']);
  for (const w of db.all('SELECT * FROM rule_writeback')) ins(['WB-' + w.outcome, ver, 'writeback', null, 'Outcome ' + w.outcome, w.new_calendar_item, 'state', null, 'Rulebook §5 write-back']);
  ins.free();
  db.commit();
  U.log(`  rules: ${files.length} tables (${Object.values(loaded).reduce((a, b) => a + b, 0)} rows), ${db.count('rule_definition')} rule definitions, version ${ver}`);
  return { tables: loaded, version: ver };
}

module.exports = { importRules, RULES_DIR };
