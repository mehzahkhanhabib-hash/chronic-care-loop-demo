import React from 'react';
import { useParams } from 'react-router-dom';
import { useApi, useUser } from '../hooks.js';
import { useScopedWorklist } from '../scope.js';
import MemberList from '../components/MemberList.jsx';
import MemberPane from '../components/MemberPane.jsx';
import Member360Pane from '../components/Member360Pane.jsx';

/** Member workspace: /member/:id[/call|plan|tasks|timeline|intel|360]. Also the target of the Studio embed (/#/member/<id>). */
export default function MemberPage() {
  const { id, tab = 'call' } = useParams(); const { user } = useUser();
  const { wl, scope, scoped, setScoped } = useScopedWorklist(user);
  return <><MemberList wl={wl} scope={scope} scoped={scoped} setScoped={setScoped} sel={id} mode={tab === '360' ? '360' : 'call'} />
    <main className="main" id="main">{tab === '360' ? <Member360Pane key={id} memberId={id} wl={wl} /> : <MemberPane key={id} memberId={id} tab={tab} wl={wl} />}</main></>;
}
