import React from 'react';
import { useApi } from '../hooks.js';
import { Loading, ErrorBox, Source, Tag, AlertTag } from './Bits.jsx';
import { CLASS_LABEL, CLASS_TAG } from '../util.js';

/** Care intelligence panel: how the engine got to this member's score, alert and triggers. Read-only rule outputs (no claims history is shown here). */
export default function Intelligence({ memberId }) {
  const risk = useApi(`/members/${memberId}/risk`);
  const ev = useApi(`/members/${memberId}/evaluations`);
  if ((risk.loading && !risk.data) || (ev.loading && !ev.data)) return <Loading what="Loading rule evaluations" />;
  if (risk.error) return <ErrorBox error={risk.error} retry={risk.reload} />;
  if (ev.error) return <ErrorBox error={ev.error} retry={ev.reload} />;
  const r = risk.data || {}, al = r.alert || {}, E = ev.data || [];
  const chain = [['Longitudinal', '377 columns', '250_members_longitudinal_data.xlsx'], ['Risk points', `${(r.components || []).reduce((a, c) => a + c.rules.length, 0)} bands scored`, 'risk_score_band'], ['Total → tier', `R ${r.total_risk_score} → tier ${r.tier}`, 'rule_tier'], ['Triggers', `${E.filter(e => e.evaluation_result === 'fired').length} fired · ${E.filter(e => e.evaluation_result === 'cannot_tell').length} cannot tell`, 'rule_condition'], ['Alert · priority', `${al.alert_colour} · ${al.contact_priority}`, 'rule_alert · rule_contact_priority'], ['Care plan', 'CURRENT 1–3 · NEXT 4–6', 'care_need']];
  return <div className="cpv">
    <div className="row small"><Source kind="longitudinal" /><Source kind="rulebook" /><Source kind="engine" /><span className="muted">· run {r.run_id} · rule version {r.rule_version} · evaluated {r.evaluated_at}</span></div>
    <div className="chain">{chain.map((s, i) => <React.Fragment key={s[0]}><div className="st"><b>{s[0]}</b><small>{s[1]}</small><span className="mono">{s[2]}</span></div>{i < chain.length - 1 ? <span className="ar">›</span> : null}</React.Fragment>)}</div>
    <div className="panel"><div className="ph"><h2 style={{ fontSize: 15 }}>Risk components</h2><span className="small muted">engine vs extract reference</span></div>
      <div className="tblwrap"><table className="tbl"><thead><tr><th>Component</th><th>Score</th><th>Extract</th><th>Scoring rules that applied (inputs read)</th></tr></thead><tbody>
        {(r.components || []).map(c => <tr key={c.component}><td><b style={{ fontWeight: 600 }}>{c.component} · {c.name}</b><small>{c.formula} · cap {c.cap}</small></td><td className="num"><b>{c.score}</b> / {c.cap}</td><td className="num muted">{c.extract_score}</td><td>{c.rules.length ? c.rules.map(x => <div key={x.rule_id} className="small"><span className="mono">{x.rule_id}</span> {x.clinical_evidence}</div>) : <span className="muted">no points</span>}</td></tr>)}</tbody></table></div>
      <div className="row small" style={{ marginTop: 12 }}><AlertTag colour={al.alert_colour} priority={al.contact_priority} /><span>{al.reasons}</span><span className="muted">· SLA {al.sla_days === null || al.sla_days === undefined ? 'nudge only' : al.sla_days + ' day(s)'}</span>{r.safety_flag ? <Tag cls="t-crit">Priority clinical review</Tag> : null}</div></div>
    <div className="panel"><div className="ph"><h2 style={{ fontSize: 15 }}>Trigger library · {E.length} rules</h2><span className="small muted">fired / cannot tell / not fired · with inputs, logic and evidence</span></div>
      {E.map(e => <div key={e.rule_id} className={'evrow' + (e.evaluation_result === 'fired' ? ' fired' : '')}>
        <div><b className="mono">{e.rule_id}</b><br /><Tag cls={CLASS_TAG[e.need_class]}>{CLASS_LABEL[e.need_class]}</Tag></div>
        <div><b>{e.trigger_name}</b> <span className="muted">· {e.pathway}</span><div className="mono small">{e.evaluation_logic}</div>
          <div className="row small" style={{ marginTop: 4, gap: 4 }}>Inputs: {Object.entries(e.input_values || {}).map(([k, v]) => <Tag key={k} cls="t-dash" style={{ textTransform: 'none' }}>{k} = {v === null ? '—' : String(v)}</Tag>)}</div>
          {e.clinical_evidence ? <div className="small" style={{ marginTop: 3 }}><b>Evidence:</b> {e.clinical_evidence}</div> : null}
          {e.evaluation_result === 'fired' ? <div className="small" style={{ marginTop: 3 }}><b>Next best action:</b> {e.next_best_action} · {e.action_owner} · done when {e.done_when}{e.need ? ` · ${e.need.slot} · ${e.need.gap_state}` : ''}</div> : null}</div>
        <Tag cls={e.evaluation_result === 'fired' ? 't-acc' : e.evaluation_result === 'cannot_tell' ? 't-warn' : 't-neu'}>{e.evaluation_result.replace('_', ' ')}</Tag>
      </div>)}</div>
  </div>;
}
