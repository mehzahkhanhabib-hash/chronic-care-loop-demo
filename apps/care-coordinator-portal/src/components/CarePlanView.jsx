import React, { useState } from 'react';
import { api } from '../api.js';
import { useApi, useUser, useToast, useApp } from '../hooks.js';
import { Loading, ErrorBox, LockBox, Tag, Tile, AlertTag, Source } from './Bits.jsx';
import Icon from '../icons.jsx';
import { CLASS_LABEL, CLASS_TAG, GAP_STATES, GAP_TAG, addDays, relDay, fmtDay, fmtDM, pathwayLabel } from '../util.js';

const LAST = { agreed: ['t-ok', 'Agreed'], done: ['t-acc', 'Done · reported'], declined: ['t-neu', 'Declined'], carried: ['t-info', 'Follow-up needed'] };
/**
 * Care Gaps tab and Care plans detail (design: four tiles + "Open care gaps" table), followed by the care-plan board
 * (CURRENT / NEXT / FUTURE board first, as on the Studio's care intelligence screen, then tiles, open care gaps, risk, cadence, gap lifecycle, write-backs). Gated by consent (G2).
 * Reads /members/:id/care-plan, /risk, /tasks, /appointments · writes POST /portal/outcomes, /portal/appointments.
 */
export default function CarePlanView({ memberId, consent, plan: planProp, onChanged, children }) {
  const { user } = useUser(); const say = useToast(); const { today } = useApp();
  const ok = consent === 'granted';
  const own = useApi(ok && !planProp ? `/members/${memberId}/care-plan` : null, [ok]);
  const plan = planProp || own;
  const risk = useApi(ok ? `/members/${memberId}/risk` : null, [ok]);
  const tasks = useApi(ok ? `/members/${memberId}/tasks` : null, [ok]);
  const appts = useApi(ok ? `/members/${memberId}/appointments` : null, [ok]);
  const [busy, setBusy] = useState(false); const [bookFor, setBookFor] = useState(null); const [bookDate, setBookDate] = useState('');
  if (!ok) return <LockBox title="Care gaps and the care plan are unlocked only when the member gives consent" sub={consent === 'declined' || consent === 'withdrawn' ? 'The member declined consent · nothing is rendered (rulebook G2)' : undefined}>{children}</LockBox>;
  if (plan.loading && !plan.data) return <Loading what="Loading care plan" />;
  if (plan.error) return <ErrorBox error={plan.error} retry={plan.reload} />;
  if (!plan.data) return <Loading what="Loading care plan" />;
  const P = plan.data, r = risk.data || {}, al = r.alert || {};
  const refresh = () => { plan.reload(); tasks.reload(); appts.reload(); onChanged && onChanged(); };
  const run = async (fn, msg) => { setBusy(true); try { await fn(); say(msg); refresh(); } catch (e) { say('Not saved: ' + e.message); } finally { setBusy(false); } };
  const wb = (n, o) => run(() => api.post('/portal/outcomes', { need_id: n.need_id, action_id: n.action && n.action.status === 'open' ? n.action.action_id : undefined, outcome: o, nurse_id: user.user_id }), { done: 'Done · gap Reported, verify in claims', declined: 'Declined · held 90 days, next need promoted', agreed: 'Agreed · follow-up created', carried: 'Carried · stays CURRENT' }[o]);
  const book = n => run(() => api.post('/portal/appointments', { member_id: memberId, need_id: n.need_id, action_id: n.action && n.action.action_id, appointment_type: n.trigger_code, scheduled_date: bookDate, nurse_id: user.user_id }).then(() => { setBookFor(null); setBookDate(''); }), 'Booked · gap Scheduled');

  // design table: one row per care need
  const A = appts.data || [], T = tasks.data || [];
  const rows = P.needs.map(n => {
    const o = n.last_outcome && n.last_outcome.outcome, ap = A.filter(a => a.need_id === n.need_id), tk = T.filter(t => t.need_id === n.need_id && t.status === 'open');
    const last = LAST[o] || (n.gap_state === 'Verified' ? ['t-info', 'Confirmed'] : ['t-neu', 'Not spoken about']);
    const key = n.status === 'declined' ? 'closed' : n.status === 'done' ? 'rep' : n.gap_state === 'Scheduled' || ap.length ? 'sched' : n.slot === 'CURRENT' && (o || n.gap_state === 'Verified') ? 'not' : 'raise';
    const scheduling = { closed: ['t-neu', 'Closed for now'], rep: ['t-acc', 'Reported · verify in claims'], sched: ['t-ok', 'Scheduled'], not: ['t-info', 'Not scheduled'], raise: ['t-warn', n.slot === 'CURRENT' ? 'Raise on this call' : 'Raise on next follow-up call'] }[key];
    const planned = [...ap.map(a => `${a.appointment_type} · ${fmtDM(a.scheduled_date)}${a.scheduled_time ? ' · ' + a.scheduled_time : ''}`), ...tk.map(t => `${t.title} · ${fmtDay(t.due_date)}${t.booking_date ? '' : t.task_kind === 'nba' ? ' · not booked' : ''}`)];
    return { n, last, scheduling, planned, key };
  });
  const c = k => rows.filter(x => x.key === k).length;

  const bar = (k, v, mx) => <div className="rk" key={k}><span>{k}</span><i><b style={{ width: ((v || 0) / mx * 100) + '%' }} /></i><em>{v}</em></div>;
  const need = (n, act) => { const cur = n.slot === 'CURRENT'; const a = n.action;
    return <div className="nd" key={n.need_id}>
    <div className="nd-h"><Tag cls={CLASS_TAG[n.need_class]}>{n.class_label || CLASS_LABEL[n.need_class]}</Tag><span className="small muted mono">{relDay(n.due_date, today)}</span></div>
    <b>{n.next_best_action}</b>
    <div className="nd-m"><span title="Owner"><Icon name="user" />{n.action_owner}</span><span title="Done when"><Icon name="tick" />{n.done_when}</span><span className="mono" title={n.evidence}>{n.trigger_code} · {n.need}</span></div>
    <div className="nd-l"><span>{cur ? (a ? `↳ ${a.kind === 'follow_up' ? a.title : 'Action · for the nurse'}${a.due_date ? ' · due ' + fmtDay(a.due_date) : ''}` : '↳ Action · for the nurse') : 'Becomes an action when it reaches Current'}</span><b>{cur ? (['Scheduled', 'Verified'].includes(n.gap_state) ? n.gap_state : 'Current') : n.slot === 'NEXT' ? 'Next' : 'Future'}</b></div>
    {act && n.status === 'open' ? <div className="row" style={{ gap: 6 }}><button className="btn btn-pri btn-xs" onClick={() => wb(n, 'done')} disabled={busy}>Done</button><button className="btn btn-line btn-xs" onClick={() => wb(n, 'agreed')} disabled={busy}>Agreed</button><button className="btn btn-sec btn-xs" onClick={() => wb(n, 'declined')} disabled={busy}>Declined</button><button className="btn btn-ghost btn-xs" onClick={() => wb(n, 'carried')} disabled={busy}>Carry</button><button className="btn btn-ghost btn-xs" onClick={() => setBookFor(bookFor === n.need_id ? null : n.need_id)}>Book</button></div> : null}
    {bookFor === n.need_id ? <div className="row" style={{ gap: 6 }}><input className="inp" style={{ height: 32, width: 160 }} type="date" value={bookDate} min={today} onChange={e => setBookDate(e.target.value)} aria-label="Booking date" /><button className="btn btn-acc btn-xs" disabled={!bookDate || busy} onClick={() => book(n)}>Save booking</button></div> : null}
  </div>; };
  const col = (s, L, act) => <div className="cn"><div className="cn-h"><b>{s}</b><span>{L.length}</span></div>{L.length ? L.map(n => need(n, act)) : <div className="muted small" style={{ padding: 12, textAlign: 'center' }}>—</div>}</div>;
  const tiers = [[0, 3, 1], [4, 7, 2], [8, 12, 3], [13, 23, 4]];
  const cad = (r.tier_rule && r.tier_rule.cadence_days ? String(r.tier_rule.cadence_days).split(',') : []).map(Number);
  const cadL = (r.tier_rule && r.tier_rule.cadence ? r.tier_rule.cadence.split(',').map(s => s.trim()) : []);
  const dispositions = P.needs.flatMap(n => n.last_outcome ? [{ ...n.last_outcome, need: n.need }] : []).sort((a, b) => (b.recorded_at || '').localeCompare(a.recorded_at || ''));
  return <div className="cpv">
    <div className="panel"><div className="ph"><h2 style={{ fontSize: 15 }}>Care plan · Current · Next · Future</h2><span className="small muted mono">safety → acute → uncontrolled → barrier → gap → goal</span></div>
      <div className="cns">{col('Current', P.current, true)}{col('Next', P.next)}{col('Future', P.future)}</div>
      {P.closed.length ? <div className="row" style={{ marginTop: 12 }}>{P.closed.map(n => <Tag key={n.need_id} cls={n.status === 'done' ? 't-ok' : 't-crit'} title={`${n.need} · ${n.gap_state}`}>{n.status === 'done' ? '✓' : '✕'} {n.next_best_action}{n.gap_state === 'Reported' ? ' · awaiting claims' : n.hold_until ? ' · held until ' + fmtDay(n.hold_until) : ''}</Tag>)}</div> : null}</div>
    <div className="tiles"><Tile n={c('sched')} label="Scheduled" cls="crit" /><Tile n={c('raise')} label="Raise on next call" cls="warn" /><Tile n={c('not')} label="Not scheduled" cls="info" /><Tile n={c('closed') + c('rep')} label="Closed for now · reported" cls="neu" /></div>
    <div className="panel"><div className="ph"><h2 style={{ fontSize: 15 }}>Open care gaps</h2><span className="small muted">A gap closes only when claims or results prove the care happened</span></div>
      <div className="tblwrap"><table className="tbl"><thead><tr><th style={{ width: '36%' }}>Care gap</th><th>On the last call</th><th>Scheduling</th><th style={{ width: '30%' }}>What is planned</th></tr></thead><tbody>
        {rows.map(x => <tr key={x.n.need_id}><td><b style={{ fontWeight: 600 }}>{x.n.need}</b> <Tag cls={x.n.slot === 'CURRENT' ? 't-crit' : 't-neu'}>{x.n.slot === 'CURRENT' ? 'Current' : x.n.slot === 'NEXT' ? 'Next' : x.n.slot === 'FUTURE' ? 'Future' : x.n.status}</Tag><small>{x.n.trigger_code} · {x.n.evidence}</small></td><td><Tag cls={x.last[0]}>{x.last[1]}</Tag></td><td><Tag cls={x.scheduling[0]}>{x.scheduling[1]}</Tag></td><td>{x.planned.length ? x.planned.map((p, i) => <div key={i}>{p}</div>) : 'Nothing yet'}</td></tr>)}
        {rows.length ? null : <tr><td colSpan={4} className="muted">No care needs: no trigger fired for this member in a live campaign.</td></tr>}</tbody></table></div></div>
    <div className="g2">
      <div className="panel"><div className="ph"><h2 style={{ fontSize: 15 }}>Risk · R = C + M + K + U + A</h2><span className="small"><b style={{ fontSize: 20 }}>{r.total_risk_score}</b> / 23{r.kidney_provisional ? ' · kidney provisional' : ''}</span></div>
        {risk.data ? <>{bar('Clinical', r.clinical_score, 5)}{bar('Comorbid', r.comorbidity_score, 6)}{bar('Kidney', r.kidney_score, 5)}{bar('Use', r.utilisation_score, 5)}{bar('Age/sex', r.age_sex_score, 2)}
          <div className="tsc">{tiers.map(([a, b, t]) => <span key={t} className={r.tier === t ? 'on' : ''} style={{ flex: b - a + 1 }}>{a}–{b}</span>)}<i style={{ left: Math.min(100, r.total_risk_score / 23 * 100) + '%' }} /></div>
          <div className="row small" style={{ marginTop: 12 }}><AlertTag colour={al.alert_colour} priority={al.contact_priority} /><span>Tier {r.tier} · {r.tier_label} · {pathwayLabel(r.pathway)}</span><span className="muted">· extract reference total {r.extract_total_risk_score} {r.matches_extract ? '(matches)' : '(differs)'}</span><Source kind="engine" /></div></> : <Loading />}</div>
      <div className="panel"><div className="ph"><h2 style={{ fontSize: 15 }}>Cadence · Tier {r.tier}</h2><span className="small muted">{r.safety_flag ? 'event pathway' : r.tier_rule && r.tier_rule.campaign_does}</span></div>
        <div className="cad">{cad.map((d, i) => <div key={i} className={'cdx' + (i === 0 ? ' on' : '')}><i /><b>{cadL[i] || `+${d}d`}</b><small>{fmtDay(addDays(today, d)).replace(/\s\d{4}$/, '')}</small></div>)}</div>
        <p className="muted small" style={{ margin: '12px 0 0' }}>Care plan {P.care_plan ? P.care_plan.care_plan_id : '—'} · {P.care_plan ? P.care_plan.cadence : ''} · updated by run {P.care_plan && P.care_plan.updated_run_id} <Source kind="rulebook" /></p></div>
    </div>
    <div className="panel"><div className="ph"><h2 style={{ fontSize: 15 }}>Care-gap lifecycle</h2><span className="small muted">Potential → Verified → Scheduled → Reported → Closed · only claims close a gap</span></div>
      {P.needs.filter(n => ['gap', 'unctl'].includes(n.need_class)).map(g => <div key={g.need_id} className="lc"><b>{g.need} <span className="mono muted" style={{ fontWeight: 400 }}>{g.trigger_code}</span></b><div className="lc-s">{GAP_STATES.map((s, i) => <span key={s} className={(GAP_STATES.indexOf(g.gap_state) >= i ? 'on' : '') + (g.gap_state === s ? ' cur' : '')}>{s}</span>)}</div>{g.assertions && g.assertions.length ? <small className="muted">Member said: {g.assertions.map(a => a.assertion_text).join(' · ')}</small> : null}</div>)}
      {!P.needs.some(n => ['gap', 'unctl'].includes(n.need_class)) ? <span className="muted small">None</span> : null}</div>
    {dispositions.length ? <div className="panel"><div className="ph"><h2 style={{ fontSize: 15 }}>Write-backs</h2><span className="small muted">disposition_event → read by the next care intelligence run</span></div>
      <ul className="tl">{dispositions.map((d, i) => <li key={i}><span className="d">{String(d.recorded_at || '').slice(0, 16)}</span><i style={{ background: d.outcome === 'done' ? 'var(--success)' : d.outcome === 'declined' ? 'var(--critical)' : 'var(--accent)' }} /><div><b style={{ fontWeight: 600 }}>{d.need}</b> <Tag cls={LAST[d.outcome] ? LAST[d.outcome][0] : 't-neu'}>{d.outcome}</Tag><small>{d.recorded_by}{d.note ? ' · ' + d.note : ''}</small></div></li>)}</ul></div> : null}
  </div>;
}
