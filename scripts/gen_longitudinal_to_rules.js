#!/usr/bin/env node
/** docs/mappings/longitudinal-to-rules.md: which longitudinal column feeds which rule (from rule_condition, risk_score_band, rule_input). */
const fs = require('fs'); const path = require('path');
const { openDatabase } = require('../backend/database/adapter');
(async () => {
  const db = await openDatabase('ccl');
  const use = {};
  const add = (col, what) => { (use[col] = use[col] || new Set()).add(what); };
  for (const c of db.all('SELECT * FROM rule_condition')) add(c.column_name, `${c.rule_type}:${c.target} (${c.op} ${c.value ?? ''})`.replace(/ \)$/, ')'));
  for (const b of db.all('SELECT * FROM risk_score_band')) { add(b.feature, `${b.rule_id} ${b.label}`); if (b.applies_feature && !b.applies_feature.includes('+')) add(b.applies_feature, `${b.rule_id} (scope)`); }
  for (const i of db.all('SELECT * FROM rule_input')) add(i.field, `${i.rule_table}:${i.rule_key} [${i.role}]`);
  const fields = db.all('SELECT field, type, field_group FROM longitudinal_field');
  let md = '# Longitudinal columns → rules\n\nWhich of the 377 longitudinal columns each rule reads. The first table is the evaluation logic actually executed by the engine (`rule_condition.csv` for triggers, alerts and cannot-tell; `risk_score_band.csv` for points). The second lists every binding recorded in `rule_input.csv` (294 rows), including display-only inputs.\n\n## Columns read by executable rules\n\n| longitudinal column | type | used by |\n|---|---|---|\n';
  const exec = Object.entries(use).filter(([, s]) => [...s].some(x => /^(trigger|cannot_tell|alert):|^RS-/.test(x))).sort();
  for (const [col, s] of exec) { const f = fields.find(x => x.field === col) || {}; md += `| \`${col}\` | ${f.type || (col === '_fired_triggers' ? 'derived' : '')} | ${[...s].filter(x => /^(trigger|cannot_tell|alert):|^RS-/.test(x)).join('; ')} |\n`; }
  md += '\n## Every binding in rule_input.csv\n\n| rule table | rule key | role | longitudinal column |\n|---|---|---|---|\n';
  for (const i of db.all('SELECT * FROM rule_input ORDER BY rule_table, rule_key, field')) md += `| ${i.rule_table} | ${i.rule_key} | ${i.role} | \`${i.field}\` |\n`;
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'mappings', 'longitudinal-to-rules.md'), md);
  console.log('longitudinal-to-rules.md', exec.length, 'executable columns');
  db.close();
})();
