import React from 'react';
import { useApi } from '../hooks.js';
import { Loading, ErrorBox, Source } from './Bits.jsx';
import { ALERT_CLS, CLASS_LABEL, classCls } from '../util.js';

/** Care intelligence panel: how the engine got to this member's score, alert and triggers. Read-only; no consent gate (no history is shown, only rule outputs). */
export default function Intelligence({ memberId }) {
  const risk = useApi(`/members/${memberId}/risk`);
  const ev = useApi(`/members/${memberId}/evaluations`);
  if ((risk.loading && !risk.data) || (ev.loading && !ev.data)) return <Loading what="Loading rule evaluations" />;
  if (risk.error) return <ErrorBox error={risk.error} retry={risk.reload} />;
  if (ev.error) return <ErrorBox error={ev.error} retry={ev.reload} />;
  const r = risk.data || {}, al = r.alert || {};
  return <div className="pg-in">
    <div className="statusline"><Source kind="longitudinal" /><Source kind="rulebook" /><Source kind="engine" /><span>· run {r.run_id} · rule version {r.rule_version} · evaluated {r.evaluated_at}</span></div>
    <div className="chain">{[['Longitudinal', `377 columns`, '250_members_longitudinal_data.xlsx'], ['Risk points', `${(r.components || []).reduce((a, c) => a + c.rules.length, 0)} bands scored`, 'risk_score_band'], ['Total → tier', `R ${r.total_risk_score} → tier ${r.tier}`, 'rule_tier'], ['Triggers', `${(ev.data || []).filter(e => e.evaluation_result === 'fired').length} fired · ${(ev.data || []).filter(e => e.evaluation_result === 'cannot_tell').length} cannot tell`, 'rule_condition'], ['Alert · priority', `${al.alert_colour} · ${al.contact_priority}`, 'rule_alert · rule_contact_priority'], ['Care plan', 'CURRENT 1–3 · NEXT 4–6', 'care_need']].map((s, i, a) => <React.Fragment key={s[0]}><div className="st"><b>{s[0]}</b><small>{s[1]}</small><span className="n">{s[2]}</span></div>{i < a.length - 1 ? <span className="ar">›</span> : null}</React.Fragment>)}</div>
    <section className="card"><div className="card-h"><h3>Risk components</h3><span className="r">engine vs extract reference</span></div><div className="card-b"><div className="tblwrap"><table className="tbl"><thead><tr><th>Component</th><th>Score</th><th>Extract</th><th>Scoring rules that applied (inputs read)</th></tr></thead><tbody>
      {(r.components || []).map(c => <tr key={c.component}><td><b>{c.component} · {c.name}</b><br /><small className="muted">{c.formula} · cap {c.cap}</small></td><td className="num"><b>{c.score}</b> / {c.cap}</td><td className="num muted">{c.extract_score}</td><td>{c.rules.length ? c.rules.map(x => <div key={x.rule_id} style={{ fontSize: 11.5 }}><span className="mono">{x.rule_id}</span> {x.clinical_evidence}</div>) : <span className="muted">no points</span>}</td></tr>)}</tbody></table></div>
      <div className="statusline" style={{ marginTop: 10 }}><span className={'pill ' + (ALERT_CLS[al.alert_colour] || 'line')}>{al.alert_colour}</span><span>{al.reasons}</span><span>· {al.contact_priority} · SLA {al.sla_days === null ? 'nudge only' : al.sla_days + ' day(s)'}</span>{r.safety_flag ? <span className="pill crit">Priority clinical review</span> : null}</div></div></section>
    <section className="card"><div className="card-h"><h3>Trigger library · 14 rules</h3><span className="r">fired / cannot tell / not fired · with inputs, logic and evidence</span></div><div className="card-b">
      {(ev.data || []).map(e => <div key={e.rule_id} className={'evrow' + (e.evaluation_result === 'fired' ? ' fired' : '')}>
        <div><b className="mono">{e.rule_id}</b><br /><span className={'pill ' + classCls(e.need_class)}>{CLASS_LABEL[e.need_class]}</span></div>
        <div><b>{e.trigger_name}</b> <span className="muted">· {e.pathway}</span><div className="mono">{e.evaluation_logic}</div>
          <div style={{ fontSize: 11.5, marginTop: 3 }}>Inputs: {Object.entries(e.input_values || {}).map(([k, v]) => <span key={k} className="pill line mono" style={{ marginRight: 4 }}>{k} = {v === null ? '—' : String(v)}</span>)}</div>
          {e.clinical_evidence ? <div style={{ fontSize: 11.5, marginTop: 3 }}><b>Evidence:</b> {e.clinical_evidence}</div> : null}
          {e.evaluation_result === 'fired' ? <div style={{ fontSize: 11.5, marginTop: 3 }}><b>Next best action:</b> {e.next_best_action} · {e.action_owner} · done when {e.done_when}{e.need ? ` · ${e.need.slot} · ${e.need.gap_state}` : ''}</div> : null}</div>
        <span className={'pill ' + (e.evaluation_result === 'fired' ? 'acc' : e.evaluation_result === 'cannot_tell' ? 'mod' : 'line')}>{e.evaluation_result.replace('_', ' ')}</span>
      </div>)}</div></section>
  </div>;
}
