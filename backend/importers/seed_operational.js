/** Layer E seed: demo nurse accounts (local login only), the starting cohorts and campaigns. Idempotent. */
const U = require('./util');

const USERS = [
  ['U-0142', 'nadia', '1234', 'Nadia Rahman', 'Registered nurse', 'English,Hindi', 25],
  ['U-0150', 'omar', '1234', 'Omar Khalid', 'Care coordinator', 'Arabic,English', 25],
  ['U-0161', 'sara', '1234', 'Sara Mansour', 'Registered nurse', 'Arabic,English', 25],
  ['U-0201', 'layla', '1234', 'Layla Mansoor', 'Population health', 'English,Arabic', null],
  ['U-0310', 'rana', '1234', 'Dr. Rana Khalil', 'Clinical lead', 'Arabic,English', null],
];
const OPTOUT = [{ f: 'optout' }];
const COHORTS = [
  ['COH-0101', 'Diabetes · above goal', [{ f: 'dx', vs: ['E11'] }, { f: 'lab', l: 'hba1c', op: '≥', v: 8 }], OPTOUT],
  ['COH-0102', 'Hypertension · drifting from care', [{ f: 'dx', vs: ['I10'] }, { f: 'nofu', op: '≥', v: 180 }], OPTOUT],
  ['COH-0103', 'Post-discharge chronic', [{ f: 'ncc', op: '≥', v: 1 }, { f: 'ip', op: '≥', v: 1 }], OPTOUT],
  ['COH-0104', 'Diabetes · eye and foot gaps', [{ f: 'dx', vs: ['E11'] }, { f: 'eye' }, { f: 'foot' }], OPTOUT],
  ['COH-0105', 'Chronic care loop · T2D or hypertension', [{ f: 'dx', vs: ['E11', 'I10'] }], OPTOUT],
];
const CAMPAIGNS = [ // id, name, goal, mode, triggers, channels, nurses, calls/day, status, priority, include, exclude, holdout, start, weeks
  ['CMP-0101', 'Diabetes control', 'Bring HbA1c to goal', 'automated', null, 'Voice', 8, 25, 'Live', 1, ['COH-0101'], [], 10, '2026-11-16', 8],
  ['CMP-0102', 'Back into care', 'Re-engage members without follow-up', 'business', ['Trig9', 'Trig4'], 'Voice, WhatsApp', 6, 25, 'Scheduled', 2, ['COH-0102', 'COH-0103'], [], 10, '2026-12-01', 6],
  ['CMP-0103', 'Eye and foot catch-up', 'Close annual screening gaps', 'business', ['Trig12', 'Trig13'], 'WhatsApp, SMS', 3, 30, 'Draft', 3, ['COH-0104'], ['COH-0101'], 10, '2027-01-04', 6],
  ['CMP-0104', 'Chronic care loop', 'Every rulebook trigger for T2D and hypertension members', 'automated', null, 'Voice, WhatsApp', 6, 25, 'Live', 4, ['COH-0105'], [], 10, '2026-11-16', 12],
];

function seedOperational(db, cohorts) {
  db.begin();
  for (const u of USERS) db.run('INSERT OR REPLACE INTO nurse_user (user_id, username, pin, name, role, languages, daily_capacity, active) VALUES (?,?,?,?,?,?,?,1)', u);
  db.run("INSERT OR REPLACE INTO app_setting VALUES ('run_date', ?)", [process.env.CCL_RUN_DATE || '2026-11-20']);
  db.run("INSERT OR REPLACE INTO app_setting VALUES ('as_of_date', ?)", [process.env.CCL_AS_OF || '2026-10-31']);
  db.run("INSERT OR REPLACE INTO app_setting VALUES ('trigger_variant', ?)", [process.env.CCL_TRIGGER_VARIANT || 'rulebook']);
  db.commit();
  if (!db.get('SELECT 1 FROM cohort LIMIT 1')) {
    for (const [id, name, inc, exc] of COHORTS) cohorts.saveCohort(db, { id, name, base: 'daman', logic: 'all', refresh: 'Nightly', inc, exc, owner: 'U-0201' });
    for (const c of CAMPAIGNS) cohorts.saveCampaign(db, { id: c[0], name: c[1], goal: c[2], mode: c[3], triggers: c[4], channels: c[5], nurses: c[6], calls_per_day: c[7], status: c[8], priority: c[9], include: c[10], exclude: c[11], holdout: c[12], start: c[13], weeks: c[14], by: 'U-0201' });
  }
  U.log(`  operational: ${db.count('nurse_user')} users, ${db.count('cohort')} cohorts, ${db.count('campaign')} campaigns`);
}
module.exports = { seedOperational, USERS };
