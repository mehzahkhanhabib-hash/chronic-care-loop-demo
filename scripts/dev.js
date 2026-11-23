#!/usr/bin/env node
/** `npm run dev`: start the Express backend (:4000), the Chronic Care Studio (:3000) and the Care Coordinator Portal (:3001) in one terminal.
 *  `npm start` (= dev.js --prod) serves the two built React apps from the backend instead of webpack dev servers. */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');
const prod = process.argv.includes('--prod');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = { ...process.env, PORT: process.env.PORT || '4000', STUDIO_PORT: process.env.STUDIO_PORT || '3000', PORTAL_PORT: process.env.PORTAL_PORT || '3001', SERVE_APPS: prod ? '1' : '' };
if (!fs.existsSync(path.join(root, 'data', 'db', 'ccl.sqlite'))) console.log('No database found: the backend will run setup on first start (about 15 seconds).');
const procs = [];
const run = (name, args, cwd) => { const p = spawn(npm, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' }); p.on('exit', c => { if (c) console.log(`[${name}] exited with ${c}`); }); procs.push(p); };
run('backend', ['run', 'dev', '--workspace', 'backend'], root);
if (!prod) {
  setTimeout(() => { run('studio', ['run', 'start', '--workspace', 'apps/chronic-care-studio'], root); run('portal', ['run', 'start', '--workspace', 'apps/care-coordinator-portal'], root); }, 1500);
  console.log('\nChronic Care Studio      → http://localhost:' + env.STUDIO_PORT + '\nCare Coordinator Portal  → http://localhost:' + env.PORTAL_PORT + '\nExpress API              → http://localhost:' + env.PORT + '/api/health\n');
} else console.log('\nServing built apps from the backend: Studio http://localhost:' + env.PORT + '/studio · Portal http://localhost:' + env.PORT + '/portal\n');
const stop = () => { for (const p of procs) try { p.kill(); } catch (e) { /* ignore */ } process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
