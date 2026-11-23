#!/usr/bin/env node
require('../backend/importers/setup').setup({ fromExcel: process.argv.includes('--from-excel'), skipClaims: process.argv.includes('--skip-claims') }).catch(e => { console.error(e); process.exit(1); });
