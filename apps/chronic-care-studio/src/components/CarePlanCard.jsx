import React, { useState } from 'react';
import { Loading, ErrorBox, Empty } from './ui';
import { dateShort } from '../lib/format';

/** Care plan card with two views behind a segmented toggle.
 *  “Current · Next · Future” (default) is the board below; “In order” is the Studio_7 numbered list: number, class pill, next best action, why · rule ref, status; the top three (CURRENT) go to the nurse.
 *  “Current · Next · Future” is the Care Coordinator Portal's Care plan tab (CCC Rulebook §2–§5):
 *  Current / Next / Future columns of needs (class pill, due, next best action, owner, done-when, rule ref, action line),
 *  closed pills, the care-gap lifecycle Potential → Verified → Scheduled → Reported → Closed, and the tier cadence strip.
 *  Data: GET /api/members/:id/care-plan (care_need + action + rule_action) and GET /api/members/:id/risk (tier, rule_tier.cadence_days). */
const GAPS = ['Potential', 'Verified', 'Scheduled', 'Reported', 'Closed'];
const CLS = { safety: ['Safety', '#FDE7E7', '#B3261E'], acute: ['Acute', '#FFF1C7', '#8A5A00'], unctl: ['Uncontrolled', '#FFF1C7', '#8A5A00'], barrier: ['Barrier', '#DDF1F8', '#0A6F96'], gap: ['Care gap', '#DDF1F8', '#0A6F96'], goal: ['Goal', '#DFF3EA', '#13704B'] };
const CAD_LABEL = { 0: 'Base', 7: 'W1', 14: 'W2', 21: 'W3', 28: 'W4', 42: 'W6', 56: 'M2', 60: 'M2', 84: 'M3', 90: 'M3', 112: 'M4', 120: 'M4', 150: 'M5', 180: 'M6', 210: 'M7', 270: 'M9', 365: 'M12' };
const dueText = (iso, runDate) => { if (!iso) return ''; if (!runDate) return dateShort(iso); const d = Math.round((Date.parse(iso) - Date.parse(runDate)) / 864e5); return d <= 0 ? 'Today' : `In ${d} day${d === 1 ? '' : 's'}`; };

/** Status text of one need in the ordered list (care_need.slot / status / gap_state). */
const orderStatus = n => (n.status === 'declined' ? ['Declined · again in 90 d', '#8A5A00']
  : n.status === 'done' ? (n.gap_state === 'Closed' ? ['✓ Closed in claims', '#0A6F96'] : ['↩ Done · confirm in claims', '#0A6F96'])
  : n.status !== 'open' ? [n.status, '#8A5A00']
  : n.slot === 'CURRENT' ? ['For nurse', '#566A74'] : ['Waiting', '#566A74']);
const VIEWS = [['slots', 'Current · Next · Future'], ['order', 'In order']];

export default function CarePlanCard({ cp, risk, runDate, title = 'Care plan', dense }) {
  const [view, setView] = useState('slots');
  if (cp.loading) return <section className="card cpv"><Loading what="Loading the care plan" /></section>;
  if (cp.error) return <section className="card cpv"><ErrorBox error={cp.error} retry={cp.reload} what="the care plan" /></section>;
  const needs = cp.data ? cp.data.needs : [];
  const col = (label, L) => <div className="cn" key={label}>
    <div className="cn-h"><b>{label}</b><span className="mono">{L.length}</span></div>
    {L.map(n => { const K = CLS[n.need_class] || ['Need', '#DDF1F8', '#0A6F96']; const cur = n.slot === 'CURRENT'; const a = n.action;
      return <div className="nd" key={n.need_id}>
        <div className="nd-h"><span className="chip" style={{ background: K[1], color: K[2] }}>{n.class_label || K[0]}</span><span className="mono mut" style={{ fontSize: 11 }}>{dueText(n.due_date, runDate)}</span></div>
        <b>{n.next_best_action}</b>
        <div className="nd-m"><span title="Owner">👤 {n.action_owner}</span><span title="Done when">✓ {n.done_when}</span><span className="mono">{n.trigger_code} · {n.need}</span></div>
        <div className="nd-l"><span>{cur ? (a ? `↳ Action · ${a.kind === 'follow_up' ? a.title : 'for the nurse'}${a.assignee ? ' · ' + a.assignee : ''}` : '↳ Action · for the nurse') : 'Becomes an action when it reaches Current'}</span><span style={{ fontWeight: 700, color: cur ? '#0A6F96' : '#566A74' }}>{cur ? (n.gap_state === 'Scheduled' ? 'Scheduled' : n.gap_state === 'Verified' ? 'Verified' : 'Current') : n.slot === 'NEXT' ? 'Next' : 'Future'}</span></div>
      </div>; })}
    {!L.length && <div className="em">—</div>}
  </div>;
  const cur = needs.filter(n => n.slot === 'CURRENT'), nxt = needs.filter(n => n.slot === 'NEXT'), fut = needs.filter(n => n.slot === 'FUTURE'), closed = needs.filter(n => n.slot === 'CLOSED');
  const byRank = (a, b) => (a.rank ?? 99) - (b.rank ?? 99);
  const ordered = [...cur, ...nxt, ...fut].sort(byRank).concat(closed.slice().sort(byRank));
  const gaps = needs.filter(n => n.need_class === 'gap' || n.need_class === 'unctl');
  const tier = risk ? risk.tier : (cp.data && cp.data.care_plan ? cp.data.care_plan.tier : null);
  const days = risk && risk.tier_rule && risk.tier_rule.cadence_days ? String(risk.tier_rule.cadence_days).split(',').map(Number) : [];
  const safety = needs.some(n => n.need_class === 'safety' && n.status === 'open');
  const cad = safety ? [[0, 'Event'], [3, 'D3'], [7, 'D7'], [14, 'D14']].concat(days.filter(d => d > 14).map(d => [d, CAD_LABEL[d] || `+${d}`])) : days.map(d => [d, CAD_LABEL[d] || `+${d}`]);
  return <section className="card cpv">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
      <span style={{ fontSize: 15, fontWeight: 700 }}>{view === 'order' ? title + ', in order · safety first' : title}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: '#566A74' }}>{view === 'order' ? 'Top 3 go to the nurse · rest wait their turn' : 'safety → acute → uncontrolled → barrier → gap → goal'}</span>
        <span role="tablist" aria-label="Care plan view" style={{ display: 'flex', background: '#EBF1F4', borderRadius: 12, padding: 3 }}>
          {VIEWS.map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} style={{ border: 0, borderRadius: 999, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', background: view === k ? '#0B2E57' : 'transparent', color: view === k ? '#FFFFFF' : '#3E525D' }}>{l}</button>)}
        </span>
      </span>
    </div>
    {!needs.length ? <Empty>No care plan yet: the member is not in a live campaign, or no rulebook trigger fired.</Empty> : view === 'order' ? <div className="cp-order" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {ordered.map((n, i) => { const K = CLS[n.need_class] || ['Need', '#DDF1F8', '#0A6F96']; const top = n.slot === 'CURRENT'; const st = orderStatus(n);
        return <div key={n.need_id} className="cp-row" title={n.done_when ? `Owner: ${n.action_owner} · done when: ${n.done_when}${n.hold_until ? ' · held until ' + dateShort(n.hold_until) : ''}` : undefined} style={{ display: 'grid', gridTemplateColumns: '28px auto minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '12px 14px', borderRadius: 12, background: top ? '#F3F8FA' : '#FFFFFF', opacity: top ? 1 : 0.6 }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#FFFFFF', border: '1px solid #DCE6EB', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: K[1], color: K[2], whiteSpace: 'nowrap' }}>{n.class_label || K[0]}</span>
          <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{n.next_best_action}</span><span style={{ display: 'block', fontSize: 13.5, color: '#3E525D', lineHeight: 1.5 }}>{n.evidence || n.need} · {n.trigger_code}</span></span>
          <span style={{ fontSize: 12, fontWeight: 700, color: st[1], whiteSpace: 'nowrap' }}>{st[0]}</span>
        </div>; })}
    </div> : <>
      <div className="cns">{col('Current', cur)}{col('Next', nxt)}{col('Future', fut)}</div>
      {closed.length > 0 && <div className="cl">{closed.map(n => <span key={n.need_id} className="chip" style={{ background: n.status === 'done' ? '#DFF3EA' : '#FDE7E7', color: n.status === 'done' ? '#13704B' : '#B3261E' }}>{n.status === 'done' ? '✓ ' : '✕ '}{n.next_best_action}{n.gap_state === 'Reported' ? ' · awaiting claims' : n.hold_until ? ` · held until ${dateShort(n.hold_until)}` : ''}</span>)}</div>}
      {!dense && <div className="cp-g2">
        <div>
          <div className="cph"><h4>Care gaps</h4><span className="mono mut" style={{ fontSize: 11 }}>{gaps.length}</span></div>
          {gaps.map(g => { const s = Math.max(0, GAPS.indexOf(g.gap_state)); return <div className="gl" key={g.need_id}><b>{g.next_best_action}</b><div className="gl-s">{GAPS.map((l, i) => <span key={l} className={i < s ? 'on' : i === s ? 'cur' : ''}>{l}</span>)}</div></div>; })}
          {!gaps.length && <span className="mut sm">None</span>}
        </div>
        <div>
          <div className="cph"><h4>Cadence{tier ? ` · Tier ${tier}` : ''}</h4><span className="mono mut" style={{ fontSize: 11 }}>{safety ? 'event pathway' : risk && risk.tier_rule ? risk.tier_rule.cadence : ''}</span></div>
          <div className="cad">{cad.map(([d, l], i) => <div key={d + l} className={'cdx' + (i === 0 ? ' on' : '')}><i /><b>{l}</b><small>{d === 0 ? 'today' : `+${d} d`}</small></div>)}</div>
        </div>
      </div>}
    </>}
  </section>;
}
