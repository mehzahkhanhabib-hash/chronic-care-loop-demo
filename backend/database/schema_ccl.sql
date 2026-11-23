-- ════════════════════════════════════════════════════════════════════════════
-- Layers B–E. File: data/db/ccl.sqlite
--   B  member_longitudinal (377 source columns, created by the importer from the file header) + crosswalk + field catalogue
--   C  rule configuration (loaded from data/seed/rules/*.csv; tables carry the CSV names, views carry the design names)
--   D  care intelligence outputs (written by the rule engine, keyed by run + member + rule version)
--   E  operational / write-back (written by the Care Coordinator Portal and the Studio)
-- ════════════════════════════════════════════════════════════════════════════

-- ── Layer B ────────────────────────────────────────────────────────────────
CREATE TABLE member_identifier_crosswalk (
  member_id          TEXT PRIMARY KEY,      -- canonical id used by both applications (= mask_id)
  longitudinal_mask_id TEXT,                -- mask_id in 250_members_longitudinal_data.xlsx
  claims_mask_id     TEXT,                  -- mask_id in Raw_Claims_250_Members_*.xlsx
  display_name       TEXT,                  -- pseudonym for the demo screens (no real names exist in either source)
  initials           TEXT,
  in_longitudinal    INTEGER DEFAULT 0,
  in_claims          INTEGER DEFAULT 0
);
CREATE TABLE longitudinal_field (           -- the 377-column catalogue (from the glossary and rule_field.csv)
  field              TEXT PRIMARY KEY,      -- source column name, exactly as in the Excel header
  sql_name           TEXT,
  type               TEXT,                  -- num | text | date | flag
  field_group        TEXT,
  read_by_rules      TEXT,
  description        TEXT
);

-- ── Layer C (static shape; the CSV-shaped rule tables are created by the importer) ──
CREATE TABLE rule_definition (              -- one row per stable rule id, across every rule family
  rule_id            TEXT PRIMARY KEY,      -- Trig1..Trig13, BPU, RS-C-001.., ALERT-RED.., TIER-1.., P1..
  rule_version       TEXT NOT NULL,
  rule_type          TEXT NOT NULL,         -- trigger | risk_points | alert | tier | priority | writeback
  pathway            TEXT,
  name               TEXT NOT NULL,
  expression_text    TEXT,                  -- the condition in words, from the rulebook
  output_type        TEXT,                  -- need | points | colour | tier | priority | state
  priority_order     INTEGER,
  source_section     TEXT
);

-- ── Layer D ────────────────────────────────────────────────────────────────
CREATE TABLE intelligence_run (
  run_id             INTEGER PRIMARY KEY,
  rule_version       TEXT NOT NULL,
  trigger_variant    TEXT NOT NULL,         -- rulebook | extract
  run_date           TEXT NOT NULL,         -- the demo "today"
  as_of_date         TEXT NOT NULL,         -- extract as-of date
  started_at         TEXT NOT NULL,
  finished_at        TEXT,
  members_evaluated  INTEGER,
  triggered_by       TEXT,                  -- setup | studio | api | portal
  stats_json         TEXT
);
CREATE TABLE member_risk_result (
  run_id             INTEGER NOT NULL REFERENCES intelligence_run(run_id),
  member_id          TEXT NOT NULL,
  rule_version       TEXT NOT NULL,
  clinical_score     INTEGER, comorbidity_score INTEGER, kidney_score INTEGER, utilisation_score INTEGER, age_sex_score INTEGER,
  total_risk_score   INTEGER,
  tier               INTEGER, tier_label TEXT,
  kidney_provisional INTEGER DEFAULT 0,     -- K came from the documented CKD stage (no eGFR / UACR)
  safety_flag        INTEGER DEFAULT 0,     -- Priority clinical review (DKA / hypoglycaemia / extract flag)
  pathway            TEXT,                  -- T2D | HTN | T2D·HTN
  extract_clinical_score INTEGER, extract_comorbidity_score INTEGER, extract_kidney_score INTEGER, extract_utilisation_score INTEGER, extract_age_sex_score INTEGER,
  extract_total_risk_score INTEGER,         -- reference: the longitudinal file's own Total_risk_Score
  extract_risk_tier  TEXT,                  -- reference: the file's Risk_tier label (reverse-numbered in the source)
  matches_extract    INTEGER,               -- 1 when the engine total equals the extract total
  evaluated_at       TEXT NOT NULL,
  PRIMARY KEY (run_id, member_id)
);
CREATE TABLE member_rule_evaluation (       -- one row per member × rule × run (risk points, triggers, alerts)
  evaluation_id      INTEGER PRIMARY KEY,
  run_id             INTEGER NOT NULL REFERENCES intelligence_run(run_id),
  member_id          TEXT NOT NULL,
  rule_id            TEXT NOT NULL,
  rule_type          TEXT NOT NULL,         -- risk_points | trigger | alert
  rule_version       TEXT NOT NULL,
  input_features     TEXT,                  -- longitudinal columns read (comma separated)
  input_values_json  TEXT,                  -- {"Last_HbA1c_Value": 9.4, ...}
  evaluation_logic   TEXT,                  -- the condition tested, in words
  evaluation_result  TEXT NOT NULL,         -- fired | cannot_tell | not_fired | scored
  points_awarded     INTEGER,
  clinical_evidence  TEXT,
  priority           TEXT,                  -- P1..P4 (triggers: the member's contact priority at this run)
  alert_colour       TEXT,                  -- RED | AMBER | YELLOW | GREEN
  next_best_action   TEXT,
  action_owner       TEXT,
  done_when          TEXT,
  evaluated_at       TEXT NOT NULL
);
CREATE INDEX ix_eval_member ON member_rule_evaluation(member_id, run_id);
CREATE TABLE member_alert (
  run_id             INTEGER NOT NULL REFERENCES intelligence_run(run_id),
  member_id          TEXT NOT NULL,
  alert_colour       TEXT NOT NULL,
  alert_rule_id      TEXT,
  contact_priority   TEXT NOT NULL,         -- P1..P4
  sla_days           INTEGER,
  reasons            TEXT,
  PRIMARY KEY (run_id, member_id)
);
CREATE TABLE care_plan (                    -- one living plan per member (status carried across runs)
  care_plan_id       TEXT PRIMARY KEY,      -- CP-<member_id>
  member_id          TEXT NOT NULL UNIQUE,
  pathway            TEXT,
  tier               INTEGER,
  cadence            TEXT,
  status             TEXT NOT NULL DEFAULT 'active',
  created_run_id     INTEGER,
  updated_run_id     INTEGER,
  created_at         TEXT, updated_at TEXT
);
CREATE TABLE care_need (                    -- a care gap / need: one per member × trigger (the care plan items)
  need_id            TEXT PRIMARY KEY,      -- N-<member_id>-<trigger_code>
  care_plan_id       TEXT NOT NULL REFERENCES care_plan(care_plan_id),
  member_id          TEXT NOT NULL,
  trigger_code       TEXT NOT NULL,
  need_class         TEXT NOT NULL,         -- safety | acute | unctl | barrier | gap | goal
  class_order        INTEGER NOT NULL,
  trigger_order      INTEGER NOT NULL,
  rank               INTEGER,               -- 1..n inside the member's open needs
  slot               TEXT NOT NULL,         -- CURRENT | NEXT | FUTURE | CLOSED
  status             TEXT NOT NULL,         -- open | done | declined
  gap_state          TEXT NOT NULL,         -- Potential | Verified | Scheduled | Reported | Closed
  due_date           TEXT,
  hold_until         TEXT,
  evidence           TEXT,
  next_best_action   TEXT, action_owner TEXT, done_when TEXT, action_code TEXT,
  opened_run_id      INTEGER, opened_at TEXT, closed_at TEXT,
  last_evaluation_id INTEGER
);
CREATE INDEX ix_need_member ON care_need(member_id, slot);
CREATE TABLE action (                       -- every unit of work: care-plan action, outreach call, nudge, follow-up, retry, escalation
  action_id          INTEGER PRIMARY KEY,
  member_id          TEXT NOT NULL,
  need_id            TEXT REFERENCES care_need(need_id),
  kind               TEXT NOT NULL,         -- care_plan | call | nudge | follow_up | retry | escalation
  title              TEXT NOT NULL,
  channel            TEXT,
  owner_role         TEXT,
  assignee           TEXT,                  -- nurse_user.user_id
  due_date           TEXT,
  status             TEXT NOT NULL DEFAULT 'open',   -- open | done | declined | cancelled
  agreed             INTEGER DEFAULT 0,
  attempt            INTEGER DEFAULT 1,
  parent_action_id   INTEGER,
  source             TEXT,                  -- engine | followup | portal | studio
  run_id             INTEGER,
  created_at         TEXT NOT NULL, closed_at TEXT
);
CREATE INDEX ix_action_member ON action(member_id, status);
CREATE INDEX ix_action_assignee ON action(assignee, status, due_date);
CREATE TABLE worklist (                     -- today's queue, rebuilt every run; one row per member with an open outreach
  run_id             INTEGER NOT NULL,
  member_id          TEXT NOT NULL,
  nurse_id           TEXT,
  rank_no            INTEGER,               -- programme-wide rank (rule_queue_order)
  nurse_rank         INTEGER,
  list_status        TEXT,                  -- today | queued | nudge
  contact_priority   TEXT, alert_colour TEXT, tier INTEGER, safety_flag INTEGER,
  campaign_id        TEXT,
  action_id          INTEGER,
  due_by             TEXT,
  current_needs      TEXT,
  PRIMARY KEY (run_id, member_id)
);

-- ── Layer E ────────────────────────────────────────────────────────────────
CREATE TABLE nurse_user (
  user_id            TEXT PRIMARY KEY,      -- U-0142 …
  username           TEXT UNIQUE,
  pin                TEXT,                  -- demo login (4 digits). No real authentication service.
  name               TEXT NOT NULL,
  role               TEXT NOT NULL,         -- Registered nurse | Care coordinator | Clinical lead | Population health
  languages          TEXT,                  -- comma separated
  daily_capacity     INTEGER,
  active             INTEGER DEFAULT 1
);
CREATE TABLE cohort (
  cohort_id          TEXT PRIMARY KEY,
  version            INTEGER NOT NULL,
  name               TEXT NOT NULL,
  base               TEXT,                  -- daman | seha | pura
  logic              TEXT,                  -- all | any
  refresh            TEXT,
  definition_json    TEXT,                  -- the builder's rules as saved
  compiled_sql       TEXT,
  row_count          INTEGER,
  owner              TEXT,
  created_at         TEXT, updated_at TEXT
);
CREATE TABLE cohort_rule (
  rule_id            TEXT PRIMARY KEY,
  cohort_id          TEXT NOT NULL REFERENCES cohort(cohort_id),
  version            INTEGER NOT NULL,
  field              TEXT, operator TEXT, value TEXT, value2 TEXT, codes_json TEXT, lab TEXT,
  is_exclusion       INTEGER DEFAULT 0
);
CREATE TABLE cohort_member (
  cohort_id          TEXT NOT NULL REFERENCES cohort(cohort_id),
  member_id          TEXT NOT NULL,
  version            INTEGER NOT NULL,
  holdout            INTEGER DEFAULT 0,
  added_at           TEXT,
  PRIMARY KEY (cohort_id, member_id)
);
CREATE TABLE campaign (
  campaign_id        TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  goal               TEXT,
  mode               TEXT,                  -- automated | business
  triggers_json      TEXT,                  -- business mode: the trigger codes kept
  channels           TEXT,
  nurses             INTEGER, calls_per_day INTEGER, holdout_pct INTEGER DEFAULT 10,
  start_date         TEXT, weeks INTEGER,
  priority           INTEGER,
  status             TEXT,                  -- Draft | Scheduled | Live | Paused | Closed
  created_by         TEXT, created_at TEXT, updated_at TEXT
);
CREATE TABLE campaign_cohort (
  campaign_id        TEXT NOT NULL REFERENCES campaign(campaign_id),
  cohort_id          TEXT NOT NULL REFERENCES cohort(cohort_id),
  role               TEXT NOT NULL,         -- include | exclude
  PRIMARY KEY (campaign_id, cohort_id, role)
);
CREATE TABLE campaign_member (              -- who each run put in which campaign (highest-priority live campaign wins)
  run_id             INTEGER NOT NULL,
  campaign_id        TEXT NOT NULL REFERENCES campaign(campaign_id),
  member_id          TEXT NOT NULL,
  holdout            INTEGER DEFAULT 0,
  PRIMARY KEY (run_id, member_id)
);
CREATE TABLE member_assignment (
  member_id          TEXT PRIMARY KEY,
  nurse_id           TEXT REFERENCES nurse_user(user_id),
  assigned_at        TEXT, assigned_by TEXT
);
CREATE TABLE contact_attempt (              -- every call attempt (reached or not)
  attempt_id         INTEGER PRIMARY KEY,
  member_id          TEXT NOT NULL,
  nurse_id           TEXT,
  action_id          INTEGER,
  campaign_id        TEXT,
  channel            TEXT DEFAULT 'call',
  started_at         TEXT NOT NULL, ended_at TEXT,
  reached            INTEGER,
  result             TEXT                   -- reached | no_answer | busy | voicemail | wrong_number
);
CREATE TABLE call_interaction (             -- the structured call workflow (one per reached call)
  call_id            INTEGER PRIMARY KEY,
  attempt_id         INTEGER REFERENCES contact_attempt(attempt_id),
  member_id          TEXT NOT NULL,
  nurse_id           TEXT,
  stage              TEXT,                  -- consent | review | actions | outcome | closed
  red_flag           INTEGER DEFAULT 0,
  response           TEXT,                  -- member response summary
  notes              TEXT,
  started_at         TEXT, ended_at TEXT
);
CREATE TABLE consent_event (
  consent_event_id   INTEGER PRIMARY KEY,
  member_id          TEXT NOT NULL,
  call_id            INTEGER,
  nurse_id           TEXT,
  consent_status     TEXT NOT NULL,         -- granted | declined | withdrawn | pending
  scope              TEXT,                  -- outreach | care_plan | data_sharing
  recorded_at        TEXT NOT NULL,
  duration_seconds   INTEGER,
  note               TEXT
);
CREATE INDEX ix_consent_member ON consent_event(member_id, recorded_at);
CREATE TABLE member_assertion (             -- what the member told the nurse (never closes a gap by itself)
  assertion_id       INTEGER PRIMARY KEY,
  member_id          TEXT NOT NULL,
  call_id            INTEGER,
  need_id            TEXT,
  assertion_text     TEXT NOT NULL,
  recorded_by        TEXT, recorded_at TEXT NOT NULL
);
CREATE TABLE disposition_event (            -- nurse decision on a need / action: done, declined, agreed, carried, not_reached
  disposition_id     INTEGER PRIMARY KEY,
  member_id          TEXT NOT NULL,
  need_id            TEXT,
  action_id          INTEGER,
  call_id            INTEGER,
  outcome            TEXT NOT NULL,
  note               TEXT,
  recorded_by        TEXT, recorded_at TEXT NOT NULL,
  processed_at       TEXT                   -- when the write-back rule was applied
);
CREATE INDEX ix_disp_member ON disposition_event(member_id, recorded_at);
CREATE TABLE task (                         -- the portal's task list (follow-ups, bookings, checks) — a projection of action
  task_id            INTEGER PRIMARY KEY,
  action_id          INTEGER REFERENCES action(action_id),
  member_id          TEXT NOT NULL,
  title              TEXT NOT NULL,
  task_kind          TEXT,                  -- call | follow_up | booking | verify | escalation | nudge
  assignee           TEXT,
  due_date           TEXT, due_time TEXT,
  status             TEXT DEFAULT 'open',
  completed_at       TEXT, booking_date TEXT,
  created_at         TEXT
);
CREATE TABLE appointment (
  appointment_id     INTEGER PRIMARY KEY,
  member_id          TEXT NOT NULL,
  need_id            TEXT, action_id INTEGER,
  appointment_type   TEXT,                  -- GP | lab | specialist | eye | foot | dietitian
  provider_name      TEXT,
  scheduled_date     TEXT, scheduled_time TEXT,
  status             TEXT DEFAULT 'booked', -- booked | attended | missed | cancelled
  booked_by          TEXT, booked_at TEXT
);
CREATE TABLE care_gap_event (               -- state transitions of a need's gap_state (audit of Potential → … → Closed)
  gap_event_id       INTEGER PRIMARY KEY,
  need_id            TEXT NOT NULL,
  member_id          TEXT NOT NULL,
  from_state         TEXT, to_state TEXT NOT NULL,
  moved_by           TEXT,                  -- engine | nurse:<id> | claims
  evidence           TEXT,
  run_id             INTEGER,
  recorded_at        TEXT NOT NULL
);
CREATE TABLE nurse_note (
  note_id            INTEGER PRIMARY KEY,
  member_id          TEXT NOT NULL,
  nurse_id           TEXT, call_id INTEGER,
  text               TEXT NOT NULL,
  created_at         TEXT NOT NULL
);
CREATE TABLE audit_event (
  audit_id           INTEGER PRIMARY KEY,
  at                 TEXT NOT NULL,
  actor              TEXT,
  operation          TEXT,                  -- READ | WRITE
  entity             TEXT,
  detail             TEXT,
  endpoint           TEXT
);
CREATE TABLE app_setting (key TEXT PRIMARY KEY, value TEXT);

-- Design-name views over the rule tables (workbook names → CSV tables). Created after the CSV tables exist.

-- ── Names from CCC_Revised_Raw_Member360_Longitudinal_Care_Intelligence.xlsx (START – Architecture, Join Keys, Portal Output Contract) ──
-- The workbook names the same objects slightly differently; these views expose them under its names so the sheets can be read against the database 1:1.
