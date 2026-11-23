import React, { useState } from 'react';
import { useApi, useUser } from '../hooks.js';
import { Loading, ErrorBox, Tile, BarRow } from '../components/Bits.jsx';
import { KIND_LABEL, CLASS_LABEL, first } from '../util.js';

/** Shift analytics (design: four tiles + "Tasks by type"), then programme panels. GET /portal/analytics, /intelligence/kpis, /intelligence/programme. */
export default function Analytics() {
  const { user } = useUser();
  const [mine, setMine] = useState(true);
  const a = useApi(`/portal/analytics${mine ? `?nurse_id=${user.user_id}` : ''}`, [mine]);
  const k = useApi('/intelligence/kpis');
  const p = useApi('/intelligence/programme');
  if ((a.loading && !a.data) || (k.loading && !k.data)) return <div className="pg"><Loading what="Loading analytics" /></div>;
  if (a.error) return <div className="pg"><ErrorBox error={a.error} retry={a.reload} /></div>;
  if (k.error) return <div className="pg"><ErrorBox error={k.error} retry={k.reload} /></div>;
  const A = a.data, K = k.data, P = p.data || [];
  const oc = o => (A.outcomes.find(x => x.outcome === o) || {}).n || 0, saved = A.outcomes.reduce((s, o) => s + o.n, 0);
  const kinds = Object.entries(A.tasks_by_kind.reduce((acc, x) => { (acc[x.task_kind] = acc[x.task_kind] || {})[x.status] = (acc[x.task_kind][x.status] || 0) + x.n; return acc; }, {})).map(([kind, st]) => { const n = Object.values(st).reduce((s, v) => s + v, 0); return { kind, n, d: n - (st.open || 0) }; });
  const funnel = [['Members evaluated', K.evaluated], ['Care plans', K.care_plans], ['On today’s lists', K.on_todays_list], ['Calls made', A.calls_made], ['Reached', A.reached], ['Consent granted', A.consents], ['Actions agreed', oc('agreed')], ['Reported (awaiting claims)', K.reported_not_in_claims], ['Closed in claims', K.closed_in_claims]];
  const mxT = Math.max(...P.map(x => x.fired || 0), 1), mxG = Math.max(...A.gaps.map(g => g.n), 1);
  return <div className="pg">
    <div className="pgh"><h1>Shift analytics</h1><span className="small muted">{mine ? `${user.name} · ${user.role}` : 'All coordinators'} · run {K.run_id} · {K.run_date} · rules {K.rule_version}</span>
      <div className="chips" style={{ marginLeft: 'auto' }}><button className="chip lg" aria-pressed={mine} onClick={() => setMine(true)}>My shift · {first(user.name)}</button><button className="chip lg" aria-pressed={!mine} onClick={() => setMine(false)}>Care team</button></div></div>
    <div className="ktiles"><Tile k n={A.calls_made} label="Calls today" cls="info" /><Tile k n={A.reached} label={`Reached · ${A.calls_made ? Math.round(A.reached / A.calls_made * 100) : 0}%`} cls="ok" /><Tile k n={A.consents} label={`Consented · ${A.reached ? Math.round(A.consents / A.reached * 100) : 0}% of reached`} cls="warn" /><Tile k n={saved} label={`Outcomes saved · ${oc('agreed')} agreed`} cls="neu" /></div>
    <div className="panel"><div className="ph"><h2>Tasks by type</h2><span className="small muted">{A.tasks_done} done · {A.tasks_open} open</span></div>
      {kinds.length ? kinds.map(x => <BarRow key={x.kind} label={KIND_LABEL[x.kind] || x.kind} v={x.d} max={x.n} right={`${x.d} of ${x.n} done`} />) : <p className="muted small" style={{ margin: 0 }}>No tasks yet.</p>}</div>
    <div className="g2" style={{ marginTop: 16 }}>
      <div className="panel"><div className="ph"><h2>Engagement funnel</h2><span className="small muted">care intelligence run → calls → consent → outcomes</span></div>{funnel.map(([l, v]) => <BarRow key={l} label={l} v={v || 0} max={K.evaluated} cols="200px minmax(0,1fr) 60px" />)}</div>
      <div className="panel"><div className="ph"><h2>Trigger mix</h2><span className="small muted">fired in the latest run</span></div>{P.map(t => <BarRow key={t.trigger_code} label={`${t.trigger_code} ${t.name}`} v={t.fired || 0} max={mxT} color="var(--info)" cols="200px minmax(0,1fr) 60px" />)}</div>
      <div className="panel"><div className="ph"><h2>Care-gap states</h2><span className="small muted">only claims close a gap</span></div>{['Potential', 'Verified', 'Scheduled', 'Reported', 'Closed'].map(s => <BarRow key={s} label={s} v={(A.gaps.find(g => g.gap_state === s) || {}).n || 0} max={mxG} color={s === 'Closed' ? 'var(--success)' : s === 'Reported' ? 'var(--warning)' : 'var(--accent)'} cols="140px minmax(0,1fr) 60px" />)}
        <div className="lbl2" style={{ margin: '14px 0 4px' }}>Outcomes recorded</div>{A.outcomes.length ? A.outcomes.map(o => <BarRow key={o.outcome} label={o.outcome} v={o.n} max={Math.max(...A.outcomes.map(x => x.n), 1)} color="var(--risk-high)" cols="140px minmax(0,1fr) 60px" />) : <span className="muted small">None yet.</span>}</div>
      <div className="panel"><div className="ph"><h2>Programme</h2><span className="small muted">latest run</span></div>
        <div className="tiles" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}><Tile n={K.members} label="Members in programme" cls="neu" /><Tile n={(A.worklist.find(w => w.list_status === 'today') || {}).n || 0} label="Awaiting a call today" cls="warn" /><Tile n={K.triggers_fired} label={`Triggers fired · ${K.cannot_tell} cannot tell`} cls="info" /><Tile n={K.current_without_action} label="CURRENT needs without an action (must be 0)" cls={K.current_without_action ? 'crit' : 'ok'} /></div></div>
    </div>
    <div className="panel" style={{ marginTop: 16 }}><div className="ph"><h2>Care team</h2><span className="small muted">worklist · tasks · calls</span></div><div className="tblwrap"><table className="tbl"><thead><tr><th>Coordinator</th><th>Role</th><th>Capacity / day</th><th>Today</th><th>Queued</th><th>Open tasks</th><th>Calls made</th></tr></thead><tbody>{A.per_nurse.map(n => <tr key={n.user_id}><td><b style={{ fontWeight: 600 }}>{n.name}</b></td><td>{n.role}</td><td className="num">{n.daily_capacity}</td><td className="num">{n.today}</td><td className="num">{n.queued}</td><td className="num">{n.open_tasks}</td><td className="num">{n.calls}</td></tr>)}</tbody></table></div></div>
    <div className="panel" style={{ marginTop: 16 }}><div className="ph"><h2>Programme by trigger</h2><span className="small muted">rule trigger · evaluations · care needs</span></div><div className="tblwrap"><table className="tbl"><thead><tr><th>Trigger</th><th>Class</th><th>Fired</th><th>Cannot tell</th><th>Open needs</th><th>In CURRENT</th><th>Reported</th><th>Closed in claims</th><th>Declined</th><th>Next best action</th></tr></thead><tbody>{P.map(t => <tr key={t.trigger_code}><td><b className="mono">{t.trigger_code}</b> {t.name}</td><td>{CLASS_LABEL[t.class]}</td><td className="num">{t.fired}</td><td className="num">{t.cannot_tell}</td><td className="num">{t.open_needs}</td><td className="num">{t.in_current}</td><td className="num">{t.reported}</td><td className="num">{t.closed_in_claims}</td><td className="num">{t.declined}</td><td>{t.next_best_action}<small>{t.owner_role}</small></td></tr>)}</tbody></table></div></div>
  </div>;
}
