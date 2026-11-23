#!/usr/bin/env node
/** Demo member x206 through the write-back (via the API, as the portal does), then the "after" screenshots. Run after scripts/screenshots.js; finish with npm run reset. */
const path = require('path'); const { chromium } = require('playwright');
const API = 'http://localhost:4000/api', STUDIO = process.env.STUDIO || 'http://localhost:4000/studio', PORTAL = process.env.PORTAL || 'http://localhost:4000/portal';
const OUT = path.resolve(__dirname, '..', 'docs', 'demo-scenarios', 'screenshots'); const M = 'x206';
const USER = { user_id: 'U-0150', username: 'omar', name: 'Omar Khalid', role: 'Care coordinator' };
const post = (p, b) => fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json', 'x-user': USER.user_id }, body: JSON.stringify(b) }).then(r => r.json());
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); const errors = [];
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = async (name, url, full) => { await page.goto(url, { waitUntil: 'networkidle' }); if (/#\/login/.test(page.url())) { await page.evaluate(u => localStorage.setItem('ccl.user', JSON.stringify(u)), USER); await page.goto(url); await page.reload({ waitUntil: 'networkidle' }); } await page.waitForTimeout(2000); await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: !!full }); console.log('✓', name); };
  await page.goto(PORTAL + '/#/login'); await page.evaluate(u => localStorage.setItem('ccl.user', JSON.stringify(u)), USER); await page.goto(PORTAL + '/#/'); await page.reload({ waitUntil: 'networkidle' });
  await post('/portal/calls', { member_id: M, reached: true, response: 'Happy to talk' });
  await post('/portal/consent', { member_id: M, consent_status: 'granted' });
  await shot('portal-07-x206-after-consent', PORTAL + '/#/member/' + M);
  await shot('portal-08-x206-actions', PORTAL + '/#/member/' + M, true);
  const cp = await (await fetch(API + `/members/${M}/care-plan`)).json(); const [a, d, x] = cp.current;
  await post('/portal/outcomes', { need_id: a.need_id, outcome: 'done', note: 'Review done at the clinic last week' });
  if (d) await post('/portal/outcomes', { need_id: d.need_id, outcome: 'agreed' });
  if (x) await post('/portal/outcomes', { need_id: x.need_id, outcome: 'declined', note: 'Prefers own podiatrist' });
  await post('/portal/assertions', { member_id: M, assertion_text: 'Takes home BP readings twice a week' });
  await shot('portal-09-x206-after-outcomes', PORTAL + '/#/member/' + M);
  await shot('portal-10-x206-care-plan', PORTAL + '/#/member/' + M + '/plan', true);
  await shot('portal-11-x206-member360', PORTAL + '/#/member/' + M + '/360', true);
  await shot('portal-12-x206-timeline', PORTAL + '/#/member/' + M + '/timeline');
  await shot('portal-13-tasks-after', PORTAL + '/#/tasks');
  await shot('studio-04-x206-after-portal', STUDIO + '/intelligence/' + M);
  const after = await (await fetch(API + `/members/${M}/care-plan`)).json();
  console.log('care plan after:', after.needs.map(n => `${n.trigger_code}:${n.slot}/${n.gap_state}`).join(' ')); console.log('console errors:', errors.slice(0, 8));
  await b.close();
})();
