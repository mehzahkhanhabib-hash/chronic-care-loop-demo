import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApi, useUser, useToast } from '../hooks.js';
import { Loading, ErrorBox, Tile } from '../components/Bits.jsx';
import { KIND_LABEL, KIND_CLS, fmtDay, relDay } from '../util.js';

const FILTERS = [['all', 'All'], ['nba', 'Care plan'], ['follow_up', 'Follow-ups'], ['call', 'Calls'], ['escalation', 'Escalations'], ['nudge', 'Nudges']];
/** Actions page: the task table (a projection of action rows). Tick = POST /portal/tasks/:id/complete · date = POST /portal/tasks/:id/book. */
export default function Tasks() {
  const { user } = useUser(); const say = useToast(); const nav = useNavigate();
  const [mine, setMine] = useState(true); const [f, setF] = useState('all'); const [view, setView] = useState('list'); const [calM, setCalM] = useState(0); const [calDay, setCalDay] = useState(null); const [busy, setBusy] = useState(false);
  const health = useApi('/health');
  const today = health.data ? health.data.run_date : '2026-11-20';
  const t = useApi(`/portal/tasks${mine ? `?nurse_id=${user.user_id}` : ''}`, [mine]);
  const members = useApi('/members?limit=500');
  const L = useMemo(() => (t.data || []).filter(x => f === 'all' || x.task_kind === f), [t.data, f]);
  const open = L.filter(x => x.status === 'open'), back = open.filter(x => x.due_date < today), tod = open.filter(x => x.due_date === today), up = open.filter(x => x.due_date > today), done = L.filter(x => x.status !== 'open');
  const cnt = k => (t.data || []).filter(x => (k === 'all' || x.task_kind === k) && x.status === 'open').length;
  const run = async (fn, msg) => { setBusy(true); try { await fn(); say(msg); t.reload(); } catch (e) { say('Not saved: ' + e.message); } finally { setBusy(false); } };
  const complete = x => run(() => api.post(`/portal/tasks/${x.task_id}/complete`, { nurse_id: user.user_id }), x.task_kind === 'nba' ? 'Done · gap Reported, verify in claims' : 'Task done');
  const book = (x, d) => d && run(() => api.post(`/portal/tasks/${x.task_id}/book`, { booking_date: d, nurse_id: user.user_id }), 'Booked · gap Scheduled');
  if (t.loading && !t.data) return <Loading what="Loading tasks" />;
  if (t.error) return <ErrorBox error={t.error} retry={t.reload} />;
  const line = (x, full) => <div key={x.task_id} className={'task ' + (KIND_CLS[x.task_kind] || '') + (x.status !== 'open' ? ' done' : '') + (x.status === 'open' && x.due_date < today ? ' late' : '')}>
    <button className="tk" onClick={() => x.status === 'open' && complete(x)} disabled={busy || x.status !== 'open'} aria-pressed={x.status !== 'open'} title={x.status !== 'open' ? x.status : 'Mark done'}>{x.status !== 'open' ? '✓' : ''}</button>
    <div className="tb"><b>{x.title}</b><small>{x.display_name} <span className="mono">{x.member_id}</span> · <span className={'kchip ' + (KIND_CLS[x.task_kind] || '')}>{KIND_LABEL[x.task_kind] || x.task_kind}</span>{x.trigger_code ? ` ${x.trigger_code} · ${x.slot} · ${x.gap_state}` : ''}{x.assignee_name ? ` · ${x.assignee_name}` : ''}{x.booking_date ? ` · booked ${fmtDay(x.booking_date)}` : ''}</small></div>
    {full ? <label className="tf" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>Book<input type="date" min={today} defaultValue={x.booking_date || ''} onChange={e => book(x, e.target.value)} disabled={x.status !== 'open' || busy} style={{ width: 150, padding: '4px 6px' }} /></label> : null}
    <span className="tw"><b className={x.status === 'open' && x.due_date < today ? 'late' : ''}>{relDay(x.due_date, today)}</b><br /><small>{fmtDay(x.due_date)}</small></span>
    <button className="btn sm ghost" onClick={() => nav(`/member/${x.member_id}/call`)}>Open</button>
  </div>;
  const grp = (title, list, cls, empty) => <section className="card" key={title}><div className="card-h"><h3>{title}</h3><span className={'pill ' + cls}>{list.length}</span></div><div className="card-b tlist">{list.length ? [...list].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).map(x => line(x, true)) : <p className="muted" style={{ fontSize: 12 }}>{empty}</p>}</div></section>;
  let body;
  if (view === 'list') body = <>{grp('Backlog · overdue', back, 'crit', 'Nothing overdue.')}{grp('Today · ' + fmtDay(today), tod, 'acc', 'Nothing due today.')}{grp('Upcoming', up, 'line', 'Nothing scheduled yet.')}{done.length ? grp('Done', done.slice(0, 40), 'ok', '') : null}</>;
  else {
    const base = new Date(today + 'T00:00:00'); base.setDate(1); base.setMonth(base.getMonth() + calM); const y = base.getFullYear(), mo = base.getMonth();
    const first0 = (new Date(y, mo, 1).getDay() + 6) % 7, days = new Date(y, mo + 1, 0).getDate(); const ds = d => `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; const sel = calDay || today;
    const cells = [];
    for (let i = 0; i < first0; i++) cells.push(<div key={'p' + i} className="cd pad" />);
    for (let d = 1; d <= days; d++) { const s = ds(d), its = L.filter(x => x.due_date === s); cells.push(<button key={s} className={'cd' + (s === today ? ' today' : '') + (s === sel ? ' sel' : '') + (its.some(x => x.status === 'open' && s < today) ? ' late' : '')} onClick={() => setCalDay(s)}><span className="dn">{d}</span>{its.slice(0, 3).map(x => <span key={x.task_id} className={'ce ' + (KIND_CLS[x.task_kind] || '')}>{x.display_name.split(' ')[0]} · {x.title.replace(/ · .*$/, '')}</span>)}{its.length > 3 ? <span className="more">+{its.length - 3} more</span> : null}</button>); }
    const dayL = L.filter(x => x.due_date === sel);
    body = <div className="calwrap"><section className="card cal"><div className="card-h"><button className="btn sm ghost" onClick={() => setCalM(m => m - 1)}>‹</button><h3>{base.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3><button className="btn sm ghost" onClick={() => setCalM(m => m + 1)}>›</button>{calM ? <button className="btn sm" onClick={() => setCalM(0)}>This month</button> : null}</div><div className="card-b"><div className="cgrid">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="ch">{d}</div>)}{cells}</div></div></section>
      <div className="cal-side"><section className="card"><div className="card-h"><h3>{sel === today ? 'Today' : fmtDay(sel)}</h3><span className="pill acc">{dayL.length}</span></div><div className="card-b tlist">{dayL.length ? dayL.map(x => line(x, false)) : <p className="muted" style={{ fontSize: 12 }}>No tasks on this day.</p>}</div></section></div></div>;
  }
  return <div className="scroll pad"><div className="pg-in">
    <div className="tiles"><Tile n={back.length} label="Backlog · overdue" cls="crit" /><Tile n={tod.length} label="Today" cls="acc" /><Tile n={up.length} label="Upcoming" cls="info" /><Tile n={done.length} label="Done" cls="ok" /></div>
    <div className="act-bar"><div className="segctl">{[['list', 'List'], ['calendar', 'Calendar']].map(([k, l]) => <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l}</button>)}</div>
      <div className="chips">{FILTERS.map(([k, l]) => <button key={k} className={'chip' + (f === k ? ' on' : '')} onClick={() => setF(k)}>{l} · {cnt(k)}</button>)}</div>
      <label className="chip-ck" style={{ marginLeft: 'auto' }}><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> Only my tasks ({user.name.split(' ')[0]})</label></div>
    {body}
  </div></div>;
}
