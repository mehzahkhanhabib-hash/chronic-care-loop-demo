import React, { useState } from 'react';
import { api } from '../api.js';
import { useApi, useUser, useToast } from '../hooks.js';
import { Loading, ErrorBox, Lock } from './Bits.jsx';
import Icon from '../icons.jsx';
import { CLASS_LABEL, GAP_STATES, classCls, relDay, fmtDay, pathwayLabel, ALERT_CLS } from '../util.js';

/** Care gaps & plan: risk (engine), CURRENT / NEXT / FUTURE needs with write-back buttons, gap lifecycle, cadence. Gated by consent (G2). */
export default function CarePlanView({ memberId, consent, onChanged }) {
  const { user } = useUser(); const say = useToast();
  const plan = useApi(`/members/${memberId}/care-plan`);
  const risk = useApi(`/members/${memberId}/risk`);
  const health = useApi('/health');
  const [busy, setBusy] = useState(false); const [bookFor, setBookFor] = useState(null); const [bookDate, setBookDate] = useState('');
  const today = health.data ? health.data.run_date : '2026-11-20';
  if (consent !== 'granted') return <div className="pg-in cpv"><Lock what="Care gaps and care plan" declined={consent === 'declined' || consent === 'withdrawn'} /></div>;
  if (plan.loading && !plan.data) return <Loading what="Loading care plan" />;
  if (plan.error) return <ErrorBox error={plan.error} retry={plan.reload} />;
  const P = plan.data, r = risk.data || {}, al = r.alert || {};
  const refresh = () => { plan.reload(); onChanged && onChanged(); };
  const run = async (fn, msg) => { setBusy(true); try { await fn(); say(msg); refresh(); } catch (e) { say('Not saved: ' + e.message); } finally { setBusy(false); } };
  const wb = (n, o) => run(() => api.post('/portal/outcomes', { need_id: n.need_id, action_id: n.action && n.action.status === 'open' ? n.action.action_id : undefined, outcome: o, nurse_id: user.user_id }), { done: 'Done · gap Reported, verify in claims', declined: 'Declined · held 90 days', agreed: 'Agreed · follow-up created', carried: 'Carried · stays CURRENT' }[o]);
  const book = (n) => run(() => api.post('/portal/appointments', { member_id: memberId, need_id: n.need_id, action_id: n.action && n.action.action_id, appointment_type: n.trigger_code, scheduled_date: bookDate, nurse_id: user.user_id }).then(() => { setBookFor(null); setBookDate(''); }), 'Booked · gap Scheduled');
  const bar = (k, v, mx) => <div className="rk" key={k}><span>{k}</span><i><b style={{ width: (v / mx * 100) + '%' }} /></i><em>{v}</em></div>;
  const need = (n, act) => <div className="nd" key={n.need_id}>
    <div className="nd-h"><span className={'pill ' + classCls(n.need_class)}>{CLASS_LABEL[n.need_class]}</span><span className="pill line">{n.gap_state}</span>{n.status !== 'open' ? <span className={'pill ' + (n.status === 'done' ? 'ok' : 'crit')}>{n.status}{n.hold_until ? ` · until ${fmtDay(n.hold_until)}` : ''}</span> : null}<span className="mono muted">{relDay(n.due_date, today)}</span></div>
    <b>{n.need} <span className="mono muted" style={{ fontWeight: 400 }}>{n.trigger_code}</span></b>
    <div className="nd-ev">{n.evidence}</div>
    <div className="nd-m"><span title="Next best action"><Icon name="actions" />{n.next_best_action}</span><span title="Owner"><Icon name="user" />{n.action_owner}</span><span title="Done when"><Icon name="check" />{n.done_when}</span></div>
    {n.action ? <div className="nd-act">{n.action.kind === 'follow_up' ? 'Follow-up' : 'Action'} #{n.action.action_id} · {n.action.title} · {n.action.status} · due {fmtDay(n.action.due_date)}</div> : null}
    <div className="gl-s">{GAP_STATES.map((g, i) => <span key={g} className={(GAP_STATES.indexOf(n.gap_state) >= i ? 'on' : '') + (n.gap_state === g ? ' cur' : '')}>{g}</span>)}</div>
    {act && n.status === 'open' ? <div className="nd-a"><button className="btn sm pri" onClick={() => wb(n, 'done')} disabled={busy}>Done</button><button className="btn sm" onClick={() => wb(n, 'agreed')} disabled={busy}>Agreed</button><button className="btn sm" onClick={() => wb(n, 'declined')} disabled={busy}>Declined</button><button className="btn sm ghost" onClick={() => wb(n, 'carried')} disabled={busy}>Carry</button><button className="btn sm ghost" onClick={() => setBookFor(bookFor === n.need_id ? null : n.need_id)}>Book</button></div> : null}
    {bookFor === n.need_id ? <div style={{ display: 'flex', gap: 6 }}><input type="date" value={bookDate} min={today} onChange={e => setBookDate(e.target.value)} /><button className="btn sm pri" disabled={!bookDate || busy} onClick={() => book(n)}>Save booking</button></div> : null}
    {n.gap_events && n.gap_events.length > 1 ? <small className="muted">{n.gap_events.map(g => `${g.from_state || 'new'} → ${g.to_state} (${g.moved_by})`).join(' · ')}</small> : null}
  </div>;
  const col = (s, L, act) => <div className="cn"><div className="cn-h"><b>{s}</b><span className="mono">{L.length}</span></div>{L.length ? L.map(n => need(n, act)) : <div className="muted em">—</div>}</div>;
  const tiers = [[0, 3, 1], [4, 7, 2], [8, 12, 3], [13, 23, 4]];
  const cad = (r.tier_rule && r.tier_rule.cadence_days ? String(r.tier_rule.cadence_days).split(',') : []).map(Number);
  const cadL = (r.tier_rule && r.tier_rule.cadence ? r.tier_rule.cadence.split(',').map(s => s.trim()) : []);
  const dispositions = P.needs.flatMap(n => n.last_outcome ? [{ ...n.last_outcome, need: n.need }] : []).sort((a, b) => (b.recorded_at || '').localeCompare(a.recorded_at || ''));
  return <div className="pg-in cpv">
    <div className="cp-g1">
      <section className="card"><div className="card-h"><h3>Risk · R = C + M + K + U + A</h3><span className="mono"><b style={{ fontSize: 20 }}>{r.total_risk_score}</b> / 23{r.kidney_provisional ? ' · kidney provisional' : ''}</span></div><div className="card-b">
        {risk.data ? <>{bar('Clinical', r.clinical_score, 5)}{bar('Comorbid', r.comorbidity_score, 6)}{bar('Kidney', r.kidney_score, 5)}{bar('Use', r.utilisation_score, 5)}{bar('Age/sex', r.age_sex_score, 2)}
          <div className="tsc">{tiers.map(([a, b, t]) => <span key={t} className={r.tier === t ? 'on' : ''} style={{ flex: b - a + 1 }}>{a}–{b}</span>)}<i style={{ left: Math.min(100, r.total_risk_score / 23 * 100) + '%' }} /></div>
          <div className="statusline" style={{ marginTop: 10 }}><span className={'pill ' + (ALERT_CLS[al.alert_colour] || 'line')}>{al.alert_colour} · {al.contact_priority}</span><span>Tier {r.tier} · {r.tier_label} · {pathwayLabel(r.pathway)}</span><span>· extract reference total {r.extract_total_risk_score} {r.matches_extract ? '(matches)' : '(differs)'}</span></div></> : <Loading />}
      </div></section>
      <section className="card"><div className="card-h"><h3>Cadence · Tier {r.tier}</h3><span className="mono muted">{r.safety_flag ? 'event pathway' : r.tier_rule && r.tier_rule.campaign_does}</span></div><div className="card-b"><div className="cad">{cad.map((d, i) => <div key={i} className={'cdx' + (i === 0 ? ' on' : '')}><i /><b>{cadL[i] || `+${d}d`}</b><small>{fmtDay(new Date(Date.parse(today) + d * 86400000).toISOString().slice(0, 10)).replace(/\s\d{4}$/, '')}</small></div>)}</div>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>Care plan {P.care_plan ? P.care_plan.care_plan_id : '—'} · {P.care_plan ? P.care_plan.cadence : ''} · updated by run {P.care_plan && P.care_plan.updated_run_id}</p></div></section>
    </div>
    <section className="card"><div className="card-h"><h3>Care plan</h3><span className="mono muted">safety → acute → uncontrolled → barrier → gap → goal · CURRENT 1–3 · NEXT 4–6</span></div><div className="card-b"><div className="cns">{col('Current', P.current, true)}{col('Next', P.next)}{col('Future', P.future)}</div>
      {P.closed.length ? <div className="cl" style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>{P.closed.map(n => <span key={n.need_id} className={'pill ' + (n.status === 'done' ? 'ok' : 'crit')} title={`${n.gap_state}${n.hold_until ? ' · held until ' + n.hold_until : ''}`}>{n.status === 'done' ? '✓' : '✕'} {n.need} · {n.gap_state}</span>)}</div> : null}</div></section>
    <section className="card"><div className="card-h"><h3>Care gaps</h3><span className="mono muted">Potential → Verified → Scheduled → Reported → Closed · only claims close</span></div><div className="card-b">
      {P.needs.filter(n => ['gap', 'unctl'].includes(n.need_class)).map(g => <div key={g.need_id} className="gl"><b>{g.need} <span className="mono muted" style={{ fontWeight: 400 }}>{g.trigger_code}</span></b><div className="gl-s">{GAP_STATES.map((s, i) => <span key={s} className={(GAP_STATES.indexOf(g.gap_state) >= i ? 'on' : '') + (g.gap_state === s ? ' cur' : '')}>{s}</span>)}</div>{g.assertions && g.assertions.length ? <small className="muted">Member said: {g.assertions.map(a => a.assertion_text).join(' · ')}</small> : null}</div>) || null}
      {!P.needs.some(n => ['gap', 'unctl'].includes(n.need_class)) ? <span className="muted">None</span> : null}</div></section>
    {dispositions.length ? <section className="card"><div className="card-h"><h3>Write-backs</h3><span className="mono muted">disposition_event → next run</span></div><div className="card-b hist">{dispositions.map((d, i) => <div key={i} className="tl"><span className="d" /><div><b style={{ fontWeight: 500 }}>{d.need}</b><br /><small>{d.recorded_at} · {d.recorded_by}{d.note ? ' · ' + d.note : ''}</small></div><span className={'pill ' + (d.outcome === 'done' ? 'ok' : d.outcome === 'declined' ? 'crit' : 'mod')}>{d.outcome}</span></div>)}</div></section> : null}
  </div>;
}
