import React, { useState } from 'react';
import { useApi } from '../hooks.js';
import { Loading, ErrorBox, Empty } from './Bits.jsx';

const KINDS = { consent: ['Consent', 'k'], call: ['Call', 'k'], disposition: ['Decision', 'k'], assertion: ['Member said', 'ty'], gap: ['Care gap', 'ty'], appointment: ['Appointment', 'k'], note: ['Note', 'ty'], action: ['Task', 'ty'] };
/** Operational timeline: everything this portal wrote for the member (consent_event, contact_attempt, disposition_event, member_assertion, care_gap_event, appointment, nurse_note, action). */
export default function Timeline({ memberId }) {
  const t = useApi(`/members/${memberId}/timeline`);
  const [f, setF] = useState('all');
  if (t.loading && !t.data) return <Loading what="Loading timeline" />;
  if (t.error) return <ErrorBox error={t.error} retry={t.reload} />;
  const evs = t.data.filter(e => f === 'all' || e.type === f);
  const days = [...new Set(evs.map(e => (e.at || '').slice(0, 10)))];
  return <div className="pg-in"><section className="card"><div className="card-h"><h3>Timeline</h3><div className="segctl" style={{ marginLeft: 'auto', flexWrap: 'wrap' }}>{[['all', 'All'], ...Object.entries(KINDS).map(([k, v]) => [k, v[0]])].map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}</div></div>
    <div className="card-b">{evs.length ? days.map(d => <div key={d}><div className="tl3-g">{d}</div>{evs.filter(e => (e.at || '').slice(0, 10) === d).map(e => <div key={e.type + e.ref} className={'tl3' + (e.type === 'gap' || e.type === 'assertion' ? ' clin' : '')}><time>{(e.at || '').slice(11, 16)}</time><span className="d" /><div><b style={{ fontWeight: 500 }}>{e.text}</b><div className="tg"><span className={KINDS[e.type] ? KINDS[e.type][1] : ''}>{KINDS[e.type] ? KINDS[e.type][0] : e.type}</span>{e.by ? <span>{e.by}</span> : null}</div></div></div>)}</div>) : <Empty>Nothing recorded yet for this member.</Empty>}</div></section></div>;
}
