/** `npm run setup`: build both SQLite files from the seed data, load the rule database, seed users/cohorts/campaigns, run the intelligence once. */
const fs = require('fs');
const path = require('path');
const { openDatabase, DB_DIR } = require('../database/adapter');
const U = require('./util');

async function setup({ fromExcel = false, skipClaims = false } = {}) {
  const t0 = Date.now();
  fs.mkdirSync(DB_DIR, { recursive: true });
  U.log('Chronic Care Loop · setup' + (fromExcel ? ' (reading the .xlsx sources)' : ' (reading data/seed)'));
  let claims;
  if (!skipClaims || !fs.existsSync(path.join(DB_DIR, 'claims.sqlite'))) { U.log('Layer A · raw claims → claims.sqlite'); claims = (await require('./claims').importClaims({ fromExcel })).db; }
  else claims = await openDatabase('claims');
  U.log('Layers B–E · ccl.sqlite');
  const ccl = await openDatabase('ccl', { fresh: true });
  ccl.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'schema_ccl.sql'), 'utf8'));
  require('./rules').importRules(ccl);
  await require('./longitudinal').importLongitudinal(ccl, { fromExcel });
  const xw = require('./longitudinal').linkCrosswalk(ccl, claims);
  U.log(`  crosswalk: ${xw.l} longitudinal, ${xw.c} claims, ${xw.both} in both`);
  require('./seed_operational').seedOperational(ccl, require('../services/cohorts'));
  U.log('Care intelligence · first run');
  const r = require('../rule-engine/engine').run(ccl, { triggeredBy: 'setup' });
  U.log('  ' + JSON.stringify(r));
  ccl.save(); claims.save();
  U.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${DB_DIR}`);
  return { run: r, claims: claims.count('claim_activity'), members: ccl.count('member_longitudinal') };
}
module.exports = { setup };
if (require.main === module) setup({ fromExcel: process.argv.includes('--from-excel'), skipClaims: process.argv.includes('--skip-claims') }).catch(e => { console.error(e); process.exit(1); });
