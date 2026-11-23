#!/usr/bin/env node
/** Builds release/chronic-care-loop-demo.zip: source, seeds, source workbooks, docs. Excludes node_modules, built apps and the SQLite files (recreated by npm run setup). */
const { execSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const root = path.resolve(__dirname, '..'); const out = path.join(root, 'release'); fs.mkdirSync(out, { recursive: true });
const zip = path.join(out, 'chronic-care-loop-demo.zip'); if (fs.existsSync(zip)) fs.unlinkSync(zip);
execSync(`cd "${path.dirname(root)}" && zip -qr "${zip}" "${path.basename(root)}" -x "*/node_modules/*" "*/data/db/*" "*/apps/*/dist/*" "*/release/*" "*/.git/*" "*/.env"`, { stdio: 'inherit' });
console.log('written', zip, (fs.statSync(zip).size / 1048576).toFixed(1), 'MB');
