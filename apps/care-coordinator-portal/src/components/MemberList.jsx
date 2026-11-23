import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks.js';
import { useCall } from '../callStore.js';
import Icon from '../icons.jsx';
import { Ring, Tag } from './Bits.jsx';
import { ALERT_TAG, daysFrom, genderWord, titleCase } from '../util.js';

const LISTS = [['today', 'Today'], ['queued', 'Queued'], ['scheduled', 'Scheduled'], ['nudge', 'Nudges']];
const short = (iso, today) => { if (!iso) return '—'; const d = daysFrom(iso, today); return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d > 1 ? `In ${d} d` : `${-d} d late`; };

function Card({ x, sel, today, onPick }) {
  const [call] = useCall(x.member_id);
  const late = x.due_by && x.due_by < today;
  return <button className="mc" onClick={() => onPick(x.member_id)} aria-current={sel === x.member_id}>
    <Ring v={x.total_risk_score} colour={x.alert_colour} size={40} />
    <span className="who"><span className="nm">{x.display_name}</span><span className="dm">{x.age}, {genderWord(x.gender)}, {titleCase(x.nationality)} · {x.member_id}</span>
      <span className="tg">{call.saved ? <Tag cls="t-ok">Outcome saved</Tag> : call.st === 'live' ? <Tag cls="t-ok">On call</Tag> : null}<Tag cls={ALERT_TAG[x.alert_colour] || 't-neu'} title={x.current_needs || ''}>{(x.action_title || '').replace(/^P\d call: /, '')}</Tag>
        {x.consent_status === 'granted' ? <Tag cls="t-ok">Consent on file</Tag> : x.campaign_name ? <Tag cls="t-acc" title={`Campaign ${x.campaign_id}`}>{x.campaign_name}</Tag> : null}</span></span>
    <span className={'wt' + (late ? ' late' : '')}><b>{short(x.due_by, today)}</b>{x.contact_priority}{x.safety_flag ? ' · ⚑' : ''}</span>
  </button>;
}

/** "Flagged members": the nurse's worklist in rulebook order (worklist ⋈ member_risk_result ⋈ member_alert ⋈ action). */
export default function MemberList({ wl, sel, mode }) {
  const nav = useNavigate(); const { today } = useApp();
  const [status, setStatus] = useState('today'); const [q, setQ] = useState(''); const [touched, setTouched] = useState(false);
  const all = wl.data ? wl.data.items : [];
  useEffect(() => { if (touched || !sel) return; const it = all.find(i => i.member_id === sel); if (it && it.list_status !== status) setStatus(it.list_status); }, [wl.data, sel]); // eslint-disable-line
  const counts = useMemo(() => Object.fromEntries(LISTS.map(([k]) => [k, all.filter(i => i.list_status === k).length])), [wl.data]); // eslint-disable-line
  const t = q.trim().toLowerCase();
  const vis = all.filter(i => i.list_status === status).filter(i => !t || `${i.display_name} ${i.member_id} ${i.current_needs} ${i.action_title}`.toLowerCase().includes(t));
  const pick = id => nav(`/member/${id}${mode === '360' ? '/360' : ''}`);
  return <aside className="list" aria-label="Flagged members">
    <div className="lh"><button className="round" onClick={() => { setQ(''); setStatus('today'); setTouched(true); }} aria-label="Clear search and filters"><Icon name="back" /></button><h2>Flagged members</h2><span className="n">{vis.length}</span></div>
    <label className="search"><Icon name="usearch" /><span className="sr">Search</span><input id="q" value={q} onChange={e => setQ(e.target.value)} placeholder="Search member name and ID" autoComplete="off" /></label>
    <div className="chips" role="group" aria-label="Filter by list">
      {LISTS.map(([k, l]) => <button key={k} className="chip" aria-pressed={status === k} onClick={() => { setStatus(k); setTouched(true); }}>{l} <span className="c">{counts[k] || 0}</span></button>)}
    </div>
    <div className="cards">{wl.loading && !wl.data ? <div className="empty">Loading your queue…</div> : wl.error ? <div className="empty">Could not load the queue. {wl.error.message}</div>
      : vis.length ? vis.map(x => <Card key={x.member_id} x={x} sel={sel} today={today} onPick={pick} />) : <div className="empty">{t ? 'No members match this search.' : 'Nothing waiting here.'}</div>}</div>
  </aside>;
}
