import React, { useState } from 'react';
import Icon from '../icons.jsx';
import { Tag } from './Bits.jsx';
import { KIND_LABEL, TIMES, fmtDay, relDay, daysFrom } from '../util.js';

/** "Agreed with the member" as far as a task row can tell: a follow-up created by a decision, or a gap already Scheduled / Reported. */
export const isAgreed = x => x.task_kind === 'follow_up' || !!x.parent_action_id || ['Scheduled', 'Reported', 'Closed'].includes(x.gap_state);

/** One task row from the design (tick · title · agreed chip · when · Book · Open). Tick = POST /portal/tasks/:id/complete, Book = POST /portal/tasks/:id/book. */
export default function TaskRow({ x, inMember, today, busy, onDone, onBook, onOpen, agreed }) {
  const [form, setForm] = useState(false); const [d, setD] = useState(''); const [t, setT] = useState('10:00'); const [err, setErr] = useState(false);
  const done = x.status !== 'open', late = !done && x.due_date < today, ag = agreed === undefined ? isAgreed(x) : agreed, canBook = !done && x.task_kind === 'nba';
  const n = -daysFrom(x.due_date, today);
  const when = done ? (x.status === 'done' ? 'Done' : x.status) : late ? `Overdue · ${n} day${n === 1 ? '' : 's'}` : relDay(x.due_date, today) + (x.due_time ? ' · ' + x.due_time : '');
  const cl = x.booking_date ? <span className={'cl' + (done ? ' ok' : '')}>{done ? '✓ ' : ''}Booked · {fmtDay(x.booking_date)}</span>
    : done && x.completed_at ? <span className="cl ok">✓ Completed {String(x.completed_at).slice(0, 16)}{x.task_kind === 'nba' ? ' · gap Reported, verify in claims' : ''}</span>
      : canBook ? <span className="cl">No date yet · ask the member</span> : null;
  return <div className={'task ' + (done ? 'done' : late ? 'late' : ag ? 'ag' : '')}>
    <button className="tk" onClick={() => !done && onDone(x)} disabled={busy || done} aria-pressed={done} title={done ? 'Done' : 'Mark done'}>{done ? <Icon name="tick" /> : null}</button>
    <div className="tb"><b>{x.title}</b><small className="tmeta">{inMember ? null : <span>{x.display_name} · <span className="mono">{x.member_id}</span></span>}{ag ? <span className="agc y">Agreed</span> : <span className="agc n">Not agreed</span>}<span>{KIND_LABEL[x.task_kind] || x.task_kind}{x.trigger_code ? ` · ${x.trigger_code} · ${x.gap_state}` : ''}</span>{!inMember && x.assignee_name ? <span>{x.assignee_name}</span> : null}{x.parent_action_id && !done ? <Tag cls="t-acc">From a call</Tag> : null}</small>{cl}</div>
    <div className="tr"><span className={'when' + (late ? ' late' : '')}>{when}</span>{canBook ? <button className="btn btn-acc btn-sm" onClick={() => { setForm(!form); setErr(false); }}>Book</button> : null}{inMember || !onOpen ? null : <button className="btn btn-ghost btn-sm" onClick={() => onOpen(x)}>Open</button>}</div>
    {form && canBook ? <div className="bkf"><span className="small" style={{ fontWeight: 600 }}>Booking date</span>
      <input className={'inp' + (err && !d ? ' err' : '')} type="date" value={d} min={today} onChange={e => setD(e.target.value)} aria-label="Booking date" />
      <select className="inp" style={{ width: 110 }} value={t} onChange={e => setT(e.target.value)} aria-label="Time">{TIMES.map(o => <option key={o}>{o}</option>)}</select>
      <button className="btn btn-pri btn-sm" disabled={busy} onClick={() => { if (!d) { setErr(true); return; } onBook(x, d, t); setForm(false); }}>Confirm booking</button><button className="btn btn-ghost btn-sm" onClick={() => setForm(false)}>Cancel</button>
      {err && !d ? <span className="small" style={{ color: 'var(--critical)' }}>Pick a date to save</span> : null}</div> : null}
  </div>;
}
