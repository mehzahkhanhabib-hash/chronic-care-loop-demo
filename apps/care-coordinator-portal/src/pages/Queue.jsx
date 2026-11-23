import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApi, useUser } from '../hooks.js';
import MemberList from '../components/MemberList.jsx';
import { Loading, ErrorBox } from '../components/Bits.jsx';

/** Nudge queue landing: opens the first member of the nurse's list (rulebook order from GET /api/portal/worklist). */
export default function Queue() {
  const { user } = useUser(); const loc = useLocation();
  const wl = useApi(`/portal/worklist?nurse_id=${user.user_id}`);
  const to360 = /view=360/.test(loc.search);
  const items = wl.data ? wl.data.items : [];
  const firstUp = items.find(i => i.list_status === 'today') || items[0];
  if (firstUp) return <Navigate replace to={`/member/${firstUp.member_id}${to360 ? '/360' : ''}`} />;
  return <><MemberList wl={wl} sel={null} mode="call" />
    <main className="main" id="main"><div className="scroll">{wl.loading ? <Loading what="Loading your queue" /> : wl.error ? <ErrorBox error={wl.error} retry={wl.reload} />
      : <div className="panel" style={{ marginTop: 24 }}><h2>Pick a member to start</h2><p className="muted">Your queue is clear. Members a live campaign assigns to you appear here after the next care-intelligence run.</p></div>}</div></main></>;
}
