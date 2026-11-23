# How the rulebook runs

The rulebook is implemented as **data** (Layer C tables loaded from `data/seed/rules/*.csv`) plus one generic evaluator (`backend/rule-engine/`). Nothing clinical is hard-coded in JavaScript or in the frontends.

## Rule tables and their rule IDs

| Rulebook section | Table (CSV) | Design-name view | Rule IDs | Rows |
|---|---|---|---|---|
| §2 Risk components and caps | `rule_risk_component` | `risk_component` | C, M, K, U, A (caps 5, 6, 5, 5, 2) | 5 |
| §2 Points per band | `risk_score_band` | — | RS-C-001 … RS-A-032 (38 bands incl. provisional kidney and split age/sex rows) | 38 |
| §2 Tiers and cadence | `rule_tier`, `rule_cadence` | `risk_tier`, `contact_cadence` | TIER-1 … TIER-4 | 4 + 29 |
| §3 Trigger library | `rule_trigger` | `clinical_trigger` | Trig1 … Trig13, BPU | 14 |
| §3 Fire conditions | `rule_condition` | `trigger_condition` | `trigger:<Trig>:<variant>` groups (OR between groups, AND inside) | 100 |
| §3 Next-best actions | `rule_action` | `next_best_action` | ACT-… one per trigger (title, owner, channel, done-when, escalate-to) | 14 |
| §4 Need classes and due days | `rule_need_class` | — | safety 0d, acute 3d, unctl 7d, barrier 7d, gap 30d, goal 14d | 6 |
| §4 Slots | `rule_slot` | — | CURRENT 1–3, NEXT 4–6, FUTURE 7+ | 4 |
| §4 Alert colours | `rule_alert` + `rule_condition` type alert | `alert_rule` | ALERT-RED/AMBER/YELLOW/GREEN | 4 |
| §4 Contact priority and SLA | `rule_contact_priority` | `priority_rule` | P1 (RED, or AMBER + Trig4) same day · P2 AMBER next day · P3 YELLOW 3 days · P4 GREEN digital nudge | 5 |
| §4 Queue order | `rule_queue_order` | — | safety/RED → tier → campaign priority → hours past SLA | 4 |
| §5 Write-back | `rule_writeback`, `rule_gap_state` | — | WB-done, WB-declined, WB-not_reached, WB-carried, WB-agreed | 5 + 5 |
| §6–7 Guardrails, decision tree, consent gate | `rule_guardrail`, `rule_decision_step`, `rule_consent_gate`, `rule_safety_flag` | — | G0 … G10, steps A … J | — |
| Inputs | `rule_input` + `rule_field` | `rule_input_binding` | 294 bindings rule → longitudinal column | 294 |
| Register | `rule_definition`, `rule_version` | — | every id above, with version `DEMO-2026-11-20` | 74 |

## One run, step by step (`backend/rule-engine/engine.js`)

1. **Features** – one row of `member_longitudinal` becomes a vector: numbers as numbers, dates as *days before the as-of date*, implausible values emptied (G0).
2. **Risk** – every `risk_score_band` row is tested; matching rows add their points to the component, components are capped, `R = C+M+K+U+A`, tier from `rule_tier`. Each matched band is written to `member_rule_evaluation` (`rule_type = risk_points`) with the inputs it read.
3. **Triggers** – for each `rule_trigger`, the condition groups of the chosen variant are tested: `fired` when a group matches, else `cannot_tell` when the cannot-tell group matches, else `not_fired`. One `member_rule_evaluation` row per trigger carries `input_features`, `input_values_json`, `evaluation_logic`, `evaluation_result`, `clinical_evidence`, `next_best_action`, `action_owner`, `done_when`, the member's `priority` and `alert_colour`, and `evaluated_at`.
4. **Alert and priority** – RED / AMBER / YELLOW groups from `rule_condition`, GREEN otherwise; safety flag from DKA / hypoglycaemia / `Priority_clinical_review`; P1–P4 from `rule_contact_priority`.
5. **Campaign ownership** – a member belongs to the highest-priority *Live* campaign whose cohorts include them (minus exclusions, 10% holdout, `Exclusion = 1`, declined consent). Business-mode campaigns keep only their listed triggers.
6. **Care plan** – one `care_need` per fired trigger (class, due date from `rule_need_class`); open needs ranked by class order then trigger order; ranks 1–3 CURRENT, 4–6 NEXT, rest FUTURE; needs whose trigger stopped firing close in claims; declined needs return after their hold.
7. **Actions** – one open care-plan action per CURRENT need (title = `rule_action.title`) and one outreach per member: a call due by the SLA, or a digital nudge for P4.
8. **Worklist** – programme rank by `rule_queue_order`, nurse by continuity → language → lightest load, `today` up to the nurse's daily capacity, else `queued`; follow-ups with a future date are `scheduled`.

## Write-back (`backend/rule-engine/writeback.js`)

| Nurse input | Event table | Effect (from `rule_writeback`) |
|---|---|---|
| Consent granted / declined / withdrawn | `consent_event` | gate G2; declined cancels open outreach |
| Call reached | `contact_attempt`, `call_interaction` | closes the outreach, schedules the cadence check-in; a RED flag raises an escalation |
| Call not reached | `contact_attempt` | retry next working day, 3 attempts; a P1 member escalates to the clinical lead |
| Member assertion | `member_assertion` | gap Potential → Verified; never closes |
| Outcome `agreed` | `disposition_event` | gap → Scheduled, "Check it happened: <done-when>" follow-up |
| Outcome `done` | `disposition_event` | need done, gap → Reported, "Verify in claims" follow-up, next need promoted |
| Outcome `declined` | `disposition_event` | 90-day hold, re-offer at day 90, next need promoted |
| Outcome `carried` | `disposition_event` | stays CURRENT |
| Task booked | `task`, `appointment` | gap → Scheduled |

See [decisions.md](decisions.md) for every place the rulebook text was mapped onto the file's columns.
