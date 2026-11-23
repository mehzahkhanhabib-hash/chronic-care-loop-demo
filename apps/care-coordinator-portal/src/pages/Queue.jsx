import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi, useUser } from '../hooks.js';
import { Loading, ErrorBox, Empty } from '../components/Bits.jsx';
import CallWorkflow from '../components/CallWorkflow.jsx';
import { ALERT_CLS, initials, relDay } from '../util.js';
import Icon from '../icons.jsx';

const TABS = [['today', 'Today'], ['queued', 'Queued'], ['scheduled', 'Scheduled'], ['nudge', 'Nudges']];

export default function Queue() {
  const { user } = useUser();
  const [sp, setSp] = useSearchParams();
  const [tab, setTab] = useState('today'); const [q, setQ] = useState(''); const [min, setMin] = useState(false);
  const wl = useApi(`/portal/worklist?nurse_id=${user.user_id}`);
  const health = useApi('/health');
  const today = health.data ? health.data.run_date : '2026-11-20';
  const items = useMemo(() => (wl.data ? wl.data.items : []).filter(i => i.list_status === tab).filter(i => !q || `${i.display_name} ${i.member_id} ${i.current_needs} ${i.action_title} ${i.top_trigger}`.toLowerCase().includes(q.toLowerCase())), [wl.data, tab, q]);
  const counts = useMemo(() => Object.fromEntries(TABS.map(([k]) => [k, (wl.data ? wl.data.items : []).filter(i => i.list_status === k).length])), [wl.data]);
  const sel = sp.get('m') || (items[0] && items[0].member_id);
  useEffect(() => { if (!sp.get('m') && items[0]) setSp({ m: items[0].member_id }, { replace: true }); }, [items]); // eslint-disable-line
  const pick = id => setSp({ m: id });
  if (wl.loading && !wl.data) return <Loading what="Loading your queue" />;
  if (wl.error) return <ErrorBox error={wl.error} retry={wl.reload} />;
  const qi = x => <button key={x.member_id} className={'qi' + (x.member_id === sel ? ' on' : '')} onClick={() => pick(x.member_id)}>
    <div className="r1"><b>{x.display_name} <span className="mono muted" style={{ fontWeight: 400, fontSize: 11 }}>{x.member_id}</span></b><span className={'w' + (x.due_by < today ? ' breach' : '')} title={`Due ${x.due_by}`}>{relDay(x.due_by, today)}</span></div>
    <span className="rsn">{x.action_title}</span>
    <div className="r3"><span className={'pill ' + (ALERT_CLS[x.alert_colour] || 'line')}>{x.alert_colour} · {x.contact_priority}</span><span className="kv2" title="Rulebook risk score"><i>R</i>{x.total_risk_score}</span><span className="kv2" title="Tier"><i>Tier</i>{x.tier}</span>{x.safety_flag ? <span className="pill crit">⚑</span> : null}{x.consent_status !== 'granted' ? <span className="pill acc">Consent needed</span> : null}</div>
    {x.current_needs ? <small className="muted" style={{ fontSize: 10.5 }}>{x.current_needs}</small> : null}
  </button>;
  return <div className={'qgrid' + (min ? ' qmin' : '')}>
    {min ? <aside className="qlist qslim" aria-label="Queue (collapsed)"><button className="qtog" onClick={() => setMin(false)} title="Expand queue"><Icon name="chevr" /></button><span className="mono qcount">{items.length}</span>
      <div className="qitems">{items.map(x => <button key={x.member_id} className={'qav' + (x.member_id === sel ? ' on' : '')} onClick={() => pick(x.member_id)} title={`${x.display_name} · ${x.action_title}`}><span>{initials(x.display_name)}</span><i className={'risk-dot ' + (ALERT_CLS[x.alert_colour] || 'ok')} /></button>)}</div></aside>
      : <aside className="qlist" aria-label="Queue">
        <div className="qhead">
          <div className="row"><button className="qtog" onClick={() => setMin(true)} title="Collapse queue"><Icon name="chev" /></button><h2>Queue</h2><span className="mono muted">{items.length}</span><span className="muted" style={{ marginLeft: 'auto', fontSize: 11 }}>Rulebook order · {user.name.split(' ')[0]}</span></div>
          <div className="qtabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l} · {counts[k] || 0}</button>)}</div>
          <input id="qsearch" type="search" placeholder="Search name, id, need or action" value={q} onChange={e => setQ(e.target.value)} aria-label="Search queue" />
        </div>
        <div className="qitems">{items.length ? items.map(qi) : <div className="empty">Nothing waiting here.</div>}</div>
      </aside>}
    <main className="work">{sel ? <CallWorkflow memberId={sel} onChanged={wl.reload} /> : <Empty>Queue is clear.</Empty>}</main>
  </div>;
}
