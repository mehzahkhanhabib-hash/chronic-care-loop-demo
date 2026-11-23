import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { Loading, ErrorBox, Empty, Chip, Avatar, Card, Section } from '../components/ui';
import { fmt, dateShort, dateTime, SLA_TEXT } from '../lib/format';

const PORTAL_BASE = window.location.port === '3000' ? 'http://localhost:3001' : '/portal';

export default function Portal() {
  const { memberId } = useParams(); const nav = useNavigate();
  const users = useApi('/users');
  const nurses = useMemo(() => (users.data || []).filter(u => u.daily_capacity !== null && u.daily_capacity !== undefined), [users.data]);
  const [nurse, setNurse] = useState('');
  const [status, setStatus] = useState('today');
  useEffect(() => { if (!nurse && nurses.length) setNurse(nurses[0].user_id); }, [nurses, nurse]);
  const wl = useApi(nurse ? `/portal/worklist?nurse_id=${nurse}&status=${status}` : null);
  const all = useApi(nurse ? `/portal/worklist?nurse_id=${nurse}` : null);
  const sel = memberId || (wl.data && wl.data.items[0] && wl.data.items[0].member_id) || null;
  const [showSummary, setShowSummary] = useState(false);
  const counts = useMemo(() => { const c = { today: 0, queued: 0, scheduled: 0, nudge: 0 }; (all.data ? all.data.items : []).forEach(i => { c[i.list_status] = (c[i.list_status] || 0) + 1; }); return c; }, [all.data]);
  const nurseObj = nurses.find(n => n.user_id === nurse);
  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>
      <div className="pagehead">
        <div><div className="eyebrow">Step 3 · Act</div><h1 className="title">The nurse’s list, in rule order</h1><p className="desc">Safety and RED first, then tier, then campaign priority, then time past the contact SLA (rule_queue_order). Each nurse works her list up to her daily capacity; the rest waits in the queue. Pick a member and the Care Coordinator Portal opens on that member.</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {users.loading ? <Loading what="Loading the care team" /> : users.error ? <ErrorBox error={users.error} retry={users.reload} what="the care team" /> : <select className="sel" value={nurse} onChange={e => { setNurse(e.target.value); nav('/portal'); }} aria-label="Nurse">{nurses.map(u => <option key={u.user_id} value={u.user_id}>{u.name} · {u.role} · {u.languages}</option>)}</select>}
          <div className="seg">{[['today', 'Today'], ['queued', 'Queued'], ['scheduled', 'Scheduled'], ['nudge', 'Nudges']].map(([k, l]) => <button key={k} className={status === k ? 'on' : ''} onClick={() => { setStatus(k); nav('/portal'); }}>{l} · {counts[k] || 0}</button>)}</div>
        </div>
      </div>
      <div className="row">
        <section className="card tight col" style={{ flex: '0 1 420px', minWidth: 320, gap: 4, maxHeight: '82vh', overflow: 'auto', position: 'sticky', top: 120 }}>
          {nurseObj && <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px' }}><Avatar text={nurseObj.name.split(' ').map(w => w[0]).join('')} size="sm" /><div><div style={{ fontWeight: 700 }}>{nurseObj.name}</div><div className="sm mut">{nurseObj.role} · speaks {nurseObj.languages} · capacity {nurseObj.daily_capacity}/day</div></div></div>}
          {wl.loading && <Loading what="Loading the worklist" />}
          {wl.error && <ErrorBox error={wl.error} retry={wl.reload} what="the worklist" />}
          {wl.data && !wl.data.items.length && <Empty>Nothing in “{status}” for this nurse.</Empty>}
          {wl.data && wl.data.items.map(i => <button key={i.member_id} className={'memrow' + (sel === i.member_id ? ' on' : '')} onClick={() => nav(`/portal/${i.member_id}`)}>
            <span style={{ textAlign: 'center' }}><span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--mut)' }}>#{i.nurse_rank}</span><Avatar text={i.initials} size="sm" soft /></span>
            <span style={{ minWidth: 0 }}><span className="nm">{i.display_name}<span className="id">{i.member_id}</span></span><span className="rs">{i.action_title}{i.attempt > 1 ? ` · attempt ${i.attempt}` : ''}</span><span className="rs">{i.current_needs || '—'}</span><span style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}><Chip kind={i.alert_colour}>{i.alert_colour}</Chip><Chip kind={i.contact_priority}>{i.contact_priority}</Chip><Chip kind={'t' + i.tier}>Tier {i.tier}</Chip><Chip>{i.consent_status}</Chip></span></span>
            <span style={{ textAlign: 'right' }}><span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{dateShort(i.due_by)}</span><span className="xs mut">due</span></span>
          </button>)}
        </section>
        <section className="col" style={{ flex: '1 1 640px' }}>
          {!sel && <Card><Empty>Select a member on the left.</Empty></Card>}
          {sel && <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="sm mut">Care Coordinator Portal · member <b className="mono">{sel}</b> · {nurseObj ? nurseObj.name : ''}</span>
              <a className="btn ghost sm" href={`${PORTAL_BASE}/#/member/${sel}`} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', textDecoration: 'none' }}>Open in the portal ↗</a>
              <button className="btn ghost sm" onClick={() => setShowSummary(s => !s)}>{showSummary ? 'Show the portal' : 'Show summary instead'}</button>
            </div>
            {!showSummary && <div className="iframe-wrap"><iframe key={sel} title="Care Coordinator Portal" src={`${PORTAL_BASE}/#/member/${sel}`} /></div>}
            {!showSummary && <div className="xs mut">If the frame stays blank, the portal is not running on {PORTAL_BASE} (start it with <span className="mono">npm run dev</span>) — use “Show summary instead”.</div>}
            {showSummary && <Fallback id={sel} />}
          </>}
        </section>
      </div>
    </div>
  );
}

function Fallback({ id }) {
  const m = useApi(`/members/${id}`); const cp = useApi(`/members/${id}/care-plan`); const tl = useApi(`/members/${id}/timeline`); const tasks = useApi(`/members/${id}/tasks`);
  if (m.loading) return <Loading what="Loading the member" />;
  if (m.error) return <ErrorBox error={m.error} retry={m.reload} what="the member" />;
  const d = m.data; const idn = d.identity || {}; const r = d.risk;
  return <>
    <Card style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <Avatar text={idn.initials} size="lg" /><div style={{ flex: 1, minWidth: 220 }}><div style={{ fontSize: 24, fontWeight: 700 }}>{idn.display_name} <span className="sm mut mono">{id}</span></div><div className="sm" style={{ color: 'var(--ink2)' }}>{idn.age} · {idn.gender} · {idn.language} · {idn.policy_type} · {idn.pathway} · consent <b>{d.consent_status}</b></div></div>
      {r && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Chip kind={'t' + r.tier}>Tier {r.tier} · {r.tier_label} · R {r.total_risk_score}/23</Chip>{r.alert && <Chip kind={r.alert.alert_colour}>{r.alert.alert_colour}</Chip>}{r.alert && <Chip kind={r.alert.contact_priority}>{SLA_TEXT[r.alert.contact_priority]}</Chip>}</div>}
    </Card>
    <Section title="Care plan" aside="CURRENT needs carry one open action each">
      {cp.loading ? <Loading /> : cp.error ? <ErrorBox error={cp.error} /> : !cp.data.needs.length ? <Empty>No needs: this member is not in a live campaign or no trigger fired.</Empty> : <div className="col" style={{ gap: 8 }}>{cp.data.needs.map(n => <div key={n.need_id} className={'plan-row' + (n.slot !== 'CURRENT' ? ' dim' : '')}><span className="i">{n.rank || '·'}</span><Chip kind={n.need_class}>{n.class_label}</Chip><span style={{ minWidth: 0 }}><span className="t">{n.need} <span className="sm mut mono">{n.trigger_code}</span></span><span className="w">{n.next_best_action} · {n.action_owner} · due {dateShort(n.due_date)} · gap {n.gap_state}{n.action ? ` · ${n.action.title} (${n.action.status})` : ''}</span></span><Chip kind={n.slot}>{n.slot}</Chip></div>)}</div>}
    </Section>
    <Section title="Open tasks">
      {tasks.loading ? <Loading /> : tasks.error ? <ErrorBox error={tasks.error} /> : !tasks.data.filter(t => t.status === 'open').length ? <Empty>No open tasks.</Empty> : <table className="tbl"><thead><tr><th>Due</th><th>Kind</th><th>Task</th><th>Assignee</th></tr></thead><tbody>{tasks.data.filter(t => t.status === 'open').map(t => <tr key={t.task_id}><td>{dateShort(t.due_date)}</td><td>{t.task_kind}</td><td>{t.title}</td><td>{t.assignee_name || t.assignee || '—'}</td></tr>)}</tbody></table>}
    </Section>
    <Section title="Timeline" aside="consent · calls · dispositions · gap transitions">
      {tl.loading ? <Loading /> : tl.error ? <ErrorBox error={tl.error} /> : !tl.data.length ? <Empty>No nurse activity yet for this member.</Empty> : <ul className="timeline" style={{ listStyle: 'none', margin: 0, padding: 0 }}>{tl.data.slice(0, 40).map((e, i) => <li key={i}><span className="mut">{dateTime(e.at)}</span><Chip>{e.type}</Chip><span>{e.text}{e.by ? <span className="mut"> · {e.by}</span> : null}</span></li>)}</ul>}
    </Section>
  </>;
}
