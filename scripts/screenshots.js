#!/usr/bin/env node
/** Takes the documentation screenshots of both apps for the two demo members. Expects the backend with built apps (npm run build && npm start)
 *  or the dev servers (npm run dev); pass STUDIO=http://localhost:3000 PORTAL=http://localhost:3001 to use the dev servers. Needs Playwright + Chromium. */
const path = require('path'); const fs = require('fs');
const { chromium } = require('playwright');
const STUDIO = process.env.STUDIO || 'http://localhost:4000/studio', PORTAL = process.env.PORTAL || 'http://localhost:4000/portal';
const OUT = path.resolve(__dirname, '..', 'docs', 'demo-scenarios', 'screenshots'); fs.mkdirSync(OUT, { recursive: true });
const USER = { user_id: 'U-0150', username: 'omar', name: 'Omar Khalid', role: 'Care coordinator' };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = async (name, url, wait = 1500) => { await page.goto(url, { waitUntil: 'networkidle' }); await page.waitForTimeout(wait); await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false }); console.log('✓', name); };
  await page.goto(STUDIO + '/'); await page.evaluate(u => localStorage.setItem('ccl.user', JSON.stringify(u)), USER);
  await shot('studio-01-builder', STUDIO + '/builder');
  await shot('studio-02-intelligence', STUDIO + '/intelligence');
  for (const m of ['x2063', 'x206']) await shot(`studio-02-intelligence-${m}`, STUDIO + '/intelligence/' + m, 2500);
  await shot('studio-03-portal', STUDIO + '/portal', 3000);
  await page.goto(PORTAL + '/#/login'); await page.evaluate(u => localStorage.setItem('ccl.user', JSON.stringify(u)), USER);
  await shot('portal-01-login', PORTAL + '/#/login');
  await shot('portal-02-queue', PORTAL + '/#/');
  for (const m of ['x2063', 'x206']) { await shot(`portal-03-member-${m}`, PORTAL + '/#/member/' + m, 2500); }
  await shot('portal-04-tasks', PORTAL + '/#/tasks');
  await shot('portal-05-care-plans', PORTAL + '/#/care-plans');
  await shot('portal-06-analytics', PORTAL + '/#/analytics');
  await b.close();
  if (errors.length) { console.log('console errors:', errors.slice(0, 10)); }
})();
