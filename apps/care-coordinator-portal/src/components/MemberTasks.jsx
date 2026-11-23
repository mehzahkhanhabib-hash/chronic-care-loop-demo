import React, { useState } from 'react';
import { api } from '../api.js';
import { useApi, useUser, useToast, useApp } from '../hooks.js';
import { Loading, ErrorBox } from './Bits.jsx';
import TaskRow, { isAgreed } from './TaskRow.jsx';
import { KIND_LABEL, relDay } from '../util.js';

/** Member · Tasks tab (design: "Agreed on this call" + "<name>'s tasks"). Rows: GET /members/:id/tasks. Reassign: POST /portal/assign. */
export default function MemberTasks({ memberId, name, needs, tasks, assignment, onChanged }) {
  const { user } = useUser(); const say = useToast(); const { today } = useApp();
  const users = useApi('/users');
  const [busy, setBusy] = useState(false);
  if (tasks.loading && !tasks.data) return <Loading what="Loading tasks" />;
  if (tasks.error) return <ErrorBox error={tasks.error} retry={tasks.reload} />;
  const T = [...(tasks.data || [])].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
  const byNeed = Object.fromEntries((needs || []).map(n => [n.need_id, n]));
  const ag = x => { const n = x.need_id && byNeed[x.need_id]; return n && n.last_outcome ? ['agreed', 'done'].includes(n.last_outcome.outcome) : isAgreed(x); };
  const run = async (fn, msg) => { setBusy(true); try { await fn(); say(msg); onChanged && onChanged(); } catch (e) { say('Not saved: ' + e.message); } finally { setBusy(false); } };
  const done = x => run(() => api.post(`/portal/tasks/${x.task_id}/complete`, { nurse_id: user.user_id }), x.task_kind === 'nba' ? 'Done · gap Reported, verify in claims' : 'Task done');
  const book = (x, d) => run(() => api.post(`/portal/tasks/${x.task_id}/book`, { booking_date: d, nurse_id: user.user_id }), 'Booked · gap Scheduled');
  const assign = nid => run(() => api.post('/portal/assign', { member_id: memberId, nurse_id: nid }), 'Member reassigned · open tasks moved');
  const open = T.filter(x => x.status === 'open'), closed = T.filter(x => x.status !== 'open');
  const fresh = open.filter(x => x.parent_action_id && String(x.created_at || '').slice(0, 10) >= String(new Date().toISOString()).slice(0, 10));
  return <>
    {fresh.length ? <div className="panel" style={{ marginBottom: 16 }}><div className="ph"><h2 style={{ fontSize: 15 }}>Agreed on this call</h2><span className="small muted">Created by the decisions recorded on the call · already in Tasks</span></div>
      <div className="tlist">{fresh.map(x => <div key={x.task_id} className={'task ' + (ag(x) ? 'ag' : '')}><span className="tk" /><div className="tb"><b>{x.title}</b><small>{ag(x) ? <span className="agc y">Agreed</span> : <span className="agc n">Not agreed</span>} {KIND_LABEL[x.task_kind] || x.task_kind}{x.trigger_code ? ` · ${x.trigger_code}` : ''}</small></div><span className="when">{relDay(x.due_date, today)}</span></div>)}</div></div> : null}
    <div className="panel"><div className="ph"><h2 style={{ fontSize: 15 }}>{name}’s tasks</h2><div className="leg"><span><i className="ag" />Agreed</span><span><i className="nag" />Not agreed yet</span></div>
      <label className="small muted" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>Assigned to
        <select className="inp" style={{ width: 200, height: 32 }} value={assignment ? assignment.nurse_id : ''} disabled={busy} onChange={e => assign(e.target.value)} aria-label="Assigned nurse">{(users.data || []).map(u => <option key={u.user_id} value={u.user_id}>{u.name} · {u.role}</option>)}</select></label></div>
      <div className="tlist">{open.length ? open.map(x => <TaskRow key={x.task_id} x={x} inMember today={today} busy={busy} onDone={done} onBook={book} agreed={ag(x)} />) : <p className="muted" style={{ margin: 0 }}>No open tasks.</p>}</div>
      {closed.length ? <><div className="lbl2" style={{ margin: '18px 0 8px' }}>Done</div><div className="tlist">{closed.map(x => <TaskRow key={x.task_id} x={x} inMember today={today} busy={busy} onDone={done} onBook={book} agreed={ag(x)} />)}</div></> : null}</div>
  </>;
}
