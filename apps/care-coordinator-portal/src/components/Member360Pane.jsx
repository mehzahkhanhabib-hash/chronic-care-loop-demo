import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks.js';
import Icon from '../icons.jsx';
import MemberHead from './MemberHead.jsx';
import ClaimDrawer from './ClaimDrawer.jsx';
import { useEvents, CareMap, Activity } from './Timeline.jsx';
import { Loading, ErrorBox, Tag, Source, Spark, LockBox } from './Bits.jsx';
import { FLAG_COL, daysFrom, dxName, fmtDay, genderWord, labFlag, money, moneyK, num, titleCase } from '../util.js';

/**
 * Member 360 (design: header + summary, progress, 360 Overview / Timeline). Every clinical number comes from the raw-claims
 * endpoints (GET /members/:id/360, /claims, /claims/:id) and nothing clinical is fetched or rendered before consent (G2).
 */
export default function Member360Pane({ memberId }) {
  const nav = useNavigate();
  const m = useApi(`/members/${memberId}`);
  const granted = !!(m.data && m.data.consent_status === 'granted');
  const x = useApi(granted ? `/members/${memberId}/360` : null, [granted]);
  const timeline = useApi(`/members/${memberId}/timeline`);
  const plan = useApi(granted ? `/members/${memberId}/care-plan` : null, [granted]);
  const tasks = useApi(granted ? `/members/${memberId}/tasks` : null, [granted]);
  const ev = useEvents(memberId, granted, timeline, x);
  const [tab, setTab] = useState('ov'); const [claimId, setClaimId] = useState(null); const [page, setPage] = useState(0);
  const claims = useApi(granted && tab === 'claims' ? `/members/${memberId}/claims?limit=25&offset=${page * 25}` : null, [granted, tab, page]);
  if (m.loading && !m.data) return <div className="scroll"><Loading what="Loading member" /></div>;
  if (m.error) return <div className="scroll"><ErrorBox error={m.error} retry={m.reload} /></div>;
  const M = m.data, id = M.identity, X = x.data, TL = timeline.data || [], needs = plan.data ? plan.data.needs : [];
  const u = X ? X.utilisation || {} : {}, l12 = u.last_12m || {}, all = u.all_time || {};
  const Claim = ({ id: cid, children }) => <button className="link" style={{ fontSize: 'inherit' }} onClick={() => setClaimId(cid)} title={`Open claim ${cid}`}>{children || `claim ${cid}`}</button>;

  // progress (operational data only)
  const P = [['Flagged', !!M.worklist || !!(M.risk && M.risk.alert)], ['Contacted', TL.some(e => e.type === 'call')], ['Consent', granted], ['Actions & Caregaps', needs.some(n => n.last_outcome && ['agreed', 'done'].includes(n.last_outcome.outcome))], ['Outcome', TL.some(e => e.type === 'disposition')], ['Follow-up', (tasks.data || []).some(t => t.parent_action_id && t.status !== 'open') || TL.some(e => e.type === 'appointment')]];
  const cur = P.findIndex(p => !p[1]);

  // summary: a templated sentence over raw-claims fields (not generated text)
  const a1c = X ? (X.labs || []).find(l => l.code === '4548-4' || l.code === '17856-6') : null, sbp = X ? (X.labs || []).find(l => l.code === '8480-6') : null;
  const chronic = X ? (X.conditions || []).filter(c => c.is_chronic_marker) : [];
  const enc = X ? [...(X.admissions || []), ...(X.ed_visits || [])] : [];
  const fac = {}; enc.forEach(e => { const f = fac[e.facility_name] = fac[e.facility_name] || { name: e.facility_name, ip: 0, ed: 0, last: e }; if (e.encounter_type === 'IP') f.ip++; else f.ed++; if ((e.service_date || '') > (f.last.service_date || '')) f.last = e; });
  const facs = Object.values(fac).sort((a, b) => (b.ip + b.ed) - (a.ip + a.ed));
  const top = needs.find(n => n.slot === 'CURRENT' && n.status === 'open');
  const summary = !granted ? <div className="ai"><h4><Icon name="spark" /> SUMMARY</h4><p>The Member 360 summary is unlocked only when the member gives consent.</p></div>
    : !X ? null : <div className="ai"><h4><Icon name="spark" /> SUMMARY · BUILT FROM RAW CLAIMS</h4>
      <p>{id.age}-year-old {genderWord(id.gender).toLowerCase()}{chronic.length ? ` with ${chronic.slice(0, 4).map(c => dxName(c).toLowerCase()).join(', ')} on claims` : ''}. {num(l12.admissions_12m)} hospital stay{l12.admissions_12m === 1 ? '' : 's'} and {num(l12.ed_visits_12m)} ER visit{l12.ed_visits_12m === 1 ? '' : 's'} in the 12 months to {fmtDay(u.window_end)}{facs[0] ? `, mostly at ${facs[0].name}` : ''}. {a1c ? `HbA1c ${a1c.points.slice(-3).map(p => p.value).join(' → ')} % (latest ${fmtDay(a1c.last.date)}). ` : ''}{sbp ? `Systolic BP ${sbp.last.value} mmHg (${fmtDay(sbp.last.date)}). ` : ''}{(X.medications || []).length} medicines on pharmacy claims. {num(l12.claims_12m)} claims · {moneyK(l12.payable_12m)} payable in 12 months.</p>
      <div className="row">{l12.admissions_12m >= 2 || l12.ed_visits_12m >= 3 ? <Tag cls="t-crit">High hospital use</Tag> : null}{a1c && a1c.last.value >= 8 ? <Tag cls="t-warn">HbA1c above 8 %</Tag> : null}{sbp && sbp.last.value >= 140 ? <Tag cls="t-warn">Systolic BP ≥ 140</Tag> : null}<Source kind="raw_claims" /></div>
      {top ? <div className="sf"><span>SUGGESTED FOCUS</span>{top.need} → {top.next_best_action} <Source kind="engine" /></div> : null}</div>;

  let body;
  if (!granted) body = <LockBox title="Member 360 is unlocked only when the member gives consent"><button className="btn btn-pri btn-sm" onClick={() => nav(`/member/${memberId}`)}><Icon name="phone" /> Open Call Workflow</button></LockBox>;
  else if (x.loading && !X) body = <Loading what="Loading raw claims" />;
  else if (x.error) body = <ErrorBox error={x.error} retry={x.reload} />;
  else if (!X) body = <Loading what="Loading raw claims" />;
  else if (tab === 'tl') body = <Activity E={ev.E} today={ev.today} granted />;
  else if (tab === 'claims') {
    const pol = X.policies[0] || {}, mxY = Math.max(...X.costs.by_year.map(z => z.payable), 1), mxB = Math.max(...X.costs.by_cost_block.map(z => z.payable), 1);
    body = <>
      <div className="row small" style={{ margin: '0 0 12px' }}><Source kind="raw_claims" /><span className="muted">Raw_Claims_250_Members_Part_1..3 → claims.sqlite · mask <b className="mono">{X.member.mask_id}</b> · {num(X.member.claim_count)} claims · {num(X.member.activity_count)} activity lines · {fmtDay(X.member.first_service_date)} → {fmtDay(X.member.last_service_date)}</span></div>
      <div className="g2">
        <div className="c3"><div className="h">Member and cover <span className="small muted">member · member_policy</span></div><dl className="kv">
          <dt>Masked id</dt><dd className="mono">{X.member.mask_id}</dd><dt>Gender · age band</dt><dd>{X.member.gender} · {X.member.age_category}</dd><dt>Relation</dt><dd>{titleCase(X.member.member_relation)}</dd>
          <dt>Plan</dt><dd>{pol.plan} · {pol.product}</dd><dt>Network</dt><dd>{pol.network_desc}</dd><dt>Policy</dt><dd className="mono">{pol.policy_id} · {fmtDay(pol.effective_date)} → {fmtDay(pol.expiry_date)}</dd><dt>Enrolled</dt><dd>{fmtDay(pol.enrollment_date)}</dd>
          {X.policies.length > 1 ? <><dt>Earlier policies</dt><dd>{X.policies.slice(1).map(p => `${p.plan} (${(p.effective_date || '').slice(0, 4)})`).join(', ')}</dd></> : null}</dl></div>
        <div className="c3"><div className="h">Diagnoses on claims <span className="small muted">{X.conditions.length} codes</span></div><div style={{ maxHeight: 300, overflow: 'auto' }}>
          {X.conditions.slice(0, 40).map(c => <div key={c.diagnosis_id} className="r3" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr) auto' }}><b><span className="mono">{c.diagnosis_id}</span> {dxName(c)}</b><span>{c.claim_count} claims · {fmtDay(c.first_date)} → {fmtDay(c.last_date)}</span><span>{c.is_chronic_marker ? <Tag cls="t-info">Chronic</Tag> : null}</span></div>)}</div></div>
        <div className="c3"><div className="h">Procedures and screenings <span className="small muted">{X.procedures.length} shown</span></div><div style={{ maxHeight: 320, overflow: 'auto' }}>
          {X.procedures.slice(0, 25).map(p => <div key={p.activity_row_id} className="r3" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr) auto' }}><b>{p.activity_desc || p.activity_detail_id}</b><span>{fmtDay(p.service_date)} · {p.activity_detail_type} {p.activity_detail_id} · {money(p.payable)}</span><Claim id={p.claim_id}>claim</Claim></div>)}
          {X.procedures.length ? null : <p className="muted small">No procedures on claims.</p>}</div></div>
        <div className="c3"><div className="h">Cost and utilisation <span>{moneyK(all.payable)} all time</span></div>
          <div className="k"><b>{num(all.claims)}</b> claims<span className="r">{num(l12.op_visits_12m)} outpatient claims · 12 mo</span></div>
          {X.costs.by_year.map(y => <div key={y.year} className="r3" style={{ gridTemplateColumns: '90px minmax(0,1fr) 80px' }}><b>{y.year}</b><span className="bar"><i style={{ width: Math.round(y.payable / mxY * 100) + '%', background: 'var(--accent)' }} /></span><span style={{ textAlign: 'right' }}>{moneyK(y.payable)}</span></div>)}
          {X.costs.by_cost_block.slice(0, 6).map(b => <div key={b.cost_block} className="r3" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 80px' }}><b>{b.cost_block}</b><span className="bar"><i style={{ width: Math.round(b.payable / mxB * 100) + '%', background: 'var(--info)' }} /></span><span style={{ textAlign: 'right' }}>{moneyK(b.payable)}</span></div>)}</div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}><div className="ph"><h2 style={{ fontSize: 15 }}>Claims</h2><span className="small muted">{claims.data ? claims.data.total : '…'} total · page {page + 1} · click a row for the claim lines</span></div>
        {claims.loading && !claims.data ? <Loading /> : claims.error ? <ErrorBox error={claims.error} /> : claims.data ? <div className="tblwrap"><table className="tbl"><thead><tr><th>Date</th><th>Claim</th><th>Type</th><th>Facility · clinician</th><th>Diagnosis</th><th>Lines</th><th>Payable</th></tr></thead><tbody>
          {claims.data.rows.map(c => <tr key={c.claim_id} className="clk" onClick={() => setClaimId(c.claim_id)}><td>{fmtDay(c.service_date)}</td><td className="mono">{c.claim_id}</td><td><Tag cls={c.bg_ipop === 'IP' ? 't-crit' : c.admit_desc === 'Emergency' ? 't-warn' : 't-neu'}>{c.bg_ipop === 'IP' ? 'IP' : c.admit_desc === 'Emergency' ? 'ER' : 'OP'}</Tag></td><td>{c.facility_name}<small>{c.clinician_name} · {c.specialty}</small></td><td>{c.primary_diagnosis_id}<small>{dxName({ group4: c.diagnosis_desc })}</small></td><td className="num">{c.activity_count}</td><td className="num">{money(c.payable)}</td></tr>)}</tbody></table></div> : null}
        <div className="row" style={{ marginTop: 12 }}><button className="btn btn-sec btn-sm" disabled={!page} onClick={() => setPage(p => p - 1)}><Icon name="left" /> Newer</button><button className="btn btn-sec btn-sm" disabled={!claims.data || (page + 1) * 25 >= claims.data.total} onClick={() => setPage(p => p + 1)}>Older <Icon name="right" /></button></div></div></>;
  } else {
    const hospPay = enc.filter(e => u.window_end && daysFrom(e.service_date, u.window_end) > -365).reduce((a, e) => a + (e.payable || 0), 0);
    const days = (X.admissions || []).reduce((a, e) => a + (e.los_days || 0), 0);
    const clinics = (X.providers || []).filter(p => !/pharmacy/i.test(p.facility_type || '')), visits = clinics.reduce((a, p) => a + (p.claims || 0), 0);
    const meds = X.medications || [], fills = meds.reduce((a, d) => a + (d.fills || 0), 0), medPay = meds.reduce((a, d) => a + (d.payable || 0), 0);
    const labs = X.labs || [], off = labs.filter(l => ['crit', 'warn'].includes(labFlag(l.code, l.last.value))).length;
    body = <><div className="g2">
      <div className="c3"><div className="h">Hospitals &amp; ER <span>{moneyK(hospPay)} · 12 mo</span></div>
        <div className="k"><b>{num(l12.admissions_12m)}</b> Stays <b style={{ marginLeft: 12 }}>{num(l12.ed_visits_12m)}</b> ER Visits<span className="r">{days} days in hospital · all time · IP {X.admissions.length} · ER {X.ed_visits.length}</span></div>
        {facs.slice(0, 6).map(f => <div key={f.name} className="r3" style={{ gridTemplateColumns: 'minmax(0,1.4fr) 1fr auto' }}><b>{f.name}</b><span><Claim id={f.last.claim_id}>{fmtDay(f.last.admit_date || f.last.service_date)}</Claim></span><span>{f.ip} stay{f.ip === 1 ? '' : 's'}{f.ed ? ` · ${f.ed} ER` : ''}</span></div>)}
        {facs.length ? null : <p className="muted small" style={{ margin: '10px 0' }}>No admissions or emergency visits on claims.</p>}</div>
      <div className="c3"><div className="h">Clinics &amp; doctors <span>{moneyK(clinics.reduce((a, p) => a + (p.payable || 0), 0))}</span></div>
        <div className="k"><b>{num(visits)}</b> Claims<span className="r">{clinics.length} places · {(X.clinicians || []).length} clinicians</span></div>
        {clinics.slice(0, 6).map(p => <div key={p.provider_id} className="r3" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) auto' }}><b>{p.facility_name}</b><span>{p.facility_type} · last {fmtDay(p.last_visit)}</span><b>{p.claims} Visit{p.claims === 1 ? '' : 's'}</b></div>)}
        <div className="row" style={{ marginTop: 10 }}>{(X.clinicians || []).slice(0, 5).map(c => <Tag key={c.clinician_id} cls="t-neu" title={`${c.claims} claims · last ${c.last_seen}`}>{c.specialty}</Tag>)}</div></div>
      <div className="c3"><div className="h">Medicines &amp; pharmacy <span>{moneyK(medPay)}</span></div>
        <div className="k"><b>{meds.length}</b> On claims<span className="r">{num(fills)} fills · pharmacy claims</span></div>
        {meds.slice(0, 7).map(d => <div key={d.generic_name + d.dosage_form} className="r3" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) 60px 110px' }}><b>{d.generic_name}</b><span>{d.dosage_form}{d.drug_tier ? ` · ${d.drug_tier}` : ''}</span><span>{d.fills} fill{d.fills === 1 ? '' : 's'}</span><span style={{ textAlign: 'right' }}><Claim id={d.last_claim_id}>{fmtDay(d.last_fill)}</Claim></span></div>)}
        {meds.length ? null : <p className="muted small" style={{ margin: '10px 0' }}>No pharmacy claims.</p>}</div>
      <div className="c3"><div className="h">Labs &amp; tests <span>{labs.reduce((a, l) => a + (l.n || 0), 0)} results</span></div>
        <div className="k"><b>{labs.length}</b> tests<span className="r">{off} off target · lab observations on claims</span></div>
        {labs.slice(0, 8).map(l => { const fl = labFlag(l.code, l.last.value), up = l.points.length > 1 && l.last.value > l.points[l.points.length - 2].value;
          return <div key={l.code} className="r3" style={{ gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr) 70px auto' }}><b>{l.name}</b><span><Claim id={l.last.claim_id}>{fmtDay(l.last.date)}</Claim> · {l.n} result{l.n === 1 ? '' : 's'}</span><Spark series={l.points.map(p => p.value)} w={64} h={20} color={FLAG_COL[fl] || 'var(--accent)'} /><b style={{ color: FLAG_COL[fl] || 'inherit' }}>{l.last.value} {l.unit || ''} {up ? '↑' : ''}</b></div>; })}
        {labs.length ? null : <p className="muted small" style={{ margin: '10px 0' }}>No lab observations on claims.</p>}</div>
    </div><div style={{ height: 16 }} /><CareMap E={ev.E} today={ev.today} payable12={l12.payable_12m} /></>;
  }
  return <div className="scroll"><MemberHead M={M} mode="360">{summary}</MemberHead>
    <div className="prog">{P.map(([l, d], i) => <React.Fragment key={l}>{i ? <span className={'pl' + (d && P[i - 1][1] ? ' done' : '')} /> : null}<div className={'ps ' + (d ? 'done' : i === cur ? 'cur' : '')}><span className="n">{d ? <Icon name="tick" /> : i + 1}</span>{l}</div></React.Fragment>)}</div>
    <div className="tabs" role="tablist" style={{ marginTop: 14 }}>{[['ov', '360 Overview'], ['tl', 'Timeline'], ['claims', 'Claims']].map(([k, l]) => <button key={k} className="tab" role="tab" aria-selected={tab === k} disabled={!granted && k !== 'ov'} onClick={() => setTab(k)}>{!granted && k !== 'ov' ? <Icon name="lock" /> : null}{l}</button>)}</div>
    {body}
    {claimId ? <ClaimDrawer claimId={claimId} onClose={() => setClaimId(null)} /> : null}
  </div>;
}
