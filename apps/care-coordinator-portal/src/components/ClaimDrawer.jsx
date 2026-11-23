import React from 'react';
import { useApi } from '../hooks.js';
import { Loading, ErrorBox, Source } from './Bits.jsx';
import Icon from '../icons.jsx';
import { fmtDay, money } from '../util.js';

/** Claim detail drawer: GET /claims/:id (claim header, activity lines, lab observations). Raw claims only. */
export default function ClaimDrawer({ claimId, onClose }) {
  const c = useApi(`/claims/${claimId}`);
  const d = c.data;
  return <aside className="drawer" role="dialog" aria-label={`Claim ${claimId}`}>
    <div className="dh"><b>Claim <span className="mono">{claimId}</span></b><Source kind="raw_claims" /><button className="round" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
    <div className="db">{c.loading && !d ? <Loading /> : c.error || !d ? <ErrorBox error={c.error || new Error('Claim not found')} /> : <>
      <dl className="kv"><dt>Date</dt><dd>{fmtDay(d.service_date)}{d.service_date_to !== d.service_date ? ` → ${fmtDay(d.service_date_to)}` : ''}</dd><dt>Facility</dt><dd>{d.facility_name} · {d.facility_type}</dd><dt>Clinician</dt><dd>{d.clinician_name} · {d.specialty}</dd><dt>Setting</dt><dd>{d.bg_ipop} · {d.admit_desc}{d.los_days ? ` · ${d.los_days} days` : ''}</dd><dt>Payable · claimed · denied</dt><dd>{money(d.payable)} · {money(d.claimed)} · {money(d.denial)}</dd><dt>Episode</dt><dd className="mono">{d.episode_id}</dd></dl>
      <div className="lbl2" style={{ margin: '16px 0 6px' }}>Activity lines · {d.activities.length}</div>
      <table className="tbl"><thead><tr><th>Date</th><th>Activity</th><th>Diagnosis</th><th>Payable</th></tr></thead><tbody>{d.activities.map(a => <tr key={a.activity_row_id}><td>{fmtDay(a.service_date)}</td><td>{a.generic_name ? <b>{a.generic_name}</b> : a.activity_desc}<small>{a.activity_detail_type} {a.activity_detail_id} · {a.cost_block}{a.drug_quantity ? ` · qty ${a.drug_quantity}` : ''}</small></td><td className="mono">{a.diagnosis_id}</td><td className="num">{money(a.payable)}</td></tr>)}</tbody></table>
      {d.labs.length ? <><div className="lbl2" style={{ margin: '16px 0 6px' }}>Lab observations · {d.labs.length}</div><table className="tbl"><thead><tr><th>LOINC</th><th>Test</th><th>Value</th></tr></thead><tbody>{d.labs.map(l => <tr key={l.observation_sk}><td className="mono">{l.code}</td><td>{l.description || '—'}</td><td className="mono">{l.requested_value}</td></tr>)}</tbody></table></> : null}
    </>}</div>
  </aside>;
}
