import React, { useMemo, useState } from 'react';
import { useApi, useApp } from '../hooks.js';
import { Loading, ErrorBox, Source } from './Bits.jsx';
import Icon from '../icons.jsx';
import ClaimDrawer from './ClaimDrawer.jsx';
import { daysFrom, dxName, fmtDM, money, moneyK } from '../util.js';

const CAT = { hosp: ['Hospital & ER', 'var(--critical)'], clin: ['Clinics', 'var(--brand-primary)'], lab: ['Labs', '#6A4BC4'], pharm: ['Pharmacy', 'var(--risk-mod)'], team: ['Care team', 'var(--success)'] };
const KIND = { consent: 'Consent', call: 'Call', disposition: 'Decision', assertion: 'Member said', gap: 'Care gap', appointment: 'Appointment', note: 'Note', action: 'Task' };

/**
 * One event model feeds the care map and the Activity list (design).
 * Clinical events: raw claims only (GET /members/:id/claims, lab points from /360) and only after consent (G2).
 * Care-team events: what this portal recorded (GET /members/:id/timeline).
 */
export function useEvents(memberId, granted, timeline, m360) {
  const { today } = useApp();
  const ownT = useApi(timeline ? null : `/members/${memberId}/timeline`);
  const ownX = useApi(!m360 && granted ? `/members/${memberId}/360` : null, [granted]);
  const claims = useApi(granted ? `/members/${memberId}/claims?limit=500` : null, [granted]);
  const T = timeline || ownT, X = m360 || ownX;
  const E = useMemo(() => {
    const out = [];
    if (granted && claims.data) claims.data.rows.forEach(c => {
      const cat = c.bg_ipop === 'IP' || c.admit_desc === 'Emergency' ? 'hosp' : /pharmacy/i.test(c.facility_type || '') ? 'pharm' : 'clin';
      const dx = dxName({ group4: c.diagnosis_desc, diagnosis_id: c.primary_diagnosis_id });
      out.push({ k: 'c' + c.claim_id, d: c.service_date, cat, hl: cat === 'hosp', claim_id: c.claim_id,
        t: cat === 'hosp' ? `${c.bg_ipop === 'IP' ? 'Admission' : 'ER visit'} · ${c.facility_name}` : cat === 'pharm' ? `Pharmacy claim · ${c.facility_name}` : `${c.specialty || c.category || 'Visit'} · ${c.facility_name}`,
        s: cat === 'hosp' ? `${c.los_days ? c.los_days + ' day stay · ' : ''}${dx} · ${money(c.payable)}` : cat === 'pharm' ? `${c.activity_count} line${c.activity_count === 1 ? '' : 's'} · ${money(c.payable)}` : `${dx}${c.clinician_name ? ' · ' + c.clinician_name : ''}` });
    });
    if (granted && X.data) {
      const by = {};
      (X.data.labs || []).forEach(l => (l.points || []).forEach(p => { const key = p.date + '|' + p.claim_id; (by[key] = by[key] || { d: p.date, claim_id: p.claim_id, L: [] }).L.push(`${l.name} ${p.value}${l.unit ? ' ' + l.unit : ''}`); }));
      Object.entries(by).forEach(([key, g]) => out.push({ k: 'l' + key, d: g.d, cat: 'lab', claim_id: g.claim_id, t: g.L.slice(0, 2).join(' · ') + (g.L.length > 2 ? ` +${g.L.length - 2}` : ''), s: `${g.L.length} result${g.L.length === 1 ? '' : 's'} · claim ${g.claim_id}` }));
    }
    (T.data || []).forEach((e, i) => out.push({ k: 'p' + e.type + e.ref + i, d: String(e.at || '').slice(0, 10), at: String(e.at || '').slice(11, 16), cat: 'team', portal: true, call: e.type === 'call', t: e.text, s: `${KIND[e.type] || e.type}${e.by ? ' · ' + e.by : ''}` }));
    return out.sort((a, b) => (b.d + (b.at || '')).localeCompare(a.d + (a.at || '')));
  }, [granted, claims.data, X.data, T.data]);
  return { E, today, loading: (T.loading && !T.data) || (granted && claims.loading && !claims.data), error: T.error || claims.error, payable12: X.data && X.data.utilisation ? (X.data.utilisation.last_12m || {}).payable_12m : null };
}

export function CareMap({ E, today, payable12 }) {
  const base = new Date(today + 'T12:00:00'), months = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(base); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(d.toLocaleDateString('en-GB', { month: 'short' })); }
  const lanes = [['hosp', 'Hospital & ER', e => e.cat === 'hosp'], ['clin', 'Clinics', e => e.cat === 'clin'], ['lab', 'Labs', e => e.cat === 'lab'], ['pharm', 'Pharmacy', e => e.cat === 'pharm'], ['team', 'Care Coordinator Calls', e => e.cat === 'team' && e.call]];
  const x = d => Math.max(1, Math.min(99, (365 + daysFrom(d, today)) / 365 * 100));
  const inWin = e => { const n = daysFrom(e.d, today); return n > -365 && n <= 7; };
  return <div className="c3 cm"><div className="h">Care map · last 12 months <span>{payable12 === null || payable12 === undefined ? '' : moneyK(payable12)} <Source kind="raw_claims" /></span></div>
    <div className="cmap"><span /><div className="mo">{months.map((m, i) => <span key={i}>{m}</span>)}</div>
      {lanes.map(([k, l, f]) => <React.Fragment key={k}><span className="lb"><i style={{ background: CAT[k][1] }} />{l}</span><div className="tr">{E.filter(f).filter(inWin).map(e => <i key={e.k} style={{ left: x(e.d).toFixed(1) + '%', background: CAT[k][1] }} title={`${fmtDM(e.d)} · ${e.t}`} />)}</div></React.Fragment>)}</div></div>;
}

export function Activity({ E, today, granted }) {
  const [f, setF] = useState('all'); const [more, setMore] = useState(false); const [claimId, setClaimId] = useState(null);
  const L = E.filter(e => f === 'all' || e.cat === f), cnt = k => E.filter(e => e.cat === k).length, shown = more ? L : L.slice(0, 24);
  let last = ''; const rows = [];
  shown.forEach(e => {
    const g = e.portal && daysFrom(e.d, today) >= -7 ? 'THIS SHIFT' : new Date(e.d + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    if (g !== last) { rows.push(<div key={'g' + g + rows.length} className="ag-h">{g}</div>); last = g; }
    rows.push(<div key={e.k} className={'av' + (e.hl ? ' hl' : '')}><i style={{ background: CAT[e.cat][1] }} /><div className="at"><b>{e.t}</b><small>{e.s}{e.claim_id ? <> · <button className="link" style={{ fontSize: 11 }} onClick={() => setClaimId(e.claim_id)}>open claim</button></> : null}</small></div><span className="ad">{e.portal && e.at ? `${fmtDM(e.d)} · ${e.at}` : fmtDM(e.d)}</span><span className="ac">{CAT[e.cat][0]}</span></div>);
  });
  return <div className="c3 act"><div className="h">Activity <div className="chips">{[['all', 'All', E.length], ['hosp', 'Hospital & ER', cnt('hosp')], ['clin', 'Clinics', cnt('clin')], ['lab', 'Labs', cnt('lab')], ['pharm', 'Pharmacy', cnt('pharm')], ['team', 'Care Team', cnt('team')]].map(([k, l, n]) => <button key={k} className="chip ac-f" aria-pressed={f === k} onClick={() => setF(k)}>{l} <span className="c">{n}</span></button>)}</div></div>
    {granted ? null : <div className="lockline" style={{ marginBottom: 10 }}><Icon name="lock" /> Claims history (hospital, clinics, labs, pharmacy) stays hidden until the member gives consent · only care-team events are shown</div>}
    <div className="alist">{rows.length ? rows : <p className="muted small">No activity in this category.</p>}</div>
    {L.length > 24 ? <div style={{ textAlign: 'center', paddingTop: 10 }}><button className="btn btn-sec btn-sm" onClick={() => setMore(!more)}>{more ? 'Show less' : `Show all ${L.length}`}</button></div> : null}
    {claimId ? <ClaimDrawer claimId={claimId} onClose={() => setClaimId(null)} /> : null}</div>;
}

/** Timeline tab: care map (after consent) + activity. `mode="360"` shows the activity list only, as in the design. */
export default function Timeline({ memberId, granted, timeline, m360, mode }) {
  const ev = useEvents(memberId, granted, timeline, m360);
  if (ev.loading) return <Loading what="Loading timeline" />;
  if (ev.error) return <ErrorBox error={ev.error} />;
  return <>{granted && mode !== '360' ? <><CareMap E={ev.E} today={ev.today} payable12={ev.payable12} /><div style={{ height: 16 }} /></> : null}<Activity E={ev.E} today={ev.today} granted={granted} /></>;
}
