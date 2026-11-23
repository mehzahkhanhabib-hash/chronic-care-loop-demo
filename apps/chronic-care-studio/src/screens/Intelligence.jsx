import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { useApi } from '../hooks/useApi';
import { Loading, ErrorBox, Empty, Chip, Avatar, Bar, Card, Section, KV } from '../components/ui';
import CarePlanCard from '../components/CarePlanCard';
import { useToast } from '../components/Toast';
import { fmt, dateShort, dateTime, ALERT_TEXT, SLA_TEXT } from '../lib/format';

const FILTERS = [['all', 'Everyone', ''], ['RED', 'Urgent', 'alert=RED'], ['AMBER', 'Priority', 'alert=AMBER'], ['YELLOW', 'Routine', 'alert=YELLOW'], ['GREEN', 'At target', 'alert=GREEN']];
const AL = { RED: ['Urgent · clinician today', '#FDE7E7', '#B3261E'], AMBER: ['Priority · within 72 h', '#FFF1C7', '#8A5A00'], YELLOW: ['Routine · next touchpoint', '#DCF1F7', '#133F70'], GREEN: ['At target', '#DFF3EA', '#13704B'] };
const TIERC = { 1: ['#DFF3EA', '#13704B'], 2: ['#FFF1C7', '#8A5A00'], 3: ['#FFF1C7', '#8A5A00'], 4: ['#FDE7E7', '#B3261E'] };
const TIERN = { 1: 'Low', 2: 'Moderate', 3: 'High', 4: 'Very high' };

export default function Intelligence({ onChanged }) {
  const { memberId } = useParams(); const nav = useNavigate(); const say = useToast();
  const [filter, setFilter] = useState('all'); const [q, setQ] = useState(''); const [tier, setTier] = useState('');
  const scopeApi = useApi('/studio/scope'); const cohorts = useApi('/cohorts');
  const scope = scopeApi.data ? scopeApi.data.scope : null; const sq = scope ? 'scope=active' : '';
  const setScope = async v => { const [kind, id] = v ? v.split(':') : []; try { await api.post('/studio/scope', kind === 'cohort' ? { cohort_id: id } : kind === 'campaign' ? { campaign_id: id } : {}); scopeApi.reload(); window.dispatchEvent(new Event('ccl:scope')); nav('/intelligence'); } catch (e) { say('Could not change the scope: ' + e.message); } };
  const [view, setView] = useState('members');
  const kpis = useApi(scopeApi.loading ? null : `/intelligence/kpis${sq ? '?' + sq : ''}`);
  const qs = [FILTERS.find(f => f[0] === filter)[2], tier ? `tier=${tier}` : '', sq, q ? `q=${encodeURIComponent(q)}` : ''].filter(Boolean).join('&');
  const list = useApi(scopeApi.loading ? null : `/intelligence/members?${qs}`);
  const all = useApi(scopeApi.loading ? null : `/intelligence/members${sq ? '?' + sq : ''}`);
  const campaigns = useApi('/campaigns');
  const [running, setRunning] = useState(false);
  const sel = memberId || (list.data && list.data.members[0] && list.data.members[0].member_id) || null;
  const runNow = async () => { setRunning(true); try { const r = await api.post('/intelligence/runs', {}); say(`Run ${r.run_id} finished: ${r.fired} triggers fired, ${r.needs_opened} new needs, ${r.needs_closed_in_claims} closed in claims`); kpis.reload(); list.reload(); all.reload(); scopeApi.reload(); onChanged && onChanged(); } catch (e) { say('Run failed: ' + e.message); } finally { setRunning(false); } };
  const k = kpis.data;
  const counts = useMemo(() => { const c = { all: 0, RED: 0, AMBER: 0, YELLOW: 0, GREEN: 0 }; (all.data ? all.data.members : []).forEach(m => { c.all++; c[m.alert_colour] = (c[m.alert_colour] || 0) + 1; }); return c; }, [all.data]);
  const live = campaigns.data ? campaigns.data.campaigns.filter(c => c.status === 'Live') : [];
  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>
      <div className="pagehead">
        <div>
          <div className="eyebrow caps">Step 2 · {k ? `Run ${k.run_id} · rule set ${k.rule_version} · as of ${k.run_date}` : 'Care intelligence'}</div>
          <h1 className="title">Who needs us most, and what for</h1>
          <p className="desc">{scope ? '' : live.length ? `Campaign ${live.map(c => c.id + ' · ' + c.name).join(', ')}. ` : ''}Each member was read against the CCC Rulebook: risk score R = C + M + K + U + A (max 23), the 14 triggers, an alert colour and a contact priority. Fired triggers become ranked needs, safety first; the top three are CURRENT and get one next best action each.</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
          {FILTERS.map(([key, label]) => <button key={key} className={'pill' + (filter === key ? ' on' : '')} onClick={() => { setFilter(key); nav('/intelligence'); }}>{label}{all.data ? ` · ${counts[key] || 0}` : ''}</button>)}
          <button className="btn sm" disabled={running} onClick={runNow}>{running ? 'Running…' : '↻ Run rules now'}</button>
        </div>
      </div>
      {scope && <div role="status" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', background: '#0B2E57', color: '#FFFFFF', borderRadius: 16, padding: '12px 18px', marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#9FD7E6', color: '#10202A', whiteSpace: 'nowrap' }}>From the cohort builder</span>
        <span style={{ flex: 1, minWidth: 220, fontSize: 14.5 }}><b>{scope.kind === 'campaign' ? 'Campaign' : 'Cohort'} {scope.id} · {scope.label}</b> · {fmt(scope.members)} members scored by the rulebook{scope.control_group ? ` · ${scope.control_group} in the control group (scored, not called)` : ''}. The care portal shows the same members.</span>
        <button className="btn sm" style={{ background: '#FFFFFF', color: '#0B2E57' }} onClick={() => setScope('')}>Show all members</button>
      </div>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="seg light" style={{ display: 'inline-flex' }}>{[['members', 'Members'], ['programme', 'Programme · per trigger'], ['runs', 'Run history']].map(([v, l]) => <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{l}</button>)}</div>
        {k && <span className="sm mut">{fmt(k.evaluated)} members scored · {fmt(k.triggers_fired)} triggers fired · {fmt(k.cannot_tell)} cannot tell · {fmt(k.care_plans)} care plans · {fmt(k.current_needs)} CURRENT needs · {fmt(k.on_todays_list)} on today’s lists · {fmt(k.queued)} queued · {fmt(k.reported_not_in_claims)} reported · {fmt(k.closed_in_claims)} closed in claims · {fmt(k.consented)} consented</span>}
        {kpis.error && <ErrorBox error={kpis.error} retry={kpis.reload} what="programme KPIs" />}
      </div>
      {view === 'programme' && <Programme />}
      {view === 'runs' && <Runs />}
      {view === 'members' && <div className="row">
        <section className="card tight col" style={{ flex: '0 1 380px', minWidth: 300, gap: 4, maxHeight: 'calc(100vh - 140px)', overflow: 'auto', position: 'sticky', top: 90 }}>
          <div style={{ display: 'flex', gap: 6, padding: '6px 6px 8px', flexWrap: 'wrap' }}>
            <input className="txt" value={q} onChange={e => setQ(e.target.value)} placeholder="Search id or name…" aria-label="Search members" style={{ flex: 1, minWidth: 140 }} />
            <select className="sel" value={tier} onChange={e => setTier(e.target.value)} aria-label="Tier"><option value="">All tiers</option>{[4, 3, 2, 1].map(t => <option key={t} value={t}>Tier {t}</option>)}</select>
            <select className="sel" value={scope ? `${scope.kind}:${scope.id}` : ''} onChange={e => setScope(e.target.value)} aria-label="Which members" style={{ maxWidth: '100%' }}><option value="">All members (longitudinal extract)</option><optgroup label="Cohorts">{(cohorts.data ? cohorts.data.cohorts : []).map(c => <option key={c.id} value={`cohort:${c.id}`}>{c.name} · {c.n}</option>)}</optgroup><optgroup label="Campaigns">{(campaigns.data ? campaigns.data.campaigns : []).map(c => <option key={c.id} value={`campaign:${c.id}`}>{c.name} · {c.status}</option>)}</optgroup></select>
          </div>
          {list.loading && <Loading what="Loading members" />}
          {list.error && <ErrorBox error={list.error} retry={list.reload} what="the member list" />}
          {list.data && !list.data.members.length && <Empty>No members match these filters.</Empty>}
          {list.data && <div className="xs mut" style={{ padding: '0 8px 4px' }}>{list.data.count} members{scope ? ` of ${scope.kind} ${scope.id}` : ''} · ordered safety/RED → tier → score</div>}
          {list.data && list.data.members.map(m => { const A = AL[m.alert_colour] || AL.GREEN; return <button key={m.member_id} className={'memrow' + (sel === m.member_id ? ' on' : '')} onClick={() => nav(`/intelligence/${m.member_id}`)}>
            <Avatar text={m.initials} size="md" soft />
            <span style={{ minWidth: 0 }}><span className="nm">{m.display_name}<span className="id">{m.member_id}</span>{m.consent_status === 'granted' && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)' }}>↩ consented</span>}</span><span className="rs">{m.current_needs || (m.triggers_fired ? `${m.triggers_fired} trigger(s) fired · not in a live campaign` : 'nothing fired')}</span><span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}><span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: (TIERC[m.tier] || TIERC[1])[0], color: (TIERC[m.tier] || TIERC[1])[1], whiteSpace: 'nowrap' }}>Tier {m.tier} · {TIERN[m.tier]}</span>{m.contact_priority && <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: A[1], color: A[2], whiteSpace: 'nowrap' }} title={SLA_TEXT[m.contact_priority]}>{m.contact_priority} · {m.alert_colour}{m.safety_flag ? ' · ⚑ safety' : ''}</span>}{m.control_group ? <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#EBF1F4', color: '#566A74', whiteSpace: 'nowrap' }} title="Control group: scored, not called">Control group</span> : null}</span></span>
            <span style={{ textAlign: 'right' }}><span className="R">{m.total_risk_score}</span><span className="tier">R / 23</span></span>
          </button>; })}
        </section>
        <section className="col" style={{ flex: '1 1 560px' }}>{sel ? <MemberPanel id={sel} runDate={k ? k.run_date : null} /> : <Card><Empty>Select a member.</Empty></Card>}</section>
      </div>}
    </div>
  );
}

function MemberPanel({ id, runDate }) {
  const m = useApi(`/members/${id}`); const risk = useApi(`/members/${id}/risk`); const ev = useApi(`/members/${id}/evaluations`); const cp = useApi(`/members/${id}/care-plan`); const acts = useApi(`/members/${id}/actions`);
  const [drawer, setDrawer] = useState(false); const [showRules, setShowRules] = useState(false);
  const nav = useNavigate();
  if (m.loading) return <Loading what="Loading the member" />;
  if (m.error) return <ErrorBox error={m.error} retry={m.reload} what={`member ${id}`} />;
  const d = m.data; const idn = d.identity || {}; const r = risk.data; const al = r && r.alert;
  const fired = (ev.data || []).filter(e => e.evaluation_result === 'fired');
  const A = al ? (AL[al.alert_colour] || AL.GREEN) : null; const T = r ? TIERC[r.tier] : null;
  const top = cp.data && cp.data.current && cp.data.current[0];
  const nurse = d.assignment ? d.assignment.nurse_name : null;
  const conds = [idn.cohort_t2d_l12m ? 'Type 2 diabetes' : null, idn.cohort_htn_l12m ? 'Hypertension' : null].filter(Boolean).join(', ');
  return <>
    <Card style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', padding: '22px 24px' }}>
      <Avatar text={idn.initials} size="lg" />
      <div style={{ flex: 1, minWidth: 220 }}><div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.01em' }}>{idn.display_name} <span className="sm mut mono" title="Masked member id; the name is a pseudonym generated for the demo">{id} · pseudonym</span></div><div className="sm" style={{ color: 'var(--ink2)', marginTop: 2 }}>{id} · {idn.age} · {idn.gender === 'F' ? 'female' : 'male'} · {conds || idn.pathway} · {idn.policy_type} plan · speaks {idn.language} · consent <b>{d.consent_status}</b>{nurse ? ` · nurse ${nurse}` : ''}{d.worklist ? ` · list: ${d.worklist.list_status}` : ''}</div></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {r && <span className="chip" style={{ fontSize: 13, padding: '5px 12px', background: T[0], color: T[1] }} title={r.tier_rule ? `${r.tier_rule.campaign_does} · cadence ${r.tier_rule.cadence}` : ''}>Tier {r.tier} · {TIERN[r.tier]} risk · R {r.total_risk_score}/23</span>}
        {al && <span className="chip" style={{ fontSize: 13, padding: '5px 12px', background: A[1], color: A[2] }} title={al.reasons}>{al.alert_colour} · {A[0]}</span>}
        {al && <span className="chip" style={{ fontSize: 13, padding: '5px 12px', background: '#0B2E57', color: '#FFFFFF' }} title="Contact priority (rulebook §4)">{SLA_TEXT[al.contact_priority]}</span>}
        {r && r.safety_flag ? <span className="chip RED" style={{ fontSize: 13, padding: '5px 12px' }}>⚑ Priority clinical review</span> : null}
      </div>
    </Card>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span className="sect-t">Risk score</span>{r && <span><b style={{ fontSize: 32, fontWeight: 700 }}>{r.total_risk_score}</b><span className="mut" style={{ fontSize: 14 }}> / 23</span></span>}</div>
        {risk.loading ? <Loading /> : risk.error ? <ErrorBox error={risk.error} /> : <>
          <div className="col" style={{ gap: 10, marginTop: 12 }}>{r.components.map(c => <div key={c.component} style={{ display: 'grid', gridTemplateColumns: '104px minmax(0,1fr) 28px', gap: 10, alignItems: 'center', fontSize: 14 }} title={c.rules.map(x => x.clinical_evidence).join('\n') || 'no points'}><span style={{ color: 'var(--ink2)' }}>{c.name === 'Utilisation' ? 'Hospital use' : c.name === 'Age/sex' ? 'Age and sex' : c.name}</span><Bar value={c.score} max={c.cap} /><b style={{ textAlign: 'right' }}>{c.score}</b></div>)}</div>
          <div className="sm mut" style={{ marginTop: 12 }}>{r.kidney_provisional ? 'Kidney is provisional: no eGFR or UACR on record.' : 'All five factors are from the longitudinal extract.'} Tier {r.tier} ({r.tier_rule.r_min}–{r.tier_rule.r_max}) · Excel reference {r.extract_total_risk_score}{r.matches_extract ? ' ✓' : ' ✗'}</div>
          <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setDrawer(true)}>Why this score →</button>
        </>}
      </Card>
      <Card className="col" style={{ gap: 10 }}>
        <span className="sect-t">Why now</span>
        {ev.loading ? <Loading /> : ev.error ? <ErrorBox error={ev.error} /> : fired.length ? <div style={{ background: '#FDE7E7', borderRadius: 12, padding: '14px 16px' }}><div style={{ fontSize: 16, fontWeight: 700, color: '#E5484D' }}>{fired[0].trigger_name} <span className="sm mono" style={{ fontWeight: 600 }}>{fired[0].rule_id}</span></div><div className="sm" style={{ color: 'var(--ink2)', marginTop: 4 }}>{fired[0].clinical_evidence}</div><div className="sm mut" style={{ marginTop: 4 }}>{fired.length > 1 ? `+ ${fired.length - 1} more fired: ${fired.slice(1).map(f => f.trigger_name).join(', ')}` : 'the only trigger that fired'}</div></div> : <div style={{ background: '#DFF3EA', borderRadius: 12, padding: '14px 16px' }}><div style={{ fontSize: 16, fontWeight: 700, color: '#13704B' }}>Nothing fired</div><div className="sm" style={{ color: 'var(--ink2)' }}>At target on every rulebook trigger; routine cadence.</div></div>}
        {al && <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '14px 16px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}><span className="sm" style={{ fontWeight: 700, color: 'var(--ink2)' }}>Alert and contact priority</span><span className="sm" style={{ fontWeight: 700, color: A[2] }}>{al.alert_colour} · {al.contact_priority}</span></div><div style={{ fontSize: 14, marginTop: 4 }}>{SLA_TEXT[al.contact_priority]}</div><div className="sm mut" style={{ marginTop: 4 }}>{al.reasons}</div></div>}
        <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowRules(s => !s)}>{showRules ? 'Hide the 14 rules' : 'All 14 rulebook triggers →'}</button>
      </Card>
    </div>
    {showRules && <Section title="Rulebook · 14 triggers in class order" aside={ev.data ? `${fired.length} fired · ${ev.data.filter(e => e.evaluation_result === 'cannot_tell').length} cannot tell` : ''}>
      {ev.loading ? <Loading /> : ev.error ? <ErrorBox error={ev.error} /> : <div style={{ overflowX: 'auto' }}><table className="tbl"><thead><tr><th>Rule</th><th>Class</th><th>Result</th><th>Evidence (longitudinal values)</th><th>Fires when</th><th>Next best action</th><th>Need</th></tr></thead><tbody>
        {ev.data.map(e => <tr key={e.rule_id} className={e.evaluation_result === 'not_fired' ? 'dim' : ''}><td><b>{e.trigger_name}</b><div className="xs mut mono">{e.rule_id} · {e.pathway}</div></td><td><Chip kind={e.need_class}>{e.class_label}</Chip></td><td><Chip kind={e.evaluation_result}>{e.evaluation_result.replace('_', ' ')}</Chip></td><td className="evi" title={e.evaluation_logic}>{e.clinical_evidence || Object.entries(e.input_values || {}).map(([k, v]) => `${k} = ${v === null ? 'none' : v}`).join('; ')}</td><td className="sm" style={{ color: 'var(--ink2)' }}>{e.fires_when_rulebook}</td><td className="sm">{e.evaluation_result === 'fired' ? <><b>{e.next_best_action}</b><div className="xs mut">{e.action_owner} · done when: {e.done_when}</div></> : <span className="mut">{e.next_best_action}</span>}</td><td>{e.need ? <><Chip kind={e.need.slot}>{e.need.slot}</Chip><div className="xs mut">{e.need.gap_state} · due {dateShort(e.need.due_date)}</div></> : <span className="xs mut">—</span>}</td></tr>)}
      </tbody></table></div>}
    </Section>}
    <CarePlanCard cp={cp} risk={r} runDate={runDate} />
    <div className="card dark" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <span className="avatar md" style={{ background: 'var(--tealS)', color: 'var(--teal)' }}>{nurse ? nurse.split(' ').map(w => w[0]).join('').slice(0, 2) : 'NR'}</span>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 13, color: '#C9D6DC' }}>Next best action</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{top ? top.next_best_action : 'No open needs'}</div>
        <div style={{ fontSize: 13.5, color: '#C9D6DC', marginTop: 2 }}>{nurse || 'Not yet assigned'}{idn.language ? ` · speaks ${idn.language}` : ''}{d.worklist && d.worklist.due_by ? ` · call due ${dateShort(d.worklist.due_by)}` : ''}{al ? ` · ${al.contact_priority}` : ''}</div>
      </div>
      <button className="btn light" onClick={() => nav(`/portal/${id}`)}>{d.worklist ? 'Open in care portal →' : 'Show in the care portal →'}</button>
    </div>
    <details className="card" style={{ padding: '14px 22px' }}><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Actions and follow-ups <span className="sm mut" style={{ fontWeight: 400 }}>· engine → nurse outcome → follow-up chain{acts.data ? ` · ${acts.data.length}` : ''}</span></summary>
      {acts.loading ? <Loading /> : acts.error ? <ErrorBox error={acts.error} /> : !acts.data.length ? <Empty>No actions yet.</Empty> : <div style={{ overflowX: 'auto', marginTop: 10 }}><table className="tbl"><thead><tr><th>Due</th><th>Kind</th><th>Action</th><th>Owner / assignee</th><th>Status</th><th>Came from</th></tr></thead><tbody>{acts.data.map(a => <tr key={a.action_id} className={a.status === 'open' ? '' : 'dim'}><td>{dateShort(a.due_date)}</td><td><Chip>{a.kind}</Chip></td><td>{a.title}{a.attempt > 1 ? ` · attempt ${a.attempt}` : ''}</td><td className="sm">{a.owner_role || ''}{a.assignee_name ? ` · ${a.assignee_name}` : ''}</td><td><Chip kind={a.status === 'open' ? 'NEXT' : a.status === 'done' ? 'CLOSED' : ''}>{a.status}</Chip></td><td className="sm mut">{a.came_from ? `${a.came_from} → ${a.because_outcome || ''}` : a.source}</td></tr>)}</tbody></table></div>}
    </details>
    {drawer && <Lineage id={id} risk={r} evals={ev.data || []} onClose={() => setDrawer(false)} />}
  </>;
}

function Lineage({ id, risk, evals, onClose }) {
  const lon = useApi(`/members/${id}/longitudinal`);
  const rows = useMemo(() => {
    const out = [];
    (risk ? risk.components : []).forEach(c => c.rules.forEach(x => Object.entries(x.input_values).forEach(([col, v]) => out.push({ col, v, rule: x.rule_id, cond: x.evaluation_logic, result: `${x.points_awarded} point(s) → ${c.component}`, nba: '' }))));
    evals.filter(e => e.evaluation_result !== 'not_fired').forEach(e => Object.entries(e.input_values || {}).forEach(([col, v]) => out.push({ col, v, rule: e.rule_id, cond: e.evaluation_logic, result: e.evaluation_result, nba: e.evaluation_result === 'fired' ? `${e.next_best_action} (${e.action_owner})` : '' })));
    return out;
  }, [risk, evals]);
  const field = col => (lon.data ? lon.data.fields.find(f => f.field === col) : null);
  return <><div className="backdrop" onClick={onClose} /><div className="drawer" role="dialog" aria-label="Why this score">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}><div><div className="eyebrow">Lineage · {id}</div><h2 style={{ margin: '4px 0 0', fontSize: 22 }}>Why this score and these triggers</h2><p className="sm mut" style={{ margin: '6px 0 0' }}>Longitudinal column → member value → rule id → condition → result → next best action. Source: 250_members_longitudinal_data.xlsx (member_longitudinal) · rules: data/seed/rules/*.csv · evaluation: member_rule_evaluation, run {risk ? risk.run_id : ''}.</p></div><button className="btn ghost sm" onClick={onClose}>Close</button></div>
    {risk && <div style={{ marginTop: 16 }}><KV items={[['R = C+M+K+U+A', `${risk.clinical_score} + ${risk.comorbidity_score} + ${risk.kidney_score} + ${risk.utilisation_score} + ${risk.age_sex_score} = ${risk.total_risk_score}`], ['Tier', `${risk.tier} · ${risk.tier_label} (${risk.tier_rule.r_min}–${risk.tier_rule.r_max})`], ['Excel reference', `${risk.extract_total_risk_score} · ${risk.extract_risk_tier} (Total_risk_Score, Risk_tier)`], ['Rule version', risk.rule_version], ['Evaluated at', dateTime(risk.evaluated_at)]]} /></div>}
    <div style={{ overflowX: 'auto', marginTop: 16 }}><table className="tbl"><thead><tr><th>Longitudinal column</th><th>Member value</th><th>Rule</th><th>Condition</th><th>Result</th><th>Next best action</th></tr></thead><tbody>
      {rows.map((r, i) => { const f = field(r.col); return <tr key={i}><td><span className="mono sm">{r.col}</span>{f && <div className="xs mut">{f.field_group} · {f.type}</div>}</td><td className="mono sm">{r.v === null || r.v === undefined ? 'none' : String(r.v)}</td><td className="mono sm">{r.rule}</td><td className="sm" style={{ color: 'var(--ink2)', maxWidth: 320 }}>{r.cond}</td><td><Chip kind={r.result.includes('fired') || r.result === 'cannot_tell' ? r.result : 'scored'}>{r.result}</Chip></td><td className="sm">{r.nba}</td></tr>; })}
      {!rows.length && <tr><td colSpan={6} className="mut">No scoring rule or trigger matched for this member.</td></tr>}
    </tbody></table></div>
    <details style={{ marginTop: 16 }}><summary style={{ cursor: 'pointer', fontWeight: 600 }}>All {lon.data ? lon.data.columns : 377} longitudinal values</summary>{lon.loading ? <Loading /> : lon.error ? <ErrorBox error={lon.error} /> : <div style={{ maxHeight: 400, overflow: 'auto', marginTop: 8 }}><table className="tbl">{lon.data.fields.map(f => <tbody key={f.field}><tr><td className="mono sm">{f.field}</td><td className="mono sm">{lon.data.values[f.field] === null ? <span className="mut">NULL</span> : String(lon.data.values[f.field])}</td><td className="xs mut">{f.description}</td></tr></tbody>)}</table></div>}</details>
  </div></>;
}

function Programme() {
  const p = useApi('/intelligence/programme');
  if (p.loading) return <Loading what="Loading the programme view" />;
  if (p.error) return <ErrorBox error={p.error} retry={p.reload} what="the programme view" />;
  return <Card style={{ overflowX: 'auto' }}><table className="tbl"><thead><tr><th>Trigger</th><th>Class</th><th>Pathway</th><th>Fired</th><th>Cannot tell</th><th>Not fired</th><th>Open needs</th><th>In CURRENT</th><th>Reported</th><th>Closed in claims</th><th>Declined</th><th>Next best action</th></tr></thead><tbody>
    {p.data.map(t => <tr key={t.trigger_code}><td><b>{t.name}</b><div className="xs mut mono">{t.trigger_code}</div></td><td><Chip kind={t.class}>{t.class_label}</Chip></td><td className="sm">{t.pathway}</td><td><b>{t.fired}</b><Bar value={t.fired} max={t.evaluated} thin /></td><td>{t.cannot_tell}</td><td className="mut">{t.not_fired}</td><td>{t.open_needs}</td><td>{t.in_current}</td><td>{t.reported}</td><td>{t.closed_in_claims}</td><td>{t.declined}</td><td className="sm">{t.next_best_action}<div className="xs mut">{t.owner_role} · {t.done_when}</div></td></tr>)}
  </tbody></table></Card>;
}
function Runs() {
  const r = useApi('/intelligence/runs');
  if (r.loading) return <Loading what="Loading runs" />;
  if (r.error) return <ErrorBox error={r.error} retry={r.reload} what="run history" />;
  if (!r.data.length) return <Card><Empty>No run yet. Use “Run rules now”.</Empty></Card>;
  return <Card style={{ overflowX: 'auto' }}><table className="tbl"><thead><tr><th>Run</th><th>Started</th><th>By</th><th>Rule set</th><th>Variant</th><th>Members</th><th>Fired</th><th>Cannot tell</th><th>New needs</th><th>Closed in claims</th><th>New actions</th><th>Matches Excel</th></tr></thead><tbody>
    {r.data.map(x => <tr key={x.run_id}><td><b>#{x.run_id}</b></td><td>{dateTime(x.started_at)}</td><td>{x.triggered_by}</td><td className="mono sm">{x.rule_version}</td><td>{x.trigger_variant}</td><td>{x.members_evaluated}</td><td>{x.stats.fired}</td><td>{x.stats.cannot_tell}</td><td>{x.stats.needs_opened}</td><td>{x.stats.needs_closed_in_claims}</td><td>{x.stats.actions}</td><td>{x.stats.matches_extract}/{x.members_evaluated}</td></tr>)}
  </tbody></table></Card>;
}
