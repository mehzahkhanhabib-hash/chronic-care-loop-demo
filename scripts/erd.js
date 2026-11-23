#!/usr/bin/env node
/** Generates docs/data-model/DATA_MODEL.md (every table, column, comment, row count) and docs/data-model/ERD.md (Mermaid ER diagram)
 *  from the schema files and the live SQLite databases. Run after `npm run setup`: node scripts/erd.js */
const fs = require('fs'); const path = require('path');
const { openDatabase } = require('../backend/database/adapter');
const root = path.resolve(__dirname, '..');
function parseSchema(file) {
  const sql = fs.readFileSync(file, 'utf8'); const out = {};
  for (const m of sql.matchAll(/CREATE (?:TABLE|VIEW)(?: IF NOT EXISTS)? (\w+)[^\n]*?(?:\(|AS)([^\n]*)\n([\s\S]*?)\n\)?;/g)) {
    const [, name, head, body] = m; const cmt = (head.match(/--\s*(.*)$/) || [])[1] || '';
    const cols = {};
    for (const line of body.split('\n')) { const mm = line.match(/^\s*"?([A-Za-z_][\w]*)"?\s+[A-Z]+[^-]*--\s*(.*)$/); if (mm && !/^(PRIMARY|UNIQUE|KEY|SHARD)/.test(mm[1])) cols[mm[1]] = mm[2].trim(); }
    out[name] = { comment: cmt.trim(), cols };
  }
  return out;
}
const LAYERS = { claims: { 'A · Raw claims (claims.sqlite)': null }, ccl: {
  'B · Longitudinal features': ['member_longitudinal', 'member_identifier_crosswalk', 'longitudinal_field'],
  'C · Rule configuration': /^(rule_|risk_|clinical_|trigger_condition|next_best_action|contact_cadence|priority_rule|alert_rule|rule_input_binding)/,
  'D · Care intelligence outputs': ['intelligence_run', 'member_risk_result', 'member_rule_evaluation', 'member_alert', 'care_plan', 'care_need', 'action', 'worklist'],
  'E · Operational and write-back': /^(nurse_user|cohort|cohort_rule|cohort_member|campaign|campaign_cohort|campaign_member|member_assignment|contact_attempt|call_interaction|consent_event|member_assertion|disposition_event|task|appointment|care_gap_event|nurse_note|audit_event|app_setting)$/ } };
const REL = [ // child, fk, parent, pk, label
  ['member_policy', 'mask_id', 'member', 'mask_id', 'enrolled under'], ['claim', 'mask_id', 'member', 'mask_id', 'belongs to'], ['claim', 'provider_id', 'provider', 'provider_id', 'billed by'], ['claim', 'clinician_id', 'clinician', 'clinician_id', 'seen by'], ['claim', 'primary_diagnosis_id', 'diagnosis_code', 'diagnosis_id', 'coded'],
  ['claim_activity', 'claim_id', 'claim', 'claim_id', 'line of'], ['claim_activity', 'mask_id', 'member', 'mask_id', 'for'], ['lab_observation', 'activity_id', 'claim_activity', 'activity_id', 'observed on (ACTIVITY_ID)'], ['lab_observation', 'claim_id', 'claim', 'claim_id', 'copied from activity'],
  ['member_identifier_crosswalk', 'member_id', 'member_longitudinal', 'mask_id', 'same person as'], ['member_identifier_crosswalk', 'claims_mask_id', 'member', 'mask_id', 'same person as (claims.sqlite)'],
  ['rule_condition', 'target', 'rule_trigger', 'trigger_code', 'conditions of'], ['rule_action', 'trigger_code', 'rule_trigger', 'trigger_code', 'next best action of'], ['rule_trigger', 'class', 'rule_need_class', 'class', 'ranked by'], ['risk_score_band', 'component', 'rule_risk_component', 'component', 'band of'], ['rule_input', 'rule_key', 'rule_trigger', 'trigger_code', 'reads'], ['rule_input', 'field', 'longitudinal_field', 'field', 'binds'],
  ['member_risk_result', 'run_id', 'intelligence_run', 'run_id', 'produced by'], ['member_risk_result', 'member_id', 'member_longitudinal', 'mask_id', 'scores'], ['member_rule_evaluation', 'run_id', 'intelligence_run', 'run_id', 'produced by'], ['member_rule_evaluation', 'rule_id', 'rule_definition', 'rule_id', 'applies'], ['member_alert', 'run_id', 'intelligence_run', 'run_id', 'produced by'],
  ['care_plan', 'member_id', 'member_longitudinal', 'mask_id', 'plan for'], ['care_need', 'care_plan_id', 'care_plan', 'care_plan_id', 'item of'], ['care_need', 'trigger_code', 'rule_trigger', 'trigger_code', 'raised by'], ['care_need', 'last_evaluation_id', 'member_rule_evaluation', 'evaluation_id', 'evidence'], ['action', 'need_id', 'care_need', 'need_id', 'works on'], ['action', 'assignee', 'nurse_user', 'user_id', 'assigned to'], ['action', 'parent_action_id', 'action', 'action_id', 'follows'], ['worklist', 'action_id', 'action', 'action_id', 'queues'], ['worklist', 'nurse_id', 'nurse_user', 'user_id', 'for'],
  ['cohort_rule', 'cohort_id', 'cohort', 'cohort_id', 'defines'], ['cohort_member', 'cohort_id', 'cohort', 'cohort_id', 'member of'], ['campaign_cohort', 'campaign_id', 'campaign', 'campaign_id', 'includes/excludes'], ['campaign_cohort', 'cohort_id', 'cohort', 'cohort_id', ''], ['campaign_member', 'campaign_id', 'campaign', 'campaign_id', 'owns member in run'], ['member_assignment', 'nurse_id', 'nurse_user', 'user_id', ''],
  ['contact_attempt', 'action_id', 'action', 'action_id', 'attempt for'], ['call_interaction', 'attempt_id', 'contact_attempt', 'attempt_id', 'reached call'], ['consent_event', 'call_id', 'call_interaction', 'call_id', 'recorded on'], ['member_assertion', 'need_id', 'care_need', 'need_id', 'about'], ['disposition_event', 'need_id', 'care_need', 'need_id', 'decides'], ['disposition_event', 'action_id', 'action', 'action_id', 'closes'], ['task', 'action_id', 'action', 'action_id', 'projection of'], ['appointment', 'need_id', 'care_need', 'need_id', 'books'], ['care_gap_event', 'need_id', 'care_need', 'need_id', 'state change of'] ];
(async () => {
  const dbs = { claims: await openDatabase('claims'), ccl: await openDatabase('ccl') };
  const meta = { ...parseSchema(path.join(root, 'backend/database/schema_claims.sql')), ...parseSchema(path.join(root, 'backend/database/schema_ccl.sql')) };
  let md = '# Data model\n\nTwo SQLite files in `data/db/` (built by `npm run setup`). Layer A is the raw-claims world (Member 360). Layers B–E are the longitudinal features, the rule database, the care-intelligence outputs and the operational write-back tables. `TEXT` dates are ISO `YYYY-MM-DD`. Views are marked (view). Row counts are from the seeded demo database.\n\nRelationships are drawn in [ERD.md](ERD.md). SingleStore does not enforce foreign keys and neither does the demo at write time in bulk loads; the importer checks `PRAGMA foreign_key_check` after loading.\n\n';
  const done = new Set();
  for (const [dbName, layers] of Object.entries(LAYERS)) {
    const db = dbs[dbName]; const tables = db.tables();
    for (const [layer, sel] of Object.entries(layers)) {
      md += `\n## Layer ${layer}\n`;
      const pick = tables.filter(t => !done.has(dbName + t.name) && (sel === null || (Array.isArray(sel) ? sel.includes(t.name) : sel.test(t.name))));
      for (const t of pick) {
        done.add(dbName + t.name);
        const m = meta[t.name] || { comment: '', cols: {} };
        let n = ''; try { n = t.type === 'table' ? db.count(t.name).toLocaleString() : ''; } catch (e) { n = ''; }
        md += `\n### \`${t.name}\`${t.type === 'view' ? ' (view)' : ''}${n ? ` · ${n} rows` : ''}\n${m.comment ? m.comment + '\n' : ''}`;
        const cols = db.columns(t.name);
        if (t.name === 'member_longitudinal') { md += `\n377 columns: every header of \`250_members_longitudinal_data.xlsx\`, see [../mappings/longitudinal-catalogue.md](../mappings/longitudinal-catalogue.md). Primary key \`mask_id\`.\n`; continue; }
        if (/^rule_|^risk_score_band|^clinical_pathway|^rule_version/.test(t.name) && t.type === 'table') { md += `\nLoaded 1:1 from \`data/seed/rules/${t.name}.csv\` (columns: ${cols.map(c => '`' + c.name + '`').join(', ')}).\n`; continue; }
        md += '\n| column | type | note |\n|---|---|---|\n' + cols.map(c => `| \`${c.name}\`${c.pk ? ' 🔑' : ''} | ${c.type || ''} | ${(m.cols[c.name] || '').replace(/\|/g, '/')} |`).join('\n') + '\n';
      }
    }
  }
  fs.mkdirSync(path.join(root, 'docs/data-model'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/data-model/DATA_MODEL.md'), md);
  // ERD (Mermaid)
  const ent = new Set(REL.flatMap(r => [r[0], r[2]]));
  let erd = '# Entity-relationship diagram\n\nGenerated by `node scripts/erd.js`. Keys only; full columns are in [DATA_MODEL.md](DATA_MODEL.md).\n\n```mermaid\nerDiagram\n';
  for (const e of ent) { const db = dbs.claims.tables().some(t => t.name === e) ? dbs.claims : dbs.ccl; const cols = db.columns(e).filter(c => c.pk || /_id$|^mask_id$|^run_id$|^trigger_code$|^rule_id$|^field$|^component$|^class$/.test(c.name)).slice(0, 8); erd += `  ${e} {\n${cols.map(c => `    ${(c.type || 'TEXT').replace(/\(.*\)/, '').toLowerCase() || 'text'} ${c.name}${c.pk ? ' PK' : ''}`).join('\n')}\n  }\n`; }
  for (const [c, fk, p, pk, label] of REL) erd += `  ${p} ||--o{ ${c} : "${label || fk}"\n`;
  erd += '```\n\n## Data flows\n\n```mermaid\nflowchart LR\n  X1[Raw_Claims_250_Members_Part_1..3.xlsx] -->|importers/claims.js| A[(claims.sqlite · Layer A)] -->|services/member360.js| M360[Member 360 APIs] --> Portal[Care Coordinator Portal]\n  X2[250_members_longitudinal_data.xlsx] -->|importers/longitudinal.js| B[(member_longitudinal · Layer B)]\n  R[data/seed/rules/*.csv] -->|importers/rules.js| C[(rule tables · Layer C)]\n  B --> ENG[rule-engine/engine.js]\n  C --> ENG\n  ENG -->|run| D[(member_risk_result · member_rule_evaluation · member_alert · care_need · action · worklist · Layer D)]\n  D --> CI[Care Intelligence APIs] --> Studio[Chronic Care Studio]\n  CI --> Portal\n  Portal -->|consent · calls · assertions · outcomes · tasks| E[(Layer E events)] -->|writeback.js| D\n  E -->|next run| ENG\n```\n';
  fs.writeFileSync(path.join(root, 'docs/data-model/ERD.md'), erd);
  // longitudinal catalogue + raw claims mapping
  const fields = dbs.ccl.all('SELECT * FROM longitudinal_field');
  let cat = '# Longitudinal catalogue · 377 columns\n\nEvery header of `250_members_longitudinal_data.xlsx` as loaded into `member_longitudinal` (column name = header, text kept as text, numbers as REAL, dates as ISO). `read_by_rules` shows which rule table reads the column (from `rule_input.csv`); the description comes from the data glossary.\n\n| # | column | type | group | read by rules | description |\n|---|---|---|---|---|---|\n';
  fields.forEach((f, i) => cat += `| ${i + 1} | \`${f.field}\` | ${f.type} | ${f.field_group || ''} | ${(f.read_by_rules || '').replace(/\|/g, '/')} | ${(f.description || '').replace(/\|/g, '/').slice(0, 160)} |\n`);
  fs.mkdirSync(path.join(root, 'docs/mappings'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/mappings/longitudinal-catalogue.md'), cat);
  const hdr = fs.readFileSync(path.join(root, 'backend/database/schema_claims.sql'), 'utf8');
  const SRC = ['MAINPOLICYGROUP_ID', 'E_MPG_ID', 'POLICYGROUP_ID', 'E_PG_ID', 'POLICY_ID', 'E_POLICY_ID', 'EFFECTIVEDATE', 'EXPIRYDATE', 'CANCELLATIONDATE', 'MEM_EFF_DATE', 'ENROLLMENTDATE', 'DELETIONDATE', 'PRODUCT', 'PLAN', 'PACKAGE_ID', 'PACKAGETYPE', 'NETWORK_ID', 'NETOWRK_DESC', 'NETWORKGROUPAUH', 'NETWORKGROUPDXB', 'NETWORKGROUP', 'PROVIDER_ID', 'FACILITY_NAME', 'FACILITY_TYPE', 'GROUPLEVEL', 'GROUPOWNERLEVEL', 'SUPERGROUPLEVEL', 'REGION', 'TERRITORY', 'CLINICIAN_ID', 'CLINICIAN_NAME', 'PROFESSION', 'SPECIALTY', 'mask_id', 'MEMBERRELATION', 'GENDER', 'AGECATEGORY', 'DIAGNOSIS_ID', 'GROUP2', 'GROUP3', 'GROUP4', 'HEALTHCODE', 'INVOICESTATUS', 'COSTBLOCK', 'BENEFITGROUPTYPE2', 'BENEFIT_DESC', 'SERVICEGROUP', 'SERVICE_ID', 'SER_DESC', 'CPTCATEGORY3', 'ACTIVITYDETAIL_ID', 'ACTIVITYDETAILTYPE_ID', 'ACTIVITY_ID', 'ACTIVITY_DESC', 'AUDIT_ID', 'CLAIM_ID', 'EPISODE_ID', 'BG_IPOP', 'DATEOFSERVICE', 'ADMIT_DATE', 'DISCHARGE_DATE', 'LOS_DAYS', 'CYYYYMM', 'CY', 'PAYABLE', 'CLAIMED', 'DENIAL', 'DRUG_QUANTITY', 'PACKAGESIZE', 'PACKAGEUNIT', 'DOSAGEFORM', 'GENERICNAME', 'DRUG_CATEGORY', 'DRUG_TIERS', 'ADMIT_DESC', 'CATEGORY', 'Concatenated', 'MAJOR', 'E_PRINCIPAL_ID', 'DISC_DESCRIPTION', 'BUSINESS_UY'];
  const LAB = ['OBSERVATION_SK', 'ACTIVITY_SK', 'ACTIVITY_ID', 'OBSERVATIONTYPE_SK', 'OBSERVATION_ID', 'CODE', 'Description', 'VALUETYPE', 'REQUESTEDVALUE', 'APPROVEDVALUE', 'OBSERVATIONTYPE_ID', 'OBJECTTYPE', 'SRC_SYS_ID', 'Units'];
  const dest = {};
  for (const [t, m] of Object.entries(parseSchema(path.join(root, 'backend/database/schema_claims.sql')))) for (const [c, cm] of Object.entries(m.cols)) for (const s of [...SRC, ...LAB]) if (new RegExp('(^|[^A-Za-z_])' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Za-z_]|$)').test(cm)) (dest[s] = dest[s] || []).push(`${t}.${c}`);
  let map = '# Raw claims → tables\n\nSheet **in** (81 columns, 144,292 rows across the three workbook parts) and sheet **Lab Results** (14 columns, 29,976 rows, identical in each part and de-duplicated on OBSERVATION_SK). Every source column lands in at least one table of `claims.sqlite`; dimension columns are de-duplicated (one row per provider, clinician, diagnosis code, policy), claim-level columns are kept once per CLAIM_ID with sums, line-level columns stay on `claim_activity`.\n\n## Sheet "in"\n\n| source column | destination table.column |\n|---|---|\n';
  for (const s of SRC) map += `| \`${s}\` | ${(dest[s] || ['—']).map(x => '`' + x + '`').join(', ')} |\n`;
  map += '\n## Sheet "Lab Results"\n\n| source column | destination table.column |\n|---|---|\n';
  for (const s of LAB) map += `| \`${s}\` | ${(dest[s] || ['—']).map(x => '`' + x + '`').join(', ')} |\n`;
  map += '\n## Sheet "Sheet2"\n\n`Type, Code, Description, Value, ValueType` → `observation_dictionary` (same names).\n\n## Derived at import (traceable)\n\n- `lab_observation.value_num`, `value_unit`: parsed from `REQUESTEDVALUE` (format `value/unit`, e.g. `5.6/%`); the raw string is kept.\n- `lab_observation.mask_id`, `result_date`, `claim_id`: copied from the `claim_activity` row with the same `ACTIVITY_ID`.\n- `claim.*` sums and min/max dates: aggregated over the claim\'s activity lines.\n- Views `encounter`, `pharmacy_claim`, `procedure_activity`, `diagnosis`: SQL over the tables above, no copies.\n';
  fs.writeFileSync(path.join(root, 'docs/mappings/raw-claims-to-tables.md'), map);
  console.log('docs written: DATA_MODEL.md, ERD.md, longitudinal-catalogue.md, raw-claims-to-tables.md');
  for (const d of Object.values(dbs)) d.close();
})();
