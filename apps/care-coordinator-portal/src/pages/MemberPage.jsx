import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks.js';
import { Loading, ErrorBox } from '../components/Bits.jsx';
import MemberHeader from '../components/MemberHeader.jsx';
import CallWorkflow from '../components/CallWorkflow.jsx';
import Member360 from '../components/Member360.jsx';
import CarePlanView from '../components/CarePlanView.jsx';
import Intelligence from '../components/Intelligence.jsx';
import Timeline from '../components/Timeline.jsx';
import Icon from '../icons.jsx';
import { Lock } from '../components/Bits.jsx';

const TABS = [['call', 'Call'], ['360', 'Member 360'], ['plan', 'Care gaps & plan'], ['intel', 'Intelligence'], ['timeline', 'Timeline']];
/** Member workspace: /member/:id[/:tab]. Also the target of the Studio embed (http://localhost:3001/#/member/<id>). */
export default function MemberPage() {
  const { id, tab = 'call' } = useParams(); const nav = useNavigate();
  const m = useApi(`/members/${id}`);
  if (m.loading && !m.data) return <Loading what="Loading member" />;
  if (m.error) return <ErrorBox error={m.error} retry={m.reload} />;
  const consent = m.data.consent_status, granted = consent === 'granted';
  return <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
    <div className="wtabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => nav(`/member/${id}/${k}`)}>{l}{(k === '360' || k === 'plan') && !granted ? <span className="n"><Icon name="lock" style={{ width: 10 }} /></span> : null}</button>)}</div>
    <div className="scroll pad">
      {tab === 'call' ? <CallWorkflow memberId={id} onChanged={m.reload} /> : (
        <div className="pg-in">
          <MemberHeader m={m.data} consent={consent} compact><button className="btn pri" onClick={() => nav(`/member/${id}/call`)}><Icon name="phone" />Open call workflow</button></MemberHeader>
          {tab === '360' ? (granted ? <Member360 memberId={id} /> : <Lock what="Member 360" declined={consent === 'declined' || consent === 'withdrawn'} />) : null}
          {tab === 'plan' ? <CarePlanView memberId={id} consent={consent} onChanged={m.reload} /> : null}
          {tab === 'intel' ? <Intelligence memberId={id} /> : null}
          {tab === 'timeline' ? <Timeline memberId={id} /> : null}
        </div>)}
    </div>
  </div>;
}
