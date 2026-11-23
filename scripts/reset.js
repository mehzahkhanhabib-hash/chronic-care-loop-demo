#!/usr/bin/env node
/** `npm run reset`: forget every nurse action and rebuild the intelligence from the seed data (keeps the imported claims). Stop the backend first. */
require('../backend/importers/setup').setup({ skipClaims: true }).then(() => console.log('Reset to the original demo state.')).catch(e => { console.error(e); process.exit(1); });
