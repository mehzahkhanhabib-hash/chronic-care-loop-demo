# Chronic Care Loop · demo

A locally runnable **Chronic Care Command Centre (CCC)** demonstration for the Daman × HICC programme:

| Product | What it is | URL after `npm run dev` |
|---|---|---|
| **Chronic Care Studio** | Three screens: cohort & campaign builder → care intelligence → the nurse's portal view | http://localhost:3000 |
| **Care Coordinator Portal** | The nurse's standalone portal: worklist, call workflow with consent gate, Member 360, care gaps and plan, tasks, analytics | http://localhost:3001 |
| **Express backend** | REST API over two SQLite files: raw claims (Member 360) and longitudinal + rules + intelligence + operations | http://localhost:4000/api/health |

Both products are independent React apps that share one backend, one member identifier (`mask_id`) and one database.

```
Raw claims Excel (3 parts) ─▶ claims.sqlite ─▶ Member 360 APIs ─────────────────▶ Portal
Longitudinal Excel (377 cols) + rule database (CSV) ─▶ Care Intelligence engine ─▶ risk · triggers · alerts · care plans · worklist ─▶ Studio + Portal
Portal actions (consent · calls · dispositions · tasks) ─▶ operational tables ─▶ next intelligence run
```

The clinical logic is the **CCC Rulebook · T2D and Hypertension (20 Nov 2026)**, implemented as rule tables (`data/seed/rules/*.csv`), not code. See `docs/rulebook/`.

Design references: the Studio reproduces `Chronic-Care-Studio_7.html`, the Portal reproduces `Care-Coordinator-Portal (3).html` (both in `data/source/`).

---

## 1. Requirements (Windows, macOS or Linux)

- **Node.js 18.17 or newer** (20 LTS or 22 recommended). Check with `node -v`. Download from https://nodejs.org (the LTS installer; keep "Add to PATH" ticked).
- About 1.5 GB of free disk space and an internet connection for the one-off `npm install`.
- No Docker, no database server, no cloud account, no API keys. SQLite runs inside Node (WebAssembly build, no compiler needed).

## 2. Install and run (first time)

Open **PowerShell** or **Command Prompt** in the extracted folder (the one containing this README and `package.json`) and run, one after another:

```bash
npm install
```
Installs every dependency for the backend and both apps (2–4 minutes).

```bash
npm run setup
```
Builds the two databases from `data/seed/` (about 15 seconds): imports the 144,292 raw claim lines and 29,976 lab results, the 250 longitudinal members with all 377 columns, loads the rule database, seeds nurse accounts, cohorts and campaigns, and runs the Care Intelligence engine once. Progress is printed; the last line reads `done in …s → …/data/db`.

```bash
npm run dev
```
Starts the backend on port 4000 and both apps (webpack dev servers) on 3000 and 3001 in one window. Wait for `webpack compiled successfully` to appear twice, then open:

- Chronic Care Studio → http://localhost:3000
- Care Coordinator Portal → http://localhost:3001

When the Studio opens it shows a **How it works** guide to the three layers (cohort builder → care intelligence → care portal); click a layer to go there, or reopen the guide with the **?** button at the top.

Stop everything with `Ctrl+C`.

### Nurse accounts (local demo login, PIN `1234`)

| username | name | role | languages |
|---|---|---|---|
| `nadia` | Nadia Rahman | Registered nurse | English, Hindi |
| `omar` | Omar Khalid | Care coordinator | Arabic, English |
| `sara` | Sara Mansour | Registered nurse | Arabic, English |
| `layla` | Layla Mansoor | Population health (Studio) | English, Arabic |
| `rana` | Dr. Rana Khalil | Clinical lead (escalations) | Arabic, English |

There is no real authentication: the login only chooses whose worklist you see and who is recorded on each action.

## 3. Everyday commands

| command | what it does |
|---|---|
| `npm run dev` | backend + both apps in development mode |
| `npm run build` then `npm start` | production build of both apps, served by the backend at http://localhost:4000/studio and http://localhost:4000/portal |
| `npm run reset` | **reset the demo**: forget every nurse action and rebuild the intelligence from the seed data (keeps the imported claims; stop the backend first) |
| `npm run setup` | full rebuild of both databases from `data/seed/` |
| `npm run setup:from-excel` | same, but reading the original `.xlsx` workbooks in `data/source/` instead of the CSV seeds (slower, ~2 GB RAM) |
| `npm run intelligence:run` | run the Care Intelligence engine once from the command line |
| `npm test` | backend test suite (importers, engine, write-back, API) on a throw-away copy of the databases |
| `npm run docs:erd` | regenerate `docs/data-model/` from the live schema |

Settings live in `.env` (copy `.env.example`): ports, the demo "today" (`CCL_RUN_DATE=2026-11-20`), the extract as-of date and the trigger variant.

## 4. Try the two demonstration members

The full script with the expected numbers is in **`docs/demo-scenarios/DEMO.md`**; screenshots are in `docs/demo-scenarios/screenshots/`.

1. **`x2063`** · type 2 diabetes · tier 4 Very high · HbA1c 11.3 · seven fired triggers.
2. **`x206`** · type 2 diabetes + hypertension · tier 3 High · HbA1c 9.5, BP 154/75 · HbA1c, BP and kidney triggers.

**Cohort → intelligence → portal.** Build a cohort in the Studio, save it, set up a campaign and press *Hand off to care intelligence*. The Studio stores that campaign's members as the active scope: *Care intelligence* then lists and counts only those members (with a banner and a *Show all members* button), and the Care Coordinator Portal's queue shows the same members across every nurse (a *My list* chip switches back). The scope can also be picked from the member-list dropdown on the intelligence screen.

In the Studio open *Care intelligence* and search the id; in the Portal log in as the nurse named in the guide, open the member from the queue, grant consent, record the call and the outcomes, and watch the care plan, tasks and the Studio update.

## 5. Where things are

```
apps/chronic-care-studio/        React · Webpack 5 · Babel · React Router (port 3000)
apps/care-coordinator-portal/    React · Webpack 5 · Babel · React Router (port 3001)
backend/
  api/server.js                  Express routes (docs/api/API.md)
  services/                      member360 (raw claims), intelligence, portal, cohorts
  rule-engine/                   engine.js (run), rules.js (rule tables), features.js, writeback.js
  database/                      adapter.js (sql.js; swap for MySQL here), schema_claims.sql, schema_ccl.sql
  importers/                     claims.js, longitudinal.js, rules.js, seed_operational.js, setup.js
  tests/                         node --test
data/source/                     the supplied workbooks (raw claims ×3, longitudinal, rule database, portal UI mapping, Revised Member360/Longitudinal/CI, rulebook tables), the rulebook .docx, the reference HTML (Studio, Portal, Screen-to-Table lineage); masked data
data/seed/                       deterministic CSV/TSV seeds derived 1:1 from the workbooks; rules/*.csv = the rule database
data/db/                         claims.sqlite and ccl.sqlite (created by npm run setup; not committed)
docs/
  data-model/                    DATA_MODEL.md (every table and column), ERD.md (Mermaid)
  mappings/                      raw-claims-to-tables, longitudinal-catalogue (377), longitudinal-to-rules, revised-workbook (sheet → implementation), LINEAGE.md + lineage.json
  rulebook/                      RULEBOOK.md (how rules run), decisions.md (every mapping decision)
  api/API.md                     every endpoint with a real sample response
  demo-scenarios/                DEMO.md + screenshots
scripts/                         setup, reset, dev, erd, gen_api_docs, gen_demo_doc, gen_lineage, package
```

## 6. Troubleshooting

| symptom | fix |
|---|---|
| `'node' is not recognized` | Install Node.js LTS and reopen the terminal. |
| `npm install` fails with EACCES / EPERM | Extract the ZIP somewhere you own (e.g. `C:\Users\<you>\chronic-care-loop-demo`), not in Program Files; close editors that lock files. |
| `npm run setup` says `Cannot find module 'sql.js'` | `npm install` has not finished or was run in the wrong folder. Run it in the folder that contains this README. |
| Port 3000/3001/4000 already in use | Set other ports in `.env` (`STUDIO_PORT`, `PORTAL_PORT`, `PORT`) and restart `npm run dev`. |
| Browser shows the app but "Cannot reach the backend" | The backend window must show `listening on http://localhost:4000`. Start it alone with `npm run dev:backend` and open http://localhost:4000/api/health. |
| Webpack "compiled with warnings" | Harmless. "compiled with errors" is not: copy the message and check the file it names. |
| Something looks stuck after many nurse actions | `Ctrl+C`, `npm run reset`, `npm run dev`. |
| Windows Defender / SmartScreen prompt on first `npm run dev` | Allow Node.js on private networks (it only listens on localhost). |
| `npm run setup:from-excel` runs out of memory | Use the default `npm run setup` (reads the CSV seeds, which are byte-for-byte the same data). |

## 7. Data and privacy

The workbooks contain **masked** member data (`mask_id`), no names. Display names in the apps are deterministic pseudonyms generated from the mask id and are labelled as such. Keep the repository private and do not add any unmasked data.

## 8. Acceptance checklist

See `docs/ACCEPTANCE.md` for the section-14 criteria with the evidence (test names, counts and screenshots).
