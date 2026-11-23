import React, { useState } from 'react';
import { useApi } from '../hooks.js';
import { Loading, ErrorBox, Tile, Spark, Source } from './Bits.jsx';
import { fmtDay, money, moneyK, num, labFlag, titleCase } from '../util.js';

/** Member 360 · every number on this tab comes from claims.sqlite (the raw claims workbook). Claim ids open the claim detail. */
export default function Member360({ memberId }) {
  const d = useApi(`/members/${memberId}/360`);
  const [claimId, setClaimId] = useState(null);
  const [page, setPage] = useState(0);
  const claims = useApi(`/members/${memberId}/claims?limit=25&offset=${page * 25}`, [page]);
  if (d.loading && !d.data) return <Loading what="Loading raw claims" />;
  if (d.error) return <ErrorBox error={d.error} retry={d.reload} />;
  const X = d.data, u = X.utilisation || {}, l12 = u.last_12m || {}, all = u.all_time || {};
  const pol = X.policies[0] || {};
  const Src = () => <span className="srcnote"><Source kind="raw_claims" /> Raw_Claims_250_Members_Part_1..3 → claims.sqlite</span>;
  return <div className="pg-in">
    <div className="statusline"><Src /><span>· mask <b className="mono">{X.member.mask_id}</b> · {X.member.claim_count} claims · {X.member.activity_count} activity lines · {fmtDay(X.member.first_service_date)} → {fmtDay(X.member.last_service_date)}</span></div>
    <div className="tiles"><Tile n={`${num(l12.admissions_12m)} · ${num(l12.ed_visits_12m)}`} label={`Admissions · ED visits (12 mo to ${u.window_end})`} cls={l12.admissions_12m > 0 ? 'high' : ''} /><Tile n={num(l12.op_visits_12m)} label="Outpatient claims · 12 mo" /><Tile n={moneyK(l12.payable_12m)} label="Payable · 12 mo" cls="acc" /><Tile n={moneyK(all.payable)} label={`Payable all time · ${num(all.claims)} claims`} /><Tile n={X.conditions.filter(c => c.is_chronic_marker).length} label="Chronic diagnosis codes" cls="info" /></div>
    <div className="grid2">
      <section className="card"><div className="card-h"><h3>Member and cover</h3><span className="r">member · member_policy</span></div><div className="card-b"><dl className="kv" style={{ display: 'grid' }}>
        <dt>Masked id</dt><dd className="mono">{X.member.mask_id}</dd><dt>Gender · age band</dt><dd>{X.member.gender} · {X.member.age_category}</dd><dt>Relation</dt><dd>{titleCase(X.member.member_relation)}</dd>
        <dt>Plan</dt><dd>{pol.plan} · {pol.product}</dd><dt>Network</dt><dd>{pol.network_desc}</dd><dt>Policy</dt><dd className="mono">{pol.policy_id} · {fmtDay(pol.effective_date)} → {fmtDay(pol.expiry_date)}</dd><dt>Enrolled</dt><dd>{fmtDay(pol.enrollment_date)}</dd>
        {X.policies.length > 1 ? <><dt>Earlier policies</dt><dd>{X.policies.slice(1).map(p => `${p.plan} (${(p.effective_date || '').slice(0, 4)})`).join(', ')}</dd></> : null}</dl></div></section>
      <section className="card"><div className="card-h"><h3>Diagnoses on claims</h3><span className="r">diagnosis (view) · {X.conditions.length} codes</span></div><div className="card-b" style={{ maxHeight: 300, overflow: 'auto' }}>
        {X.conditions.slice(0, 40).map(c => <div key={c.diagnosis_id} className="prow"><span className={'pd' + (c.is_chronic_marker ? '' : '')} style={{ background: c.is_chronic_marker ? 'var(--info)' : 'var(--surface-3)', borderColor: c.is_chronic_marker ? 'var(--info)' : 'var(--line)' }} /><div className="tx"><b><span className="mono">{c.diagnosis_id}</span> {(c.group4 || c.group3 || '').replace(/^[A-Z0-9.]+ - [A-Z0-9.]+ /, '')}</b><small>{c.claim_count} claims · {fmtDay(c.first_date)} → {fmtDay(c.last_date)}</small></div>{c.is_chronic_marker ? <span className="pill info">Chronic</span> : null}</div>)}</div></section>
    </div>
    <div className="grid2">
      <section className="card"><div className="card-h"><h3>Laboratory history</h3><span className="r">lab_observation · {X.labs.length} tests</span></div><div className="card-b">
        {X.labs.length ? X.labs.slice(0, 14).map(l => <div key={l.code} className="labrow"><div><b style={{ fontWeight: 500 }}>{l.name}</b><br /><small className="muted">{fmtDay(l.last.date)} · {l.n} result{l.n > 1 ? 's' : ''} · LOINC {l.code} · <button className="btn sm ghost" style={{ height: 20, padding: 0 }} onClick={() => setClaimId(l.last.claim_id)}>claim {l.last.claim_id}</button></small></div><b className={'mono'} style={{ color: labFlag(l.code, l.last.value) ? `var(--${labFlag(l.code, l.last.value)})` : 'inherit' }}>{l.last.value} <small className="muted">{l.unit || ''}</small></b><Spark series={l.points.map(p => p.value)} w={130} h={30} /></div>) : <p className="muted">No lab observations on this member’s claims.</p>}</div></section>
      <section className="card"><div className="card-h"><h3>Medications · pharmacy claims</h3><span className="r">pharmacy_claim (view) · {X.medications.length} medicines</span></div><div className="card-b" style={{ maxHeight: 420, overflow: 'auto' }}>
        {X.medications.slice(0, 30).map(x => <div key={x.generic_name + x.dosage_form} className="frow" style={{ gridTemplateColumns: 'minmax(0,1fr) auto 70px' }}><span><b style={{ fontWeight: 500 }}>{x.generic_name}</b> <small className="muted">{x.dosage_form} · {x.drug_tier}</small></span><span className="muted" style={{ fontSize: 11 }}>{x.fills} fills · last {fmtDay(x.last_fill)}</span><span className="v"><button className="btn sm ghost" style={{ height: 20, padding: 0 }} onClick={() => setClaimId(x.last_claim_id)}>claim</button></span></div>)}</div></section>
    </div>
    <div className="grid2">
      <section className="card"><div className="card-h"><h3>Admissions and emergency visits</h3><span className="r">encounter (view) · IP {X.admissions.length} · ED {X.ed_visits.length}</span></div><div className="card-b hist">
        {[...X.admissions, ...X.ed_visits].sort((a, b) => (b.service_date || '').localeCompare(a.service_date || '')).slice(0, 12).map(e => <div key={e.claim_id} className="tl"><span className="d" style={{ background: e.encounter_type === 'IP' ? 'var(--crit)' : 'var(--high)' }} /><div><b style={{ fontWeight: 500 }}>{e.encounter_type === 'IP' ? 'Admission' : 'Emergency'} · {e.facility_name}</b><br /><small>{fmtDay(e.admit_date || e.service_date)}{e.discharge_date ? ` → ${fmtDay(e.discharge_date)}` : ''}{e.los_days ? ` · ${e.los_days} days` : ''} · {e.diagnosis_desc || e.primary_diagnosis_id} · {money(e.payable)} · <button className="btn sm ghost" style={{ height: 18, padding: 0 }} onClick={() => setClaimId(e.claim_id)}>claim {e.claim_id}</button></small></div><span className="pill line">{e.admit_desc}</span></div>) || null}
        {!X.admissions.length && !X.ed_visits.length ? <p className="muted">No admissions or emergency visits on record.</p> : null}</div></section>
      <section className="card"><div className="card-h"><h3>Procedures and screenings</h3><span className="r">procedure_activity (view) · {X.procedures.length} shown</span></div><div className="card-b" style={{ maxHeight: 320, overflow: 'auto' }}>
        {X.procedures.slice(0, 25).map(p => <div key={p.activity_row_id} className="prow"><span className="pd" style={{ borderStyle: 'dashed' }} /><div className="tx"><b>{p.activity_desc || p.activity_detail_id}</b><small>{fmtDay(p.service_date)} · {p.activity_detail_type} {p.activity_detail_id} · {p.cost_block} · {money(p.payable)}</small></div><button className="btn sm ghost" onClick={() => setClaimId(p.claim_id)}>claim</button></div>)}</div></section>
    </div>
    <div className="grid2">
      <section className="card"><div className="card-h"><h3>Providers and clinicians</h3><span className="r">provider · clinician</span></div><div className="card-b"><div className="tblwrap"><table className="tbl"><thead><tr><th>Facility</th><th>Type</th><th>Claims</th><th>Payable</th><th>Last visit</th></tr></thead><tbody>{X.providers.slice(0, 8).map(p => <tr key={p.provider_id}><td>{p.facility_name}<small className="muted" style={{ display: 'block' }}>{p.group_owner_level} · {p.region}</small></td><td>{p.facility_type}</td><td className="num">{p.claims}</td><td className="num">{money(p.payable)}</td><td>{fmtDay(p.last_visit)}</td></tr>)}</tbody></table></div>
        <div className="eyebrow" style={{ margin: '14px 0 6px' }}>Clinicians seen</div><div className="chips">{X.clinicians.slice(0, 10).map(c => <span key={c.clinician_id} className="pill line" title={`${c.claims} claims · last ${c.last_seen}`}>{c.clinician_name} · {c.specialty}</span>)}</div></div></section>
      <section className="card"><div className="card-h"><h3>Cost and utilisation</h3><span className="r">claim · claim_activity</span></div><div className="card-b">
        <div className="eyebrow">By year</div>{X.costs.by_year.map(y => <div key={y.year} className="frow"><span>{y.year}</span><span className="hbar"><i style={{ width: Math.round(y.payable / Math.max(...X.costs.by_year.map(z => z.payable)) * 100) + '%' }} /></span><span className="v">{moneyK(y.payable)}</span></div>)}
        <div className="eyebrow" style={{ marginTop: 12 }}>By cost block</div>{X.costs.by_cost_block.slice(0, 7).map(b => <div key={b.cost_block} className="frow"><span>{b.cost_block}</span><span className="hbar"><i style={{ width: Math.round(b.payable / Math.max(...X.costs.by_cost_block.map(z => z.payable)) * 100) + '%', background: 'var(--info)' }} /></span><span className="v">{moneyK(b.payable)}</span></div>)}
      </div></section>
    </div>
    <section className="card"><div className="card-h"><h3>Claims</h3><span className="r">claim · {claims.data ? claims.data.total : '…'} total · page {page + 1}</span></div><div className="card-b">
      {claims.loading && !claims.data ? <Loading /> : claims.error ? <ErrorBox error={claims.error} /> : <div className="tblwrap"><table className="tbl"><thead><tr><th>Date</th><th>Claim</th><th>Type</th><th>Facility · clinician</th><th>Diagnosis</th><th>Lines</th><th>Payable</th></tr></thead><tbody>
        {claims.data.rows.map(c => <tr key={c.claim_id} className="clk claimrow" onClick={() => setClaimId(c.claim_id)}><td>{fmtDay(c.service_date)}</td><td className="mono">{c.claim_id}</td><td><span className={'pill ' + (c.bg_ipop === 'IP' ? 'crit' : c.admit_desc === 'Emergency' ? 'high' : 'line')}>{c.bg_ipop === 'IP' ? 'IP' : c.admit_desc === 'Emergency' ? 'ED' : 'OP'}</span></td><td>{c.facility_name}<small>{c.clinician_name} · {c.specialty}</small></td><td>{c.primary_diagnosis_id}<small>{(c.diagnosis_desc || '').replace(/^[A-Z0-9.]+ - [A-Z0-9.]+ /, '')}</small></td><td className="num">{c.activity_count}</td><td className="num">{money(c.payable)}</td></tr>)}</tbody></table></div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button className="btn sm" disabled={!page} onClick={() => setPage(p => p - 1)}>‹ Newer</button><button className="btn sm" disabled={!claims.data || (page + 1) * 25 >= claims.data.total} onClick={() => setPage(p => p + 1)}>Older ›</button></div>
    </div></section>
    {claimId ? <ClaimDrawer claimId={claimId} onClose={() => setClaimId(null)} /> : null}
  </div>;
}
function ClaimDrawer({ claimId, onClose }) {
  const c = useApi(`/claims/${claimId}`);
  return <aside className="drawer" role="dialog" aria-label={`Claim ${claimId}`}>
    <div className="dh"><b>Claim <span className="mono">{claimId}</span></b><Source kind="raw_claims" /><button className="btn sm" style={{ marginLeft: 'auto' }} onClick={onClose}>Close</button></div>
    <div className="db">{c.loading ? <Loading /> : c.error || !c.data ? <ErrorBox error={c.error || new Error('not found')} /> : <>
      <dl className="kv" style={{ display: 'grid' }}><dt>Date</dt><dd>{fmtDay(c.data.service_date)}{c.data.service_date_to !== c.data.service_date ? ` → ${fmtDay(c.data.service_date_to)}` : ''}</dd><dt>Facility</dt><dd>{c.data.facility_name} · {c.data.facility_type}</dd><dt>Clinician</dt><dd>{c.data.clinician_name} · {c.data.specialty}</dd><dt>Setting</dt><dd>{c.data.bg_ipop} · {c.data.admit_desc}{c.data.los_days ? ` · ${c.data.los_days} days` : ''}</dd><dt>Payable · claimed · denied</dt><dd>{money(c.data.payable)} · {money(c.data.claimed)} · {money(c.data.denial)}</dd><dt>Episode</dt><dd className="mono">{c.data.episode_id}</dd></dl>
      <div className="eyebrow" style={{ margin: '14px 0 6px' }}>Activity lines · {c.data.activities.length}</div>
      <table className="tbl"><thead><tr><th>Date</th><th>Activity</th><th>Diagnosis</th><th>Payable</th></tr></thead><tbody>{c.data.activities.map(a => <tr key={a.activity_row_id}><td>{fmtDay(a.service_date)}</td><td>{a.generic_name ? <b>{a.generic_name}</b> : a.activity_desc}<small className="muted" style={{ display: 'block' }}>{a.activity_detail_type} {a.activity_detail_id} · {a.cost_block}{a.drug_quantity ? ` · qty ${a.drug_quantity}` : ''}</small></td><td className="mono">{a.diagnosis_id}</td><td className="num">{money(a.payable)}</td></tr>)}</tbody></table>
      {c.data.labs.length ? <><div className="eyebrow" style={{ margin: '14px 0 6px' }}>Lab observations · {c.data.labs.length}</div><table className="tbl"><thead><tr><th>LOINC</th><th>Test</th><th>Value</th></tr></thead><tbody>{c.data.labs.map(l => <tr key={l.observation_sk}><td className="mono">{l.code}</td><td>{l.description || '—'}</td><td className="mono">{l.requested_value}</td></tr>)}</tbody></table></> : null}
    </>}</div>
  </aside>;
}
