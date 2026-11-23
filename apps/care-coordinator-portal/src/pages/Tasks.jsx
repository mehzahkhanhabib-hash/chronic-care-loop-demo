import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApi, useUser, useToast, useApp } from '../hooks.js';
import { Loading, ErrorBox, Tile } from '../components/Bits.jsx';
import TaskRow, { isAgreed } from '../components/TaskRow.jsx';
import Icon from '../icons.jsx';
import { fmtDay, initials, first } from '../util.js';

const FILTERS = [['all', 'All'], ['agreed', 'Agreed with member'], ['nba', 'Care plan'], ['follow_up', 'Follow-ups'], ['call', 'Calls'], ['escalation', 'Escalations'], ['nudge', 'Nudges']];
const F = { all: () => true, agreed: isAgreed, nba: x => x.task_kind === 'nba', follow_up: x => x.task_kind === 'follow_up', call: x => x.task_kind === 'call', escalation: x => x.task_kind === 'escalation', nudge: x => x.task_kind === 'nudge' };
const sortD = (a, b) => (a.due_date || '').localeCompare(b.due_date || '') || (a.due_time || '').localeCompare(b.due_time || '') || a.task_id - b.task_id;

/** Actions page (design: tiles, calendar or list, filters). GET /portal/tasks · tick = POST /portal/tasks/:id/complete · Book = POST /portal/tasks/:id/book. */
export default function Tasks() {
  const { user } = useUser(); const say = useToast(); const nav = useNavigate(); const { today, bump } = useApp();
  const [mine, setMine] = useState(true); const [f, setF] = useState('all'); const [view, setView] = useState('calendar'); const [calM, setCalM] = useState(0); const [calDay, setCalDay] = useState(null); const [mem, setMem] = useState(''); const [busy, setBusy] = useState(false); const [more, setMore] = useState({});
  const t = useApi(`/portal/tasks${mine ? `?nurse_id=${user.user_id}` : ''}`, [mine]);
  const T = t.data || [];
  const L = useMemo(() => T.filter(F[f] || F.all).filter(x => !mem || x.member_id === mem), [t.data, f, mem]); // eslint-disable-line react-hooks/exhaustive-deps
  const members = useMemo(() => { const m = new Map(); T.forEach(x => m.set(x.member_id, x.display_name)); return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1])); }, [t.data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (t.loading && !t.data) return <div className="pg"><Loading what="Loading tasks" /></div>;
  if (t.error) return <div className="pg"><ErrorBox error={t.error} retry={t.reload} /></div>;
  const open = L.filter(x => x.status === 'open'), back = open.filter(x => x.due_date < today), tod = open.filter(x => x.due_date === today), up = open.filter(x => x.due_date > today), done = L.filter(x => x.status !== 'open');
  const shiftAll = T.filter(x => x.due_date <= today), shiftDone = shiftAll.filter(x => x.status !== 'open').length;
  const cnt = k => T.filter(F[k]).filter(x => x.status === 'open').length;
  const run = async (fn, msg) => { setBusy(true); try { await fn(); say(msg); t.reload(); bump(); } catch (e) { say('Not saved: ' + e.message); } finally { setBusy(false); } };
  const complete = x => run(() => api.post(`/portal/tasks/${x.task_id}/complete`, { nurse_id: user.user_id }), x.task_kind === 'nba' ? 'Done · gap Reported, verify in claims' : 'Task done');
  const book = (x, d) => run(() => api.post(`/portal/tasks/${x.task_id}/book`, { booking_date: d, nurse_id: user.user_id }), `Booked for ${fmtDay(d)} · gap Scheduled`);
  const row = x => <TaskRow key={x.task_id} x={x} today={today} busy={busy} onDone={complete} onBook={book} onOpen={y => nav(`/member/${y.member_id}`)} />;
  const list = (k, items, empty, cap = 40) => { const S = [...items].sort(sortD), shown = more[k] ? S : S.slice(0, cap); return <div className="tlist">{S.length ? shown.map(row) : <p className="muted small" style={{ margin: 0 }}>{empty}</p>}{S.length > cap ? <button className="btn btn-sec btn-sm" style={{ alignSelf: 'center' }} onClick={() => setMore(m => ({ ...m, [k]: !m[k] }))}>{more[k] ? 'Show less' : `Show all ${S.length}`}</button> : null}</div>; };

  const head = <>
    <div className="pgh"><h1>Actions</h1><div className="leg"><span><i className="ag" />Agreed with the member</span><span><i className="nag" />Not agreed yet · suggested or retry</span></div>
      <div className="shift">Shift · <b>{shiftDone}</b> of {shiftAll.length} done<span className="tr"><i style={{ width: (shiftAll.length ? shiftDone / shiftAll.length * 100 : 0) + '%' }} /></span></div></div>
    <div className="ktiles"><Tile k n={back.length} label="Backlog · overdue" cls="crit" /><Tile k n={tod.length} label="Today" cls="info" /><Tile k n={up.length} label="Upcoming" cls="neu" /><Tile k n={done.length} label="Done" cls="ok" /></div>
    <div className="bar2"><div className="segc" role="group" aria-label="View">{[['calendar', 'Calendar'], ['list', 'List']].map(([k, l]) => <button key={k} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>)}</div>
      <div className="chips">{FILTERS.map(([k, l]) => <button key={k} className="chip lg" aria-pressed={f === k} onClick={() => setF(k)}>{l} <span className="c">{cnt(k)}</span></button>)}
        <button className="chip lg" aria-pressed={mine} onClick={() => setMine(!mine)} title="Show only tasks assigned to me, or the whole care team">Only my tasks · {first(user.name)}</button></div>
      <select className="inp" value={mem} onChange={e => setMem(e.target.value)} aria-label="Member" style={{ marginLeft: 'auto', width: 220 }}><option value="">All members</option>{members.map(([id, n]) => <option key={id} value={id}>{n} · {id}</option>)}</select></div></>;
  let body;
  if (view === 'list') {
    const grp = (k, title, items, cls, empty) => <section className="panel lsec" key={k}><div className="ph"><h2 style={{ fontSize: 16 }}>{title} <span className={'cnt ' + cls}>{items.length}</span></h2></div>{list(k, items, empty)}</section>;
    const fresh = open.filter(x => x.parent_action_id);
    body = <>{fresh.length ? grp('fresh', 'From calls', fresh, '', '') : null}{grp('back', 'Backlog · overdue', back, 'crit', 'Nothing overdue.')}{grp('tod', 'Today', tod, '', 'Nothing due today.')}{grp('up', 'Upcoming', up, 'neu', 'Nothing scheduled.')}{grp('done', 'Done', done, 'neu', 'Nothing done yet.')}</>;
  } else {
    const base = new Date(today + 'T12:00:00'); base.setDate(1); base.setMonth(base.getMonth() + calM); const y = base.getFullYear(), mo = base.getMonth();
    const first0 = (new Date(y, mo, 1).getDay() + 6) % 7, days = new Date(y, mo + 1, 0).getDate(); const ds = d => `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; const sel = calDay || today;
    const cells = [];
    for (let i = 0; i < first0; i++) cells.push(<div key={'p' + i} className="cd pad" />);
    for (let d = 1; d <= days; d++) {
      const s = ds(d), its = L.filter(x => x.due_date === s).sort(sortD), late = its.some(x => x.status === 'open' && s < today), wk = ((first0 + d - 1) % 7) >= 5;
      cells.push(<button key={s} className={'cd' + (s === today ? ' today' : '') + (s === sel ? ' sel' : '') + (s < today ? ' past' : '') + (late ? ' late' : '') + (wk ? ' wknd' : '')} onClick={() => setCalDay(s)} aria-label={`${fmtDay(s)}, ${its.length} tasks`}><span className="dn">{d}</span>
        {its.slice(0, 3).map(x => <span key={x.task_id} className={'cev ' + (x.status !== 'open' ? 'done' : s < today ? 'late' : isAgreed(x) ? 'ag' : 'nag')} title={`${x.display_name} · ${x.title}`}>{initials(x.display_name)} · {x.title}</span>)}{its.length > 3 ? <span className="more">+{its.length - 3} more</span> : null}</button>);
    }
    const dayL = L.filter(x => x.due_date === sel);
    body = <div className="calwrap"><section className="calc"><div className="calh"><button className="round" onClick={() => setCalM(m => m - 1)} aria-label="Previous month"><Icon name="left" /></button><h3>{base.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3><button className="round" onClick={() => setCalM(m => m + 1)} aria-label="Next month"><Icon name="right" /></button>{calM || calDay ? <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setCalM(0); setCalDay(null); }}>Today</button> : null}</div>
      <div className="cgrid">{['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => <div key={d} className="ch">{d}</div>)}{cells}</div></section>
      <div className="cside"><section className="panel"><div className="ph"><h2>{sel === today ? 'Today' : fmtDay(sel)} <span className="cnt">{dayL.length}</span></h2></div>{list('day' + sel, dayL, 'Nothing on this day.', 12)}</section>
        <section className="panel"><div className="ph"><h2>Backlog · overdue <span className="cnt crit">{back.length}</span></h2></div>{list('backside', back, 'Nothing overdue.', 12)}</section></div></div>;
  }
  return <div className="pg">{head}{body}</div>;
}
