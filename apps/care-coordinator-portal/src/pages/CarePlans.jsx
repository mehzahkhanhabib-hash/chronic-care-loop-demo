import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks.js';
import { Loading, ErrorBox } from '../components/Bits.jsx';
import MemberHeader from '../components/MemberHeader.jsx';
import CarePlanView from '../components/CarePlanView.jsx';
import Icon from '../icons.jsx';
import { ALERT_CLS, pathwayLabel } from '../util.js';

/** Care plans page: every member with a care plan (engine output), the selected plan on the right. Locked until consent (G2). */
export default function CarePlans() {
  const { id } = useParams(); const nav = useNavigate();
  const list = useApi('/intelligence/members?limit=500');
  const [q, setQ] = useState('');
  const L = useMemo(() => (list.data ? list.data.members : []).filter(m => m.open_needs > 0).filter(m => !q || `${m.display_name} ${m.member_id}`.toLowerCase().includes(q.toLowerCase())), [list.data, q]);
  const sel = id || (L[0] && L[0].member_id);
  const m = useApi(sel ? `/members/${sel}` : null);
  if (list.loading && !list.data) return <Loading what="Loading care plans" />;
  if (list.error) return <ErrorBox error={list.error} retry={list.reload} />;
  return <div className="split">
    <aside className="lst"><div className="hd"><b style={{ fontSize: 14 }}>Care plans <span className="mono muted">{L.length}</span></b><input type="search" placeholder="Search name or id" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="it">{L.map(x => <button key={x.member_id} className={'li' + (x.member_id === sel ? ' on' : '')} onClick={() => nav(`/care-plans/${x.member_id}`)}><div className="r1"><b>{x.display_name}</b>{x.consent_status !== 'granted' ? <span className="pill">🔒</span> : <span className={'pill ' + (ALERT_CLS[x.alert_colour] || 'line')}>{x.alert_colour}</span>}</div><small><span className="mono">{x.member_id}</span> · {pathwayLabel(x.pathway)} · Tier {x.tier} · R {x.total_risk_score} · {x.open_needs} open</small></button>)}</div></aside>
    <div className="scroll pad">{!sel ? <div className="empty">No care plans.</div> : m.error ? <ErrorBox error={m.error} retry={m.reload} /> : !m.data ? <Loading /> : <div className="pg-in">
      <MemberHeader m={m.data} consent={m.data.consent_status}><button className="btn pri" onClick={() => nav(`/member/${sel}/call`)}><Icon name="phone" />Call</button></MemberHeader>
      <CarePlanView memberId={sel} consent={m.data.consent_status} onChanged={() => { m.reload(); list.reload(); }} />
    </div>}</div>
  </div>;
}
