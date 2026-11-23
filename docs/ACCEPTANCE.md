# Acceptance checklist (section 14 of the build brief)

Evidence gathered on the seeded demo database (`npm run setup`, rule version DEMO-2026-11-20). Test names refer to `backend/tests/kit.test.js` (`npm test`).

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | All three Chronic Care Studio screens implemented | ✅ | `apps/chronic-care-studio/src/screens/` (Builder, Intelligence, Portal); screenshots `docs/demo-scenarios/screenshots/studio-*.png`. The Figma files were not attached to the brief; the supplied `Chronic-Care-Studio_7.html` (Control Command Center design, built from the Figma) is the visual and functional reference. |
| 2 | Care Coordinator Portal is a standalone React application | ✅ | `apps/care-coordinator-portal/` (React 18, React Router 6, Webpack 5, Babel), converted from `Care-Coordinator-Portal (3).html`; runs alone on port 3001 |
| 3 | Neither application uses Vite | ✅ | `apps/*/webpack.config.js`, `babel.config.js`; no Vite dependency in any `package.json` |
| 4 | Both applications connect to the same backend | ✅ | both `src/api.js` call `/api` → Express on :4000 (`backend/api/server.js`) |
| 5 | SQLite contains all 250 longitudinal members | ✅ | test *longitudinal imported with all 377 columns and a crosswalk for every member*; `member_longitudinal` = 250 rows |
| 6 | All 377 longitudinal source columns retained | ✅ | same test (`PRAGMA table_info(member_longitudinal)` = 377); `docs/mappings/longitudinal-catalogue.md` |
| 7 | Raw claims and associated lab records imported | ✅ | test *raw claims imported*: 144,292 activity lines, 34,407 claims, 250 members, 29,976 lab observations all linked to a claim activity via ACTIVITY_ID; `docs/mappings/raw-claims-to-tables.md` maps all 81 + 14 source columns |
| 8 | Member 360 reads historical data from raw claims | ✅ | `backend/services/member360.js` queries only `claims.sqlite`; every `/api/members/:id/360|claims|labs|medications|encounters|procedures|providers|costs` response carries claim ids; Portal shows "Source: raw claims" |
| 9 | Care Intelligence reads features from the longitudinal table | ✅ | `backend/rule-engine/features.js` reads `member_longitudinal` only; no claims-derived value enters a rule |
| 10 | Clinical rulebook implemented as executable rule logic | ✅ | rule tables in `data/seed/rules/*.csv` → Layer C; evaluator `rule-engine/rules.js`; `docs/rulebook/RULEBOOK.md` |
| 11 | Risk scores and triggers traceable to inputs and rule IDs | ✅ | `member_rule_evaluation` (5,117 rows per run: 1,367 scoring, 3,500 trigger, 250 alert) with `rule_id`, `rule_version`, `input_features`, `input_values_json`, `evaluation_logic`, `evaluation_result`, `clinical_evidence`, `evaluated_at`; engine total equals the extract's `Total_risk_Score` for 250/250 members (test *engine reproduces the extract risk scores*) |
| 12 | Next-best actions and care plans generated | ✅ | 748 needs, 557 CURRENT with one open action each (test *every CURRENT need has one open action*); NBAs from `rule_action` |
| 13 | Portal displays actual Care Intelligence output | ✅ | Portal reads `/api/members/:id`, `/risk`, `/evaluations`, `/care-plan`, `/portal/worklist`; screenshots `portal-*.png` |
| 14 | Consent, calls, dispositions and task updates persist | ✅ | tests *write-back* and *consent gate*; events in `consent_event`, `contact_attempt`, `call_interaction`, `disposition_event`, `task`, `appointment`, `care_gap_event`; data survives restarts (SQLite files) |
| 15 | Supplied mappings and lineage represented | ✅ | every object named in `CCC_Revised_Raw_Member360_Longitudinal_Care_Intelligence.xlsx` exists under that name (`docs/mappings/revised-workbook.md`, test *views named by the Revised … workbook*); `docs/mappings/LINEAGE.md` + `lineage.json` (served at `/api/lineage`), `docs/data-model/DATA_MODEL.md`, `ERD.md`; rule tables keep the workbook's rule ids (Trig1–13, BPU, RS-C-001 …) |
| 16 | Two actual members demonstrable end to end | ✅ | `docs/demo-scenarios/DEMO.md`: x2063 (T2D) and x206 (T2D + HTN) with real inputs, expected evaluations and screenshots |
| 17 | No critical buttons, forms or navigation non-functional | ✅ | every control in both apps calls an API or routes; verified with Playwright flows during the build (see `docs/demo-scenarios/BUILD_NOTES.md`) |
| 18 | Both applications run locally without cloud dependencies | ✅ | sql.js (WebAssembly SQLite), Express, webpack dev server; no external services; Google Fonts is the only optional external request |
| 19 | Documentation and setup instructions complete | ✅ | `README.md` (Windows setup, commands, troubleshooting, reset), `docs/api/API.md`, `docs/rulebook/`, `docs/data-model/`, `docs/mappings/`, `docs/demo-scenarios/` |
| 20 | Delivered as a ZIP bundle | ✅ | `npm run package` → `release/chronic-care-loop-demo.zip` (source, seeds, source workbooks, docs; no node_modules) |
| 21 | Repository published to GitHub | ✅ | https://github.com/mehzahkhanhabib-hash/chronic-care-loop-demo |

## Known limitations (documented, not hidden)

- The Figma designs were not part of the uploaded material; the Studio reproduces the supplied Chronic-Care-Studio_7.html, which was itself built from the Figma.
- Wearable/CGM tiles of the original portal fixture have no source in either workbook and are not shown.
- Hypoglycaemia and DKA score "per event" in the rulebook; the longitudinal file carries flags, so one event per flag is assumed (decision D4).
- `Trig4` "2 or more ED visits in 90 days" is approximated from 12-month counts and the last ED date (decision D9).
- Names are pseudonyms; the masked id is the identity.
