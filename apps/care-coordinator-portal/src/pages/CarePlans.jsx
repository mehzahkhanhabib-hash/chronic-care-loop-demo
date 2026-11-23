import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks.js';
import { Loading, ErrorBox, Ring, Tag, ConsentTag, AlertTag } from '../components/Bits.jsx';
import MemberHead from '../components/MemberHead.jsx';
import CarePlanView from '../components/CarePlanView.jsx';
import Icon from '../icons.jsx';
import { pathwayLabel, fmtDay } from '../util.js';

/** Care plans page (design table: member · programme · open needs · Member 360). Rows: GET /intelligence/members. /care-plans/:id opens that member's plan (locked until consent, G2). */
export default function CarePlans() {
  const { id } = useParams(); const nav = useNavigate();
  const list = useApi('/intelligence/members?limit=500');
  const [q, setQ] = useState(''); const [only, setOnly] = useState(false); const [n, setN] = useState(40);
  const all = useMemo(() => (list.data ? list.data.members : []).filter(m => m.open_needs > 0), [list.data]);
  const L = useMemo(() => all.filter(m => !only || m.consent_status === 'granted').filter(m => !q || `${m.display_name} ${m.member_id}`.toLowerCase().includes(q.toLowerCase())), [all, q, only]);
  if (id) return <PlanDetail id={id} onBack={() => nav('/care-plans')} onChanged={list.reload} />;
  if (list.loading && !list.data) return <div className="pg"><Loading what="Loading care plans" /></div>;
  if (list.error) return <div className="pg"><ErrorBox error={list.error} retry={list.reload} /></div>;
  return <div className="pg">
    <div className="pgh"><h1>Care plans</h1><span className="small muted">Members with an open care plan · {all.length} of {list.data.count} evaluated · run {list.data.run_id}</span></div>
    <div className="bar2"><label className="search" style={{ width: 320, margin: 0 }}><Icon name="usearch" /><input placeholder="Search name or member id" value={q} onChange={e => { setQ(e.target.value); setN(40); }} aria-label="Search care plans" /></label>
      <div className="chips"><button className="chip lg" aria-pressed={!only} onClick={() => setOnly(false)}>All <span className="c">{all.length}</span></button><button className="chip lg" aria-pressed={only} onClick={() => setOnly(true)}>Consent on file <span className="c">{all.filter(m => m.consent_status === 'granted').length}</span></button></div></div>
    <div className="panel"><div className="tblwrap"><table className="tbl"><thead><tr><th>Member</th><th>Programme</th><th>Alert</th><th>Open needs</th><th>Nurse · due</th><th /></tr></thead><tbody>
      {L.slice(0, n).map(m => <tr key={m.member_id}><td><div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}><Ring v={m.total_risk_score} colour={m.alert_colour} size={40} /><div><b style={{ fontWeight: 600 }}>{m.display_name}</b><small>{m.member_id} · {pathwayLabel(m.pathway)} · Tier {m.tier}</small></div></div></td>
        <td>{m.campaign_name ? <Tag cls="t-acc">{m.campaign_name}</Tag> : <Tag cls="t-neu">Care plan</Tag>} <ConsentTag status={m.consent_status} /></td><td><AlertTag colour={m.alert_colour} priority={m.contact_priority} /></td>
        <td>{m.consent_status === 'granted' ? <>{m.open_needs}<small>{m.current_needs}</small></> : <>{m.open_needs}<small className="muted">Details unlock with consent</small></>}</td><td>{m.nurse_name || '—'}<small>{m.due_by ? fmtDay(m.due_by) : ''}</small></td>
        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><button className="btn btn-sec btn-sm" onClick={() => nav(`/care-plans/${m.member_id}`)}>Care plan</button> <button className="btn btn-sec btn-sm" onClick={() => nav(`/member/${m.member_id}/360`)}>Member 360</button></td></tr>)}
      {L.length ? null : <tr><td colSpan={6} className="muted">No care plans match.</td></tr>}</tbody></table></div>
      {L.length > n ? <div style={{ textAlign: 'center', paddingTop: 12 }}><button className="btn btn-sec btn-sm" onClick={() => setN(L.length)}>Show all {L.length}</button></div> : null}</div>
  </div>;
}
function PlanDetail({ id, onBack, onChanged }) {
  const nav = useNavigate();
  const m = useApi(`/members/${id}`);
  return <div className="scroll">
    <div style={{ marginBottom: 12 }}><button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="back" /> All care plans</button></div>
    {m.error ? <ErrorBox error={m.error} retry={m.reload} /> : !m.data || m.data.identity.member_id !== id ? <Loading what="Loading care plan" /> : <>
      <MemberHead M={m.data} mode="360" />
      <div style={{ height: 16 }} />
      <CarePlanView memberId={id} consent={m.data.consent_status} onChanged={() => { m.reload(); onChanged && onChanged(); }}><button className="btn btn-pri btn-sm" onClick={() => nav(`/member/${id}`)}><Icon name="phone" /> Open Call Workflow</button></CarePlanView></>}
  </div>;
}
