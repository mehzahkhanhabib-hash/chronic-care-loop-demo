#!/usr/bin/env node
/** Generates docs/api/API.md from the live backend (sample requests + trimmed real responses). Run with the backend up: node scripts/gen_api_docs.js */
const fs = require('fs'); const path = require('path');
const BASE = process.env.API || 'http://localhost:4000/api';
const trim = (v, depth = 0) => Array.isArray(v) ? (v.length > 2 ? [trim(v[0], depth + 1), trim(v[1], depth + 1), `… ${v.length - 2} more`] : v.map(x => trim(x, depth + 1))) : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(v).slice(0, depth > 1 ? 8 : 40).map(([k, x]) => [k, trim(x, depth + 1)])) : (typeof v === 'string' && v.length > 120 ? v.slice(0, 117) + '…' : v);
const E = [
  ['Meta', 'GET', '/health', null, 'Service status, demo dates, rule version, latest run'],
  ['Meta', 'GET', '/schema', null, 'Every table/view and column in both SQLite files'],
  ['Meta', 'GET', '/lineage', null, 'Screen element → API field → table.column → source (docs/mappings/lineage.json)'],
  ['Meta', 'GET', '/settings', null, 'run_date, as_of_date, trigger_variant'],
  ['Auth (demo)', 'POST', '/auth/login', { username: 'omar', pin: '1234' }, 'Local demo login; returns the nurse user. Accounts: nadia, omar, sara, layla, rana · PIN 1234'],
  ['Auth (demo)', 'GET', '/users', null, 'Care team'],
  ['Members · Member 360 (raw claims)', 'GET', '/members?limit=2', null, 'Member list with latest risk, alert, campaign, worklist (q, tier, alert, campaign filters)'],
  ['Members · Member 360 (raw claims)', 'GET', '/members/x206', null, 'Member summary: identity (longitudinal), Member 360 summary (claims), risk, consent, assignment, care plan'],
  ['Members · Member 360 (raw claims)', 'GET', '/members/x206/360', null, 'Full Member 360 from raw claims: policies, conditions, admissions, ED visits, lab series, medications, procedures, providers, clinicians, costs'],
  ['Members · Member 360 (raw claims)', 'GET', '/members/x206/claims?limit=2', null, 'Claims (paged; from/to filters)'],
  ['Members · Member 360 (raw claims)', 'GET', '/claims/22431203410', null, 'One claim with its activity lines and lab observations'],
  ['Members · Member 360 (raw claims)', 'GET', '/members/x206/encounters?type=IP', null, 'Encounters (IP | ED | OP)'],
  ['Members · Member 360 (raw claims)', 'GET', '/members/x206/labs?code=4548-4', null, 'Lab observations (series=1 for grouped series)'],
  ['Members · Member 360 (raw claims)', 'GET', '/members/x206/medications', null, 'Pharmacy claims grouped by generic name (generic=… for fills)'],
  ['Members · Member 360 (raw claims)', 'GET', '/members/x206/procedures', null, 'CPT/HCPCS procedures'],
  ['Members · Member 360 (raw claims)', 'GET', '/members/x206/providers', null, 'Facilities and clinicians seen'],
  ['Members · Member 360 (raw claims)', 'GET', '/members/x206/costs', null, 'Payable by year, cost block and encounter type'],
  ['Care Intelligence', 'GET', '/members/x206/longitudinal', null, 'All 377 longitudinal values with the field catalogue'],
  ['Care Intelligence', 'GET', '/members/x206/risk', null, 'Risk components (engine vs extract), tier, alert, the scoring rules that fired'],
  ['Care Intelligence', 'GET', '/members/x206/evaluations', null, 'The 14 trigger evaluations: inputs, values, logic, result, evidence, NBA, owner, done-when'],
  ['Care Intelligence', 'GET', '/members/x206/alerts', null, 'Alert history by run'],
  ['Care Intelligence', 'GET', '/members/x206/care-plan', null, 'Care plan with CURRENT / NEXT / FUTURE / CLOSED needs, live action, last outcome, gap history'],
  ['Care Intelligence', 'GET', '/members/x206/actions', null, 'Every action (call, care-plan action, follow-up, retry, escalation) with its chain'],
  ['Care Intelligence', 'GET', '/members/x206/timeline', null, 'Consent, calls, dispositions, assertions, gap transitions, appointments, notes'],
  ['Care Intelligence', 'GET', '/members/x206/explain', null, 'Dry-run evaluation of one member (nothing written)'],
  ['Care Intelligence', 'GET', '/intelligence/members?limit=2', null, 'Screen-2 list: all members with risk, alert, triggers fired, campaign, worklist'],
  ['Care Intelligence', 'GET', '/intelligence/programme', null, 'Per-trigger counts: fired / cannot tell / open / CURRENT / reported / closed'],
  ['Care Intelligence', 'GET', '/intelligence/kpis', null, 'Programme KPIs (add ?scope=active for the handed-off cohort only)'],
  ['Studio · cohorts and campaigns', 'GET', '/studio/scope', null, 'The cohort or campaign last handed off from the cohort builder (null when none). Intelligence and the portal follow it with ?scope=active'],
  ['Studio · cohorts and campaigns', 'POST', '/studio/scope', { campaign_id: 'CMP-0101' }, 'Set the scope to a campaign ({campaign_id}) or a cohort ({cohort_id}); {} clears it'],
  ['Care Intelligence', 'GET', '/intelligence/runs', null, 'Run history'],
  ['Care Intelligence', 'POST', '/intelligence/runs', {}, 'Run the engine now (optional member_ids: [...])'],
  ['Care Intelligence', 'GET', '/intelligence/evaluations?rule_id=Trig1&result=fired&limit=2', null, 'Evaluations across members'],
  ['Rules', 'GET', '/rules/definitions', null, 'Stable rule ids with version, type, expression'],
  ['Rules', 'GET', '/rules/rule_trigger', null, 'Any rule table by name (rule_trigger, rule_condition, risk_score_band, rule_action, rule_tier, rule_alert, rule_contact_priority, rule_writeback …)'],
  ['Studio · cohorts and campaigns', 'GET', '/studio/features', null, 'Builder field groups and the 377-column catalogue'],
  ['Studio · cohorts and campaigns', 'POST', '/cohorts/estimate', { base: 'daman', logic: 'all', inc: [{ id: 1, f: 'dx', vs: ['E11'] }, { id: 2, f: 'lab', l: 'hba1c', op: '≥', v: 8 }], exc: [{ id: 3, f: 'optout' }] }, 'Live count, funnel steps, per-rule counts, unsupported rules, compiled SQL, profile'],
  ['Studio · cohorts and campaigns', 'GET', '/cohorts', null, 'Saved cohorts'],
  ['Studio · cohorts and campaigns', 'POST', '/cohorts', { name: 'Docs example', base: 'daman', logic: 'all', inc: [{ f: 'dx', vs: ['I10'] }], exc: [] }, 'Save (or version) a cohort and materialise its members'],
  ['Studio · cohorts and campaigns', 'GET', '/campaigns', null, 'Campaigns with include/exclude cohorts'],
  ['Studio · cohorts and campaigns', 'POST', '/campaigns', { name: 'Docs example', goal: 'Example', mode: 'business', triggers: ['Trig9'], include: ['COH-0102'], status: 'Draft', priority: 9 }, 'Save a campaign'],
  ['Studio · cohorts and campaigns', 'GET', '/campaigns/CMP-0101/members', null, 'Members the latest run put in a campaign'],
  ['Portal', 'GET', '/portal/worklist?nurse_id=U-0150&status=today', null, "A nurse's list (today | queued | scheduled | nudge)"],
  ['Portal', 'GET', '/portal/tasks?nurse_id=U-0150&status=open', null, 'Tasks (projection of actions) with filters nurse_id, status, member_id, kind'],
  ['Portal', 'GET', '/portal/analytics?nurse_id=U-0150', null, 'Shift analytics'],
  ['Portal', 'POST', '/portal/consent', { member_id: 'x206', consent_status: 'granted', nurse_id: 'U-0150' }, 'Consent event (granted | declined | withdrawn); declined cancels open outreach'],
  ['Portal', 'GET', '/members/x206/consent', null, 'Current consent status and history'],
  ['Portal', 'POST', '/portal/calls', { member_id: 'x206', reached: true, nurse_id: 'U-0150', response: 'Happy to talk' }, 'Call attempt; reached closes the outreach and schedules the cadence check-in; not reached applies the retry rule'],
  ['Portal', 'POST', '/portal/assertions', { member_id: 'x206', need_id: 'N-x206-Trig13', assertion_text: 'Foot exam done in March at a private clinic', nurse_id: 'U-0150' }, 'What the member said (moves Potential → Verified, never closes)'],
  ['Portal', 'POST', '/portal/outcomes', { need_id: 'N-x206-Trig1', outcome: 'agreed', nurse_id: 'U-0150' }, 'Disposition on a need or action: done | agreed | declined | carried | not_reached (rule_writeback)'],
  ['Portal', 'POST', '/portal/tasks/1/complete', { nurse_id: 'U-0150' }, 'Complete a task (a care-plan task records outcome=done)'],
  ['Portal', 'POST', '/portal/appointments', { member_id: 'x206', need_id: 'N-x206-Trig13', appointment_type: 'foot', scheduled_date: '2026-12-01', nurse_id: 'U-0150' }, 'Book / follow-up call / callback: writes the appointment AND a dated task for the assigned nurse (shows on the Tasks calendar), moves the gap to Scheduled, rebuilds the worklist'],
  ['Portal', 'POST', '/portal/notes', { member_id: 'x206', text: 'Prefers calls after 4 pm', nurse_id: 'U-0150' }, 'Nurse note'],
  ['Admin', 'POST', '/admin/reset', {}, 'Reset ccl.sqlite to the demo state (keeps imported claims)'],
];
(async () => {
  let md = `# Chronic Care Loop · REST API\n\nBase URL \`http://localhost:4000/api\`. JSON in, JSON out. Send \`x-user: <user_id>\` (e.g. \`U-0150\`) so writes are attributed; the demo has no real authentication.\nEvery response below is a real, trimmed response from the seeded database (generated by \`node scripts/gen_api_docs.js\`).\n\n`;
  let group = '';
  for (const [g, m, p, body, desc] of E) {
    if (g !== group) { md += `\n## ${g}\n`; group = g; }
    if (p.startsWith('/admin') || (m === 'POST' && /cohorts$|campaigns$|studio\/scope|outcomes|consent|calls|assertions|appointments|notes|complete|runs/.test(p) && !process.env.WRITE)) { md += `\n### \`${m} ${p}\`\n${desc}\n\n\`\`\`json\n${body ? JSON.stringify(body, null, 2) : ''}\n\`\`\`\n`; continue; }
    const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', 'x-user': 'U-0150' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json();
    md += `\n### \`${m} ${p}\`\n${desc}\n\n${body ? 'Request body:\n```json\n' + JSON.stringify(body, null, 2) + '\n```\n' : ''}Response (${r.status}):\n\`\`\`json\n${JSON.stringify(trim(j), null, 2)}\n\`\`\`\n`;
  }
  fs.mkdirSync(path.join(__dirname, '..', 'docs', 'api'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'api', 'API.md'), md);
  console.log('docs/api/API.md written', md.length, 'chars');
})();
