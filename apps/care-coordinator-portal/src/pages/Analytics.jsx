import React, { useState } from 'react';
import { useApi, useUser } from '../hooks.js';
import { Loading, ErrorBox, Tile, Bar } from '../components/Bits.jsx';
import { KIND_LABEL, CLASS_LABEL } from '../util.js';

/** Shift analytics (portal/analytics) and programme KPIs (intelligence/kpis, intelligence/programme). */
export default function Analytics() {
  const { user } = useUser();
  const [mine, setMine] = useState(false);
  const a = useApi(`/portal/analytics${mine ? `?nurse_id=${user.user_id}` : ''}`, [mine]);
  const k = useApi('/intelligence/kpis');
  const p = useApi('/intelligence/programme');
  if ((a.loading && !a.data) || (k.loading && !k.data)) return <Loading what="Loading analytics" />;
  if (a.error) return <ErrorBox error={a.error} retry={a.reload} />;
  if (k.error) return <ErrorBox error={k.error} retry={k.reload} />;
  const A = a.data, K = k.data, P = p.data || [];
  const funnel = [['Members evaluated', K.evaluated], ['Care plans', K.care_plans], ['On today’s lists', K.on_todays_list], ['Calls made', A.calls_made], ['Reached', A.reached], ['Consent granted', A.consents], ['Actions agreed', (A.outcomes.find(o => o.outcome === 'agreed') || {}).n || 0], ['Reported (awaiting claims)', K.reported_not_in_claims], ['Closed in claims', K.closed_in_claims]];
  const wl = Object.fromEntries(A.worklist.map(w => [w.list_status, w.n]));
  return <div className="scroll pad"><div className="pg-in">
    <div className="act-bar"><span className="muted" style={{ fontSize: 12 }}>Run {K.run_id} · {K.run_date} · rule version {K.rule_version}</span><label className="chip-ck" style={{ marginLeft: 'auto' }}><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> Only my shift</label></div>
    <div className="tiles"><Tile n={K.members} label="Members in programme" /><Tile n={wl.today || 0} label="Awaiting a call today" cls="high" /><Tile n={A.calls_made ? Math.round(A.reached / A.calls_made * 100) + '%' : '—'} label={`Reached rate · ${A.reached} of ${A.calls_made} calls`} cls="ok" /><Tile n={K.triggers_fired} label={`Triggers fired · ${K.cannot_tell} cannot tell`} cls="acc" /><Tile n={K.current_without_action} label="CURRENT needs without an action (must be 0)" cls={K.current_without_action ? 'crit' : 'ok'} /></div>
    <div className="grid2">
      <section className="card"><div className="card-h"><h3>Engagement funnel</h3><span className="r">intelligence_run · contact_attempt · consent_event · disposition_event</span></div><div className="card-b">{funnel.map(([l, v]) => <Bar key={l} label={l} v={v || 0} max={K.evaluated} />)}</div></section>
      <section className="card"><div className="card-h"><h3>Trigger mix · fired in the latest run</h3><span className="r">member_rule_evaluation</span></div><div className="card-b">{P.map(t => <Bar key={t.trigger_code} label={`${t.trigger_code} ${t.name}`} v={t.fired || 0} max={Math.max(...P.map(x => x.fired || 0), 1)} color="var(--info)" />)}</div></section>
    </div>
    <div className="grid2">
      <section className="card"><div className="card-h"><h3>Tasks</h3><span className="r">task</span></div><div className="card-b">{Object.entries(A.tasks_by_kind.reduce((acc, x) => { (acc[x.task_kind] = acc[x.task_kind] || {})[x.status] = x.n; return acc; }, {})).map(([kind, st]) => <div key={kind} className="frow" style={{ gridTemplateColumns: '120px 1fr 90px' }}><span>{KIND_LABEL[kind] || kind}</span><span className="hbar"><i style={{ width: Math.round(((st.done || 0) / ((st.open || 0) + (st.done || 0) || 1)) * 100) + '%', background: 'var(--ok)' }} /></span><span className="v">{st.done || 0} / {(st.open || 0) + (st.done || 0)}</span></div>)}
        <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>{A.tasks_done} done · {A.tasks_open} open{mine ? ' · your tasks' : ' · all coordinators'}</p></div></section>
      <section className="card"><div className="card-h"><h3>Care-gap states</h3><span className="r">care_need.gap_state</span></div><div className="card-b">{['Potential', 'Verified', 'Scheduled', 'Reported', 'Closed'].map(s => <Bar key={s} label={s} v={(A.gaps.find(g => g.gap_state === s) || {}).n || 0} max={Math.max(...A.gaps.map(g => g.n), 1)} color={s === 'Closed' ? 'var(--ok)' : s === 'Reported' ? 'var(--mod)' : 'var(--accent)'} />)}
        <div className="eyebrow" style={{ margin: '12px 0 6px' }}>Outcomes recorded</div>{A.outcomes.length ? A.outcomes.map(o => <Bar key={o.outcome} label={o.outcome} v={o.n} max={Math.max(...A.outcomes.map(x => x.n), 1)} color="var(--high)" />) : <span className="muted" style={{ fontSize: 12 }}>None yet.</span>}</div></section>
    </div>
    <section className="card"><div className="card-h"><h3>Care team</h3><span className="r">worklist · task · contact_attempt</span></div><div className="card-b tblwrap"><table className="tbl"><thead><tr><th>Coordinator</th><th>Role</th><th>Capacity / day</th><th>Today</th><th>Queued</th><th>Open tasks</th><th>Calls made</th></tr></thead><tbody>{A.per_nurse.map(n => <tr key={n.user_id}><td><b>{n.name}</b></td><td>{n.role}</td><td className="num">{n.daily_capacity}</td><td className="num">{n.today}</td><td className="num">{n.queued}</td><td className="num">{n.open_tasks}</td><td className="num">{n.calls}</td></tr>)}</tbody></table></div></section>
    <section className="card"><div className="card-h"><h3>Programme by trigger</h3><span className="r">rule_trigger ⋈ member_rule_evaluation ⋈ care_need</span></div><div className="card-b tblwrap"><table className="tbl"><thead><tr><th>Trigger</th><th>Class</th><th>Fired</th><th>Cannot tell</th><th>Open needs</th><th>In CURRENT</th><th>Reported</th><th>Closed in claims</th><th>Declined</th><th>Next best action</th></tr></thead><tbody>{P.map(t => <tr key={t.trigger_code}><td><b className="mono">{t.trigger_code}</b> {t.name}</td><td>{CLASS_LABEL[t.class]}</td><td className="num">{t.fired}</td><td className="num">{t.cannot_tell}</td><td className="num">{t.open_needs}</td><td className="num">{t.in_current}</td><td className="num">{t.reported}</td><td className="num">{t.closed_in_claims}</td><td className="num">{t.declined}</td><td>{t.next_best_action} · {t.owner_role}</td></tr>)}</tbody></table></div></section>
  </div></div>;
}
