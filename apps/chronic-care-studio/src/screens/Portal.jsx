import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { Loading, ErrorBox, Empty, Chip, Avatar, Card, Section } from '../components/ui';
import CarePlanCard from '../components/CarePlanCard';
import { dateShort, dateTime, SLA_TEXT } from '../lib/format';

/* Screen 3 · Care portal. Studio_7 shows the Care Coordinator Portal full-bleed under the Studio header; this screen embeds the real portal app
   (dev: http://localhost:3001, production: /portal) and adds one slim strip: nurse, list tabs, ranked call list, open-in-portal link, and a
   Studio summary (care plan + timeline) for when the portal app is not running. Data: GET /api/users, GET /api/portal/worklist. */
const DEV = process.env.NODE_ENV !== 'production';
const PORTAL_BASE = DEV ? 'http://localhost:3001' : '/portal';
const PROBE = DEV ? '/__portal/' : '/portal/';   // same-origin in both modes (dev: proxied by the Studio dev server)
const LISTS = [['today', 'Today'], ['queued', 'Queued'], ['scheduled', 'Scheduled'], ['nudge', 'Nudges']];
const ALC = { RED: ['#FDE7E7', '#B3261E'], AMBER: ['#FFF1C7', '#8A5A00'], YELLOW: ['#DCF1F7', '#133F70'], GREEN: ['#DFF3EA', '#13704B'] };
const pill = a => (a ? { background: '#0B2E57', color: '#FFFFFF' } : { background: 'transparent', color: '#3E525D' });
const BTN = { border: '1px solid #DCE6EB', borderRadius: 999, padding: '8px 14px', background: '#FFFFFF', color: '#10202A', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none' };

/** Is the portal app answering? Asked through a same-origin URL so the answer is readable: 200 when it is up, a proxy error or 404 when it is not. */
function usePortalUp() {
  const [up, setUp] = useState(null); const [n, setN] = useState(0);
  useEffect(() => { let dead = false; setUp(null);
    fetch(PROBE, { headers: { accept: 'text/html' } }).then(r => { if (!dead) setUp(r.ok); }).catch(() => { if (!dead) setUp(false); });
    return () => { dead = true; }; }, [n]);
  return [up, () => setN(x => x + 1)];
}

export default function Portal() {
  const { memberId } = useParams(); const nav = useNavigate();
  const users = useApi('/users');
  const nurses = useMemo(() => (users.data || []).filter(u => u.daily_capacity !== null && u.daily_capacity !== undefined), [users.data]);
  const [nurse, setNurse] = useState('');
  const [status, setStatus] = useState('today');
  useEffect(() => { if (!nurse && nurses.length) setNurse(nurses[0].user_id); }, [nurses, nurse]);
  const wl = useApi(nurse ? `/portal/worklist?nurse_id=${nurse}&status=${status}` : null);
  const all = useApi(nurse ? `/portal/worklist?nurse_id=${nurse}` : null);
  const [up, retry] = usePortalUp();
  const [wantSummary, setWantSummary] = useState(false);
  const [listOpen, setListOpen] = useState(null);
  const summary = wantSummary || up === false;
  const showList = listOpen === null ? summary : listOpen;
  const counts = useMemo(() => { const c = {}; (all.data ? all.data.items : []).forEach(i => { c[i.list_status] = (c[i.list_status] || 0) + 1; }); return c; }, [all.data]);
  const items = wl.data ? wl.data.items : [];
  const sel = memberId || (summary && items[0] ? items[0].member_id : null);
  const selItem = (all.data ? all.data.items : []).find(i => i.member_id === sel);
  const nurseObj = nurses.find(n => n.user_id === nurse);
  const src = sel ? `${PORTAL_BASE}/#/member/${sel}` : `${PORTAL_BASE}/`;
  return (
    <div data-screen-label="Care portal" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 69px)', minHeight: 560, background: '#EEF7FA' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 24px', background: '#FFFFFF', borderBottom: '1px solid #DCE6EB' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0A6F96', whiteSpace: 'nowrap' }}>Step 3 · Care portal</span>
        {users.loading ? <span style={{ fontSize: 13, color: '#566A74' }}>Loading the care team…</span> : users.error ? <ErrorBox error={users.error} retry={users.reload} what="the care team" />
          : <select value={nurse} onChange={e => { setNurse(e.target.value); nav('/portal'); }} aria-label="Nurse" style={{ border: '1px solid #DCE6EB', borderRadius: 12, padding: '8px 10px', fontSize: 13.5, background: '#FFFFFF', color: '#10202A', fontWeight: 600, maxWidth: 280 }}>{nurses.map(u => <option key={u.user_id} value={u.user_id}>{u.name} · {u.role}</option>)}</select>}
        <div role="tablist" aria-label="Call list" style={{ display: 'flex', background: '#EBF1F4', borderRadius: 12, padding: 3 }}>
          {LISTS.map(([k, l]) => <button key={k} role="tab" aria-selected={status === k} onClick={() => { setStatus(k); setListOpen(true); }} style={{ border: 0, borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', ...pill(status === k) }}>{l} · {all.data ? counts[k] || 0 : '…'}</button>)}
        </div>
        <button onClick={() => setListOpen(!showList)} aria-pressed={showList} style={BTN}>{showList ? 'Hide call list' : 'Show call list'}</button>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#566A74', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selItem ? `#${selItem.nurse_rank} · ${selItem.display_name} · ${sel} · ${selItem.action_title}` : sel ? `Member ${sel}` : nurseObj ? `${nurseObj.name} · speaks ${nurseObj.languages} · capacity ${nurseObj.daily_capacity} a day` : ''}</span>
        <a href={src} target="_blank" rel="noreferrer" style={BTN}>Open in the portal ↗</a>
        <button onClick={() => setWantSummary(s => !s)} disabled={up === false} style={{ ...BTN, opacity: up === false ? 0.45 : 1 }}>{summary ? 'Show the portal' : 'Summary'}</button>
      </div>
      {up === false && <div role="status" style={{ flex: 'none', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '10px 24px', background: '#FFF1C7', color: '#8A5A00', fontSize: 13.5 }}>
        <span style={{ flex: 1, minWidth: 220 }}><b>The Care Coordinator Portal is not answering on {PORTAL_BASE}.</b> Showing the Studio summary from the same database instead. Start the portal with <span className="mono">npm run dev</span>, then retry.</span>
        <button onClick={retry} style={{ ...BTN, borderColor: '#8A5A00', background: 'transparent', color: '#8A5A00' }}>Retry</button>
      </div>}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {showList && <aside aria-label="Ranked call list" style={{ flex: '0 0 340px', minWidth: 0, background: '#FFFFFF', borderRight: '1px solid #DCE6EB', overflow: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {nurseObj && <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px 10px' }}><Avatar text={nurseObj.name.split(' ').map(w => w[0]).join('')} size="sm" /><div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14.5 }}>{nurseObj.name}</div><div style={{ fontSize: 12.5, color: '#566A74' }}>{nurseObj.role} · {LISTS.find(l => l[0] === status)[1]} · in rule order</div></div></div>}
          {wl.loading && <Loading what="Loading the worklist" />}
          {wl.error && <ErrorBox error={wl.error} retry={wl.reload} what="the worklist" />}
          {wl.data && !items.length && <Empty>Nothing in “{LISTS.find(l => l[0] === status)[1]}” for this nurse.</Empty>}
          {items.map(i => { const a = sel === i.member_id, C = ALC[i.alert_colour] || ALC.GREEN; return <button key={i.member_id} className={a ? '' : 'hov-row2'} onClick={() => nav(`/portal/${i.member_id}`)} style={{ display: 'grid', gridTemplateColumns: '26px minmax(0,1fr) auto', gap: 10, alignItems: 'center', textAlign: 'left', border: 0, borderRadius: 12, padding: '10px 10px', cursor: 'pointer', background: a ? '#BCE7F2' : '#FFFFFF', color: '#10202A' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#566A74', textAlign: 'center' }}>{i.nurse_rank}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.display_name} <span style={{ fontSize: 12, fontWeight: 600, color: '#566A74' }}>{i.member_id}</span></span>
              <span style={{ display: 'block', fontSize: 12.5, color: '#566A74', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.current_needs || i.action_title || '—'}</span>
              <span style={{ display: 'inline-block', marginTop: 4, fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: C[0], color: C[1], whiteSpace: 'nowrap' }}>{i.contact_priority} · tier {i.tier}{i.attempt > 1 ? ` · attempt ${i.attempt}` : ''} · consent {i.consent_status}</span>
            </span>
            <span style={{ textAlign: 'right' }}><span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{dateShort(i.due_by)}</span><span style={{ fontSize: 11.5, color: '#566A74' }}>due</span></span>
          </button>; })}
        </aside>}
        {summary
          ? <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>{sel ? <Fallback id={sel} /> : wl.loading || !nurse ? <Loading what="Loading the worklist" /> : <Card><Empty>Select a member from the call list.</Empty></Card>}</div>
          : up === null ? <div style={{ flex: 1, padding: 24 }}><Loading what="Opening the Care Coordinator Portal" /></div>
            : <iframe key={sel || 'home'} title="Care Coordinator Portal" src={src} style={{ flex: 1, minWidth: 0, display: 'block', width: '100%', height: '100%', border: 0, background: '#EEF7FA' }} />}
      </div>
    </div>
  );
}

/** Studio summary of one member, read from the same API the portal uses. */
function Fallback({ id }) {
  const m = useApi(`/members/${id}`); const risk = useApi(`/members/${id}/risk`); const cp = useApi(`/members/${id}/care-plan`); const tl = useApi(`/members/${id}/timeline`); const tasks = useApi(`/members/${id}/tasks`);
  if (m.loading) return <Loading what="Loading the member" />;
  if (m.error) return <ErrorBox error={m.error} retry={m.reload} what="the member" />;
  const d = m.data; const idn = d.identity || {}; const r = d.risk;
  const open = (tasks.data || []).filter(t => t.status === 'open');
  return <>
    <Card style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <Avatar text={idn.initials} size="lg" /><div style={{ flex: 1, minWidth: 220 }}><div style={{ fontSize: 24, fontWeight: 700 }}>{idn.display_name} <span className="sm mut mono">{id}</span></div><div className="sm" style={{ color: 'var(--ink2)' }}>{idn.age} · {idn.gender === 'F' ? 'female' : 'male'} · speaks {idn.language} · {idn.policy_type} plan · {idn.pathway} · consent <b>{d.consent_status}</b>{d.assignment ? ` · nurse ${d.assignment.nurse_name}` : ''}</div></div>
      {r && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Chip kind={'t' + r.tier}>Tier {r.tier} · {r.tier_label} · R {r.total_risk_score}/23</Chip>{r.alert && <Chip kind={r.alert.alert_colour}>{r.alert.alert_colour}</Chip>}{r.alert && <Chip kind={r.alert.contact_priority}>{SLA_TEXT[r.alert.contact_priority]}</Chip>}</div>}
    </Card>
    <CarePlanCard cp={cp} risk={risk.data} />
    <Section title="Open tasks" aside={tasks.data ? String(open.length) : ''}>
      {tasks.loading ? <Loading /> : tasks.error ? <ErrorBox error={tasks.error} /> : !open.length ? <Empty>No open tasks.</Empty> : <table className="tbl"><thead><tr><th>Due</th><th>Kind</th><th>Task</th><th>Assignee</th></tr></thead><tbody>{open.map(t => <tr key={t.task_id}><td>{dateShort(t.due_date)}</td><td>{t.task_kind}</td><td>{t.title}</td><td>{t.assignee_name || t.assignee || '—'}</td></tr>)}</tbody></table>}
    </Section>
    <Section title="Timeline" aside="consent · calls · dispositions · gap transitions">
      {tl.loading ? <Loading /> : tl.error ? <ErrorBox error={tl.error} /> : !tl.data.length ? <Empty>No nurse activity yet for this member.</Empty> : <ul className="timeline" style={{ listStyle: 'none', margin: 0, padding: 0 }}>{tl.data.slice(0, 40).map((e, i) => <li key={i}><span className="mut">{dateTime(e.at)}</span><Chip>{e.type}</Chip><span>{e.text}{e.by ? <span className="mut"> · {e.by}</span> : null}</span></li>)}</ul>}
    </Section>
  </>;
}
