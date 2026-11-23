import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useApi, useDebouncedPost } from '../hooks/useApi';
import { Loading, ErrorBox } from '../components/ui';
import { useToast } from '../components/Toast';
import { F, CATS, LABS, LAB_DATES, NOT_SELECTABLE, BASES, TEMPLATES, newRule, ruleOn, ruleText, strip, parseDescription } from '../lib/fields';
import { fmt } from '../lib/format';

/* Screen 1 · Cohort & Campaign Builder, converted from the Studio_7 builder component (Build / Cohorts / Campaigns, campaign dialog Who → What → Review).
   Every number is read from the backend: POST /api/cohorts/estimate (SQL over member_longitudinal), /api/cohorts, /api/campaigns, /api/intelligence/runs. */

const SH = '0 1px 2px rgba(16,32,42,.04),0 8px 24px -12px rgba(16,58,82,.18)';
const CARD = { background: '#FFFFFF', borderRadius: 20, boxShadow: SH };
const pill = a => (a ? { background: '#0B2E57', color: '#FFFFFF' } : { background: 'transparent', color: '#3E525D' });
const chip = a => (a ? { background: '#BCE7F2', color: '#0B2E57', border: '1px solid #9FD7E6' } : { background: '#FFFFFF', color: '#3E525D', border: '1px solid #DCE6EB' });
const LBL = { fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#566A74' };
const SUB = { fontSize: 13, fontWeight: 700, color: '#3E525D', marginBottom: 8 };
const OPS = [['≥', 'at least'], ['≤', 'at most'], ['between', 'between'], ['=', 'exactly']];
const REFRESH = ['Live', 'Daily', 'Nightly', 'Every 3 days', 'Weekly'];
const CHANNELS = ['Voice', 'WhatsApp', 'SMS', 'PURA app'];
const MIN_N = 50;
const DEFAULT_EFFORT = { nurses: 6, calls_per_day: 25, holdout: 10, weeks: 8 };   // sent silently: Studio_7 has no Effort step
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fdate = iso => { if (!iso) return '—'; const d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z'); return Number.isNaN(d.getTime()) ? String(iso) : d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; };
const blank = () => ({ id: null, version: null, name: '', base: 'daman', logic: 'all', refresh: 'Nightly', mode: 'build', inc: [], exc: [] });
const body = cb => ({ base: cb.base, logic: cb.logic, inc: cb.inc.filter(ruleOn).map(strip), exc: cb.exc.filter(ruleOn).map(strip) });
const tog = (arr, v) => (arr.includes(v) ? arr.filter(x => x !== v) : arr.concat(v));
const chList = s => String(s || '').split(/,\s*/).filter(Boolean);
const BADGE = { Sentence: ['#10202A', '#FFFFFF'], Condition: ['#DCF1F7', '#0A6F96'], Medicine: ['#DDF1F8', '#0A6F96'], Result: ['#DDF1F8', '#0A6F96'], Overdue: ['#FFF1C7', '#8A5A00'], Exclude: ['#FDE7E7', '#B3261E'] };
const badgeOf = (k, d) => (d.excl ? 'Exclude' : d.type === 'labage' ? 'Overdue' : d.cat === 'Health' ? 'Condition' : d.cat === 'Medicines' ? 'Medicine' : d.cat === 'Tests & results' ? 'Result' : d.cat.split(' ')[0]);
const EXAMPLES = ['Diabetes with HbA1c above 9 who missed refills, excluding cancer', 'Hypertension with blood pressure above 150, excluding opt-outs', 'Diabetes with no eye exam on record', 'Admitted members with heart failure', 'Members over 65 with kidney disease'];

export default function Builder({ onChanged }) {
  const [sp, setSp] = useSearchParams();
  const tab = ['lib', 'camp'].includes(sp.get('tab')) ? sp.get('tab') : 'build';
  const setTab = t => setSp(t === 'build' ? {} : { tab: t });
  const [cb, setCb] = useState(() => { const b = blank(); const t = TEMPLATES[0]; b.name = t.name; b.inc = t.inc.map(r => newRule(r.f, r)); b.exc = t.exc.map(r => newRule(r.f, r)); return b; });
  const cohorts = useApi('/cohorts');
  const campaigns = useApi('/campaigns');
  const health = useApi('/health');
  const users = useApi('/users');
  const [ce, setCe] = useState(null);
  const nav = useNavigate();
  const say = useToast();
  const [running, setRunning] = useState(false);
  const cohList = cohorts.data ? cohorts.data.cohorts : [];
  const campList = campaigns.data ? campaigns.data.campaigns : [];
  const members = useCohortMembers(cohList);
  const runDate = health.data && health.data.run_date ? health.data.run_date : '2026-11-20';
  const ownerName = id => { const u = (users.data || []).find(x => x.user_id === id); return u ? u.role : id || 'Population health'; };
  const campN = c => { const inc = new Set(); (c.include || []).forEach(id => (members[id] || []).forEach(m => inc.add(m))); (c.exclude || []).forEach(id => (members[id] || []).forEach(m => inc.delete(m))); return (c.include || []).every(id => members[id]) ? inc.size : (c.include || []).reduce((a, id) => a + ((cohList.find(k => k.id === id) || {}).n || 0), 0); };
  const runNow = async () => {
    setRunning(true);
    try { const r = await api.post('/intelligence/runs', {}); say(`Care intelligence ran now · run ${r.run_id}: ${fmt(r.members)} members scored, ${fmt(r.fired)} triggers fired, ${fmt(r.needs_opened)} new needs`); onChanged && onChanged(); nav('/intelligence'); }
    catch (e) { say('Run failed: ' + e.message); } finally { setRunning(false); }
  };
  const nextCampId = () => 'CMP-' + String(Math.max(100, ...campList.map(k => Number(String(k.id).replace('CMP-', ''))).filter(Number.isFinite)) + 1).padStart(4, '0');
  const openCamp = (include, existing) => {
    if (existing) { setCe({ ...existing, isNew: false, step: 0, triggers: existing.triggers || [], include: existing.include || [], exclude: existing.exclude || [] }); return; }
    const coh = cohList.find(c => c.id === (include || [])[0]);
    setCe({ id: nextCampId(), isNew: true, step: 0, name: coh ? coh.name.split(' · ')[0] + ' outreach' : '', goal: '', mode: 'automated', triggers: [], channels: 'Voice', ...DEFAULT_EFFORT, start: addDays(runDate, 3), priority: Math.min(9, Math.max(0, ...campList.map(k => k.priority || 0)) + 1), status: 'Draft', include: include || [], exclude: [] });
  };
  const tabs = [['build', 'Build', cb.inc.length ? 'draft' : 'new'], ['lib', 'Cohorts', cohorts.data ? cohList.length : '…'], ['camp', 'Campaigns', campaigns.data ? campList.length : '…']];
  const titles = { build: ['Build a cohort', 'Describe who the programme is for. Risk, triggers and next best actions are added by care intelligence after hand-off.'], lib: ['Saved cohorts', 'Each cohort re-runs on its schedule. Edit one to create a new version; campaigns pick up the change automatically.'], camp: ['Campaigns', 'Put cohorts to work: who to reach, what to act on, and when. Hand-off sends them to care intelligence.'] };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0A6F96' }}>Step 1 · Population health team</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 24, lineHeight: 1.2, fontWeight: 600, letterSpacing: '-.015em' }}>{titles[tab][0]}</h1>
          <p style={{ margin: '6px 0 0', fontSize: 15, color: '#3E525D', maxWidth: '72ch', textWrap: 'pretty' }}>{titles[tab][1]}</p>
        </div>
        <div role="tablist" style={{ display: 'flex', background: '#FFFFFF', border: '1px solid #DCE6EB', borderRadius: 12, padding: 4, gap: 2 }}>
          {tabs.map(([k, l, n]) => { const a = tab === k; return <button key={k} role="tab" aria-selected={a} onClick={() => setTab(k)} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 0, borderRadius: 999, padding: '9px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'background .2s', whiteSpace: 'nowrap', ...pill(a) }}>{l}<span style={{ fontSize: 12, fontWeight: 700, padding: '1px 8px', borderRadius: 999, background: a ? '#9FD7E6' : '#EBF1F4', color: a ? '#10202A' : '#3E525D', whiteSpace: 'nowrap' }}>{n}</span></button>; })}
        </div>
      </div>
      {tab === 'build' && <BuildTab cb={cb} setCb={setCb} cohList={cohList} asOf={health.data ? health.data.as_of : null}
        onSaved={(saved, andUse) => { cohorts.reload(); onChanged && onChanged(); if (andUse) { setTab('camp'); openCampAfterSave(saved, cb, setCe, nextCampId, campList, runDate); } else setTab('lib'); }} />}
      {tab === 'lib' && <LibraryTab cohorts={cohorts} campList={campList} ownerName={ownerName}
        onNew={() => { setCb(blank()); setTab('build'); }}
        onEdit={c => { setCb({ id: c.id, version: c.version, name: c.name, base: c.base || 'daman', logic: c.logic || 'all', refresh: c.refresh || 'Nightly', mode: 'build', inc: c.inc.map(r => newRule(r.f, r)), exc: c.exc.map(r => newRule(r.f, r)) }); setTab('build'); }}
        onUse={c => { setTab('camp'); openCamp([c.id]); }} />}
      {tab === 'camp' && <CampaignsTab campaigns={campaigns} cohList={cohList} campN={campN} runDate={runDate} open={k => openCamp(null, k)} onNew={() => openCamp([])} />}
      {ce && <CampaignDialog ce={ce} setCe={setCe} cohList={cohList} campN={campN} running={running} onClose={() => setCe(null)} onSaved={() => { campaigns.reload(); onChanged && onChanged(); }} runNow={runNow} />}
    </div>
  );
}

function addDays(iso, d) { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); }
function openCampAfterSave(saved, cb, setCe, nextCampId, campList, runDate) {
  setCe({ id: nextCampId(), isNew: true, step: 0, name: (cb.name || '').split(' · ')[0] + ' outreach', goal: '', mode: 'automated', triggers: [], channels: 'Voice', ...DEFAULT_EFFORT, start: addDays(runDate, 3), priority: Math.min(9, Math.max(0, ...campList.map(k => k.priority || 0)) + 1), status: 'Draft', include: [saved.cohort_id], exclude: [] });
}
/** Member ids of every saved cohort (GET /api/cohorts/:id → cohort_member), so campaign reach is de-duplicated exactly. */
function useCohortMembers(cohList) {
  const [m, setM] = useState({});
  const key = cohList.map(c => c.id + ':' + c.version + ':' + c.n).join('|');
  useEffect(() => { let dead = false; if (!cohList.length) return undefined;
    Promise.all(cohList.map(c => api.get('/cohorts/' + c.id).then(r => [c.id, (r.members || []).map(x => x.member_id)]).catch(() => [c.id, null]))).then(xs => { if (!dead) setM(Object.fromEntries(xs.filter(x => x[1]))); });
    return () => { dead = true; }; }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return m;
}

/* ───────────────────────── Build tab ───────────────────────── */
function BuildTab({ cb, setCb, cohList, asOf, onSaved }) {
  const est = useDebouncedPost('/cohorts/estimate', body(cb), 250);
  const baseCounts = useBaseCounts();
  const [pv, setPv] = useState('profile');
  const [saving, setSaving] = useState(false);
  const say = useToast();
  const aRef = useRef(null);
  const e = est.data;
  const has = cb.inc.some(ruleOn) || cb.exc.some(ruleOn);
  const upd = (list, id, patch) => setCb(s => ({ ...s, [list]: s[list].map(r => (r.id === id ? { ...r, ...patch } : r)) }));
  const del = (list, id) => setCb(s => ({ ...s, [list]: s[list].filter(r => r.id !== id) }));
  const add = (f, preset) => setCb(s => { const ex = !!F[f].excl; return { ...s, mode: 'build', [ex ? 'exc' : 'inc']: [...s[ex ? 'exc' : 'inc'], newRule(f, preset)] }; });
  const addRules = (inc, exc) => setCb(s => ({ ...s, mode: 'build', inc: [...s.inc, ...inc], exc: [...s.exc, ...exc.filter(r => !s.exc.some(x => x.f === r.f && F[r.f].type === 'bool'))] }));
  const B = e ? e.B : (baseCounts[cb.base] ?? 0);
  const logW = n => (B ? Math.max(2, Math.log10(n + 1) / Math.log10(B + 1) * 100) : 0).toFixed(1) + '%';
  const stepN = {}; (e ? e.steps : []).forEach(s => { stepN[String(s.id)] = s.n; });
  const tooFew = has && !!e && e.n < 1;
  const cantSave = !has || tooFew || saving || !cb.name.trim();
  const save = async andUse => {
    if (!cb.name.trim()) { say('Name the cohort first'); return; }
    setSaving(true);
    try {
      const r = await api.post('/cohorts', { id: cb.id || undefined, name: cb.name, refresh: cb.refresh, ...body(cb) });
      setCb(s => ({ ...s, id: r.cohort_id, version: r.version }));
      say(`${r.cohort_id} v${r.version} saved · ${fmt(r.row_count)} members · the cohort re-runs ${cb.refresh.toLowerCase()}`);
      onSaved(r, andUse);
    } catch (x) { say('Save failed: ' + x.message); } finally { setSaving(false); }
  };
  const lints = useMemo(() => {
    const L = [];
    if (!cb.inc.filter(ruleOn).length) L.push({ lvl: 'info', t: 'Add at least one rule so the cohort is more than the whole population.' });
    if (!cb.exc.some(r => r.f === 'optout')) L.push({ lvl: 'warn', t: 'Members who opted out of contact are still included.', fix: 'Exclude opt-outs', onFix: () => add('optout') });
    if (e && e.unsupported && e.unsupported.length) L.push({ lvl: 'warn', t: `Not answerable from the extract: ${e.unsupported.map(u => `${F[u.field] ? F[u.field].label : u.field} (${u.reason})`).join('; ')}.` });
    if (has && e && e.n < MIN_N) L.push({ lvl: 'error', t: `Fewer than ${MIN_N} members. Loosen a rule so results stay reliable and private.` });
    if (cb.inc.some(r => r.f === 'pdc') && !cb.inc.some(r => r.f === 'dx' || r.f === 'atc')) L.push({ lvl: 'info', t: 'Adherence reads best together with a condition or a medicine class.' });
    if (!L.length) L.push({ lvl: 'ok', t: 'Raw inputs only, opt-outs excluded, every rule answerable from the extract. Ready to save.' });
    return L;
  }, [cb, e, has]); // eslint-disable-line react-hooks/exhaustive-deps
  const LV = { ok: ['#F3F8FA', '#0A6F96', '✓'], info: ['#F3F8FA', '#566A74', 'i'], warn: ['#FFF1C7', '#8A5A00', '!'], error: ['#FDE7E7', '#E5484D', '!'] };
  let prevN = B;
  const rowVals = (r, ex) => {
    const on = ruleOn(r); let left = '—', leftSub = on ? '' : 'pick a value', w = '0%';
    if (on && e) {
      if (cb.logic === 'any' && !ex) { const n = e.alone ? e.alone[r.id] : undefined; if (n !== undefined) { left = fmt(n); leftSub = 'match this rule'; w = logW(n); } }
      else if (stepN[String(r.id)] !== undefined) { const n = stepN[String(r.id)]; left = fmt(n); leftSub = ex ? '−' + fmt(Math.max(0, prevN - n)) + ' removed' : (prevN ? Math.round(n / prevN * 100) + '% kept' : ''); w = logW(n); prevN = n; }
      else if (e.alone && e.alone[r.id] !== undefined) { left = fmt(e.alone[r.id]); leftSub = 'alone'; w = logW(e.alone[r.id]); }
    } else if (on) left = '…';
    return { left, leftSub, w, unsup: e ? (e.unsupported || []).find(u => String(u.id) === String(r.id)) : null };
  };
  const incRows = cb.inc.map(r => [r, rowVals(r, false)]);
  if (cb.logic === 'any' && stepN.any !== undefined) prevN = stepN.any;
  const excRows = cb.exc.map(r => [r, rowVals(r, true)]);
  const baseLabel = BASES.find(b => b.id === cb.base).label.toLowerCase();
  const pct = e && e.B ? (e.n / e.B * 100).toFixed(e.n / e.B < 0.1 ? 1 : 0) + '%' : '—';
  const modes = [['build', 'Rules'], ['ask', 'Describe'], ['sql', 'SQL']];
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <section style={{ flex: '1 1 620px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...CARD, padding: '22px 24px' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <input value={cb.name} onChange={ev => setCb(s => ({ ...s, name: ev.target.value }))} placeholder="Name this cohort" aria-label="Cohort name" style={{ width: '100%', fontSize: 26, fontWeight: 700, border: 0, background: 'transparent', padding: '2px 0', outline: 'none', color: '#10202A', letterSpacing: '-.015em' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#566A74', marginTop: 2 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: cb.id ? '#0A6F96' : '#8A5A00' }} />{cb.id ? `Editing ${cb.id} · saving creates v${(cb.version || 1) + 1}` : 'Draft · not saved yet'}</div>
            </div>
            <div style={{ display: 'flex', background: '#EBF1F4', borderRadius: 12, padding: 3 }}>
              {modes.map(([k, l]) => <button key={k} onClick={() => setCb(s => ({ ...s, mode: k }))} style={{ border: 0, borderRadius: 999, padding: '7px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', ...pill((cb.mode || 'build') === k) }}>{l}</button>)}
            </div>
          </div>
          <div style={{ ...LBL, margin: '18px 0 8px' }}>Start from</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 }}>
            {BASES.map(b => { const a = cb.base === b.id; return <button key={b.id} onClick={() => setCb(s => ({ ...s, base: b.id }))} aria-pressed={a} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', border: '1px solid ' + (a ? '#0A6F96' : '#DCE6EB'), boxShadow: a ? 'inset 0 0 0 1px #0A6F96' : 'none', background: a ? '#F3F8FA' : '#FFFFFF', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', color: '#10202A' }}>
              <span style={{ flex: 'none', width: 18, height: 18, borderRadius: '50%', marginTop: 1, border: '2px solid ' + (a ? '#0A6F96' : '#C9D6DC'), display: 'grid', placeItems: 'center' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: a ? '#0A6F96' : 'transparent' }} /></span>
              <span><span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{b.label}</span><span style={{ display: 'block', fontSize: 13, color: '#566A74' }}>{b.src} · {baseCounts[b.id] === undefined ? '…' : baseCounts[b.id] === null ? '—' : fmt(baseCounts[b.id])}</span></span>
            </button>; })}
          </div>
        </div>

        {(cb.mode || 'build') === 'build' && <>
          <AddRule aRef={aRef} cb={cb} onAdd={add} onRules={addRules} onDescribe={q => setCb(s => ({ ...s, mode: 'ask', kq: q }))}
            onTemplate={t => { setCb(s => ({ ...s, name: s.name || t.name, inc: t.inc.map(r => newRule(r.f, r)), exc: t.exc.map(r => newRule(r.f, r)) })); say('Template added · adjust any rule below'); }} />
          <div style={{ ...CARD, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', flexWrap: 'wrap', borderBottom: '1px solid #EBF1F4' }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Include members who match</span>
              <span style={{ display: 'flex', background: '#EBF1F4', borderRadius: 999, padding: 3 }}>
                {['all', 'any'].map(k => <button key={k} onClick={() => setCb(s => ({ ...s, logic: k }))} style={{ border: 0, borderRadius: 999, padding: '5px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', ...pill(cb.logic === k) }}>{k}</button>)}
              </span>
              <span style={{ fontSize: 14, color: '#566A74' }}>of these rules</span>
              <span style={{ marginLeft: 'auto', fontSize: 13, color: '#566A74' }}>{est.loading ? 'counting…' : cb.logic === 'any' ? 'Members need to match one rule' : 'Each rule narrows the group'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(0,1fr) 40px', gap: 14, alignItems: 'center', padding: '12px 20px', background: '#F3F8FA' }}>
              <div><div style={{ fontSize: 16, fontWeight: 700 }}>{e ? fmt(e.B) : '…'}</div><div style={{ height: 6, borderRadius: 12, background: '#0B2E57', marginTop: 5 }} /></div>
              <div style={{ fontSize: 14, color: '#3E525D' }}>Everyone in <b style={{ color: '#10202A' }}>{baseLabel}</b></div>
              <span />
            </div>
            {!cb.inc.length && <div style={{ padding: '26px 20px', textAlign: 'center', color: '#566A74', fontSize: 14, borderTop: '1px solid #EBF1F4' }}>No rules yet. Type in the box above, browse the fields, or start from a template.</div>}
            {incRows.map(([r, v], i) => <RuleRow key={r.id} r={r} v={v} join={i === 0 ? 'Where' : cb.logic === 'any' ? 'Or' : 'And'} onChange={p => upd('inc', r.id, p)} onDel={() => del('inc', r.id)} />)}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #EBF1F4' }}>
              <button className="hov-teal" onClick={() => aRef.current && aRef.current.focus()} style={{ border: '1px dashed #C9D6DC', background: '#FFFFFF', color: '#0A6F96', borderRadius: 999, padding: '7px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Add a rule</button>
            </div>
            <div style={{ borderTop: '6px solid #EBF1F4', background: '#FDE7E7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#E5484D' }}>Exclude anyone who</span>
                <span style={{ fontSize: 13, color: '#566A74' }}>Exclusions always win over the rules above</span>
              </div>
              {excRows.map(([r, v]) => <RuleRow key={r.id} r={r} v={v} exc onChange={p => upd('exc', r.id, p)} onDel={() => del('exc', r.id)} />)}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '12px 20px 16px', borderTop: '1px solid #FDE7E7' }}>
                {['optout', 'onco', 'pregnant', 'contacted'].filter(k => !cb.exc.some(r => r.f === k)).map(k => <button key={k} onClick={() => add(k)} style={{ border: '1px dashed #FF9A93', background: '#FFFFFF', color: '#E5484D', borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ {F[k].label}</button>)}
              </div>
            </div>
          </div>
        </>}

        {cb.mode === 'ask' && <Describe cb={cb} setCb={setCb} onRules={(inc, exc, label) => { addRules(inc, exc); say(`Added “${label}” from the catalogue · no new feature needed`); }} onAdd={(f, preset) => { add(f, preset); say(`Added “${F[f].label}” as a rule`); }} />}

        {cb.mode === 'sql' && <div style={{ ...CARD, padding: '20px 22px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>SQL on the longitudinal table</span>
            <span style={{ fontSize: 13, color: '#566A74' }}>Read-only. Returns members only, no scores. Compiled by the backend from your rules.</span>
          </div>
          {est.error ? <ErrorBox error={est.error} what="the estimate" /> : !e ? <Loading what="Compiling" /> : <>
            <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr)', borderRadius: 12, overflow: 'hidden', background: '#0B2E57' }}>
              <div style={{ padding: '16px 10px 16px 0', textAlign: 'right', font: "13px/1.6 'IBM Plex Mono',ui-monospace,monospace", color: '#6B8FA1', whiteSpace: 'pre', userSelect: 'none' }}>{sqlText(e).split('\n').map((_, i) => i + 1).join('\n')}</div>
              <pre aria-label="Compiled SQL" style={{ margin: 0, padding: '16px 16px 16px 4px', font: "13px/1.6 'IBM Plex Mono',ui-monospace,monospace", color: '#DCE6EB', whiteSpace: 'pre', overflow: 'auto' }}>{sqlText(e)}</pre>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 8, marginTop: 12 }}>
              {[['Read-only SELECT', true, 'No writes; the estimate and the saved cohort run the same statement'], ['Members only', true, 'Returns mask_id; identities stay closed until consent'], ['Raw inputs only', true, NOT_SELECTABLE.join(', ') + ' are outputs, never filters'], ['Opt-outs excluded', cb.exc.some(r => r.f === 'optout'), 'Consent guardrail'], ['Answerable from the extract', !(e.unsupported || []).length, (e.unsupported || []).length ? e.unsupported.map(u => u.reason).join('; ') : 'Every rule maps to a longitudinal column']].map(([name, ok, note]) => <div key={name} style={{ borderRadius: 12, padding: '10px 12px', background: ok ? '#DCF1F7' : '#FDE7E7' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: ok ? '#0A6F96' : '#B3261E' }}>{ok ? '✓' : '✕'} {name}</div>
                <div style={{ fontSize: 12, color: '#3E525D', marginTop: 2 }}>{note}</div>
              </div>)}
            </div>
          </>}
        </div>}

        <div style={{ ...CARD, padding: '18px 20px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Checks</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lints.map((l, i) => { const T = LV[l.lvl]; return <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 14px', borderRadius: 12, background: T[0], flexWrap: 'wrap' }}>
              <span style={{ flex: 'none', width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, background: T[1], color: '#FFFFFF' }}>{T[2]}</span>
              <span style={{ flex: 1, minWidth: 200, fontSize: 14, lineHeight: 1.45, color: '#10202A' }}>{l.t}</span>
              {l.fix && <button onClick={l.onFix} style={{ flex: 'none', border: 0, borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#0B2E57', color: '#FFFFFF', whiteSpace: 'nowrap' }}>{l.fix}</button>}
            </div>; })}
          </div>
        </div>
      </section>

      <aside style={{ flex: '0 1 390px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 90 }}>
        <section style={{ background: '#0B2E57', color: '#FFFFFF', borderRadius: 20, padding: '22px 24px', boxShadow: SH }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#C9D6DC' }}>Who you’ve got</span>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: tooFew ? '#FDE7E7' : '#133F70', color: tooFew ? '#B3261E' : '#9FD7E6', whiteSpace: 'nowrap' }}>{est.loading && !e ? 'counting…' : tooFew ? 'Too few to run' : has ? 'Live estimate' : 'Whole population'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10, flexWrap: 'wrap' }}><span style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1 }}>{e ? fmt(e.n) : '…'}</span></div>
          <div style={{ fontSize: 14, color: '#C9D6DC', marginTop: 6 }}>members · {pct} of {e ? fmt(e.B) : '…'} {baseLabel}</div>
          {est.error && <div style={{ marginTop: 12, fontSize: 13, color: '#FF9A93' }}>Could not count: {est.error.message}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 18 }}>
            {e && e.steps.map(s => { const r = [...cb.inc, ...cb.exc].find(x => String(x.id) === String(s.id)); return <div key={String(s.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}><span style={{ color: '#C9D6DC', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.id === 'any' ? s.t : (s.ex ? 'Not: ' : '') + (r ? ruleText(r) : s.id)}</span><b>{fmt(s.n)}</b></div>
              <div style={{ height: 6, background: '#133F70', borderRadius: 12, marginTop: 5, overflow: 'hidden' }}><div style={{ height: '100%', width: logW(s.n), background: s.ex ? '#FF9A93' : '#9FD7E6', borderRadius: 12, transition: 'width .4s ease' }} /></div>
            </div>; })}
          </div>
          <p style={{ margin: '16px 0 0', fontSize: 12.5, color: '#6B8FA1' }}>Live count from the database ({e ? fmt(e.B) : '…'} members in the longitudinal extract{asOf ? ', as of ' + fdate(asOf) + ' ' + String(asOf).slice(0, 4) : ''}){e && e.unsupported && e.unsupported.length ? ' · not in the extract: ' + e.unsupported.map(u => u.reason).join('; ') : ''}. Saving runs the same SQL.</p>
        </section>

        <section style={{ ...CARD, padding: '18px 20px' }}>
          <div style={{ display: 'flex', background: '#EBF1F4', borderRadius: 12, padding: 3 }}>
            {[['profile', 'Profile'], ['sample', 'Who matches'], ['overlap', 'Overlap']].map(([k, l]) => <button key={k} onClick={() => setPv(k)} style={{ flex: 1, border: 0, borderRadius: 999, padding: '7px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', ...pill(pv === k) }}>{l}</button>)}
          </div>
          {!e ? (est.error ? <ErrorBox error={est.error} what="the profile" /> : <Loading what="Profiling" />) : pv === 'profile' ? <Profile p={e.profile} /> : pv === 'sample' ? <Sample s={e.profile ? e.profile.sample : []} /> : <Overlap cb={cb} cohList={cohList} n={e.n} />}
        </section>

        <section style={{ ...CARD, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 14, fontWeight: 700, color: '#10202A' }}>Refresh
            <select value={cb.refresh} onChange={ev => setCb(s => ({ ...s, refresh: ev.target.value }))} style={{ border: '1px solid #DCE6EB', borderRadius: 12, padding: '8px 12px', fontSize: 14, background: '#FFFFFF', color: '#10202A', fontWeight: 600 }}>{REFRESH.map(o => <option key={o}>{o}</option>)}</select>
          </label>
          <button onClick={() => save(true)} disabled={cantSave} style={{ border: 0, borderRadius: 999, padding: '13px 18px', background: '#0B2E57', color: '#FFFFFF', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: cantSave ? 0.45 : 1, whiteSpace: 'nowrap' }}>{saving ? 'Saving…' : 'Save and set up a campaign →'}</button>
          <button onClick={() => save(false)} disabled={cantSave} style={{ border: '1px solid #DCE6EB', borderRadius: 999, padding: '12px 18px', background: '#FFFFFF', color: '#10202A', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: cantSave ? 0.45 : 1, whiteSpace: 'nowrap' }}>Save cohort only</button>
          <div style={{ fontSize: 13, color: '#566A74', textAlign: 'center' }}>{!has ? 'Add a rule to save.' : tooFew ? 'Too few members to save.' : !cb.name.trim() ? 'Name the cohort to save.' : cb.id ? `Saves as ${cb.id} v${(cb.version || 1) + 1} · runs ${cb.refresh.toLowerCase()}` : `Saves as a new cohort · runs ${cb.refresh.toLowerCase()}`}</div>
          <div style={{ background: '#DDF1F8', borderRadius: 12, padding: '12px 14px', fontSize: 13, lineHeight: 1.5, color: '#0A6F96' }}><b>After hand-off, care intelligence adds</b> risk score and tier · DoH triggers · next best action and script · call priority.</div>
        </section>
      </aside>
    </div>
  );
}
/** One clause per line: breaks before top-level WHERE / AND (sub-queries stay on their line). */
function prettySql(sql) {
  let out = '', depth = 0;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === '(') depth++; else if (c === ')') depth--;
    if (depth === 0 && sql.startsWith(' WHERE ', i)) { out += '\nWHERE '; i += 6; continue; }
    if (depth === 0 && sql.startsWith(' AND ', i)) { out += '\n  AND '; i += 4; continue; }
    out += c;
  }
  return out;
}
const sqlText = e => prettySql(e.sql) + (e.params && e.params.length ? `\n-- parameters: ${JSON.stringify(e.params)}` : '');

function useBaseCounts() {
  const [c, setC] = useState({});
  useEffect(() => { let dead = false; Promise.all(['daman', 'seha', 'pura'].map(b => api.post('/cohorts/estimate', { base: b, logic: 'all', inc: [], exc: [] }).then(r => [b, r.B]).catch(() => [b, null]))).then(xs => { if (!dead) setC(Object.fromEntries(xs)); }); return () => { dead = true; }; }, []);
  return c;
}
function useTemplateCounts(base, show) {
  const [c, setC] = useState({});
  useEffect(() => { let dead = false; if (!show) return undefined;
    Promise.all(TEMPLATES.map(t => api.post('/cohorts/estimate', { base, logic: 'all', inc: t.inc.map((r, i) => ({ ...r, id: 't' + i })), exc: t.exc.map((r, i) => ({ ...r, id: 'x' + i })) }).then(r => [t.name, r.n]).catch(() => [t.name, null]))).then(xs => { if (!dead) setC(Object.fromEntries(xs)); });
    return () => { dead = true; }; }, [base, show]);
  return c;
}

function AddRule({ aRef, cb, onAdd, onRules, onDescribe, onTemplate }) {
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const [browse, setBrowse] = useState(false); const [hi, setHi] = useState(0);
  const say = useToast();
  const showTpl = !cb.inc.length;
  const tplN = useTemplateCounts(cb.base, showTpl);
  const sugs = useMemo(() => {
    const t = q.trim().toLowerCase(); if (t.length < 2) return [];
    const out = [];
    const p = parseDescription(q); const nP = p.inc.length + p.exc.length;
    if (nP >= 2 || (nP === 1 && /\d|excluding|without|no /.test(t))) out.push({ kind: 'parse', badge: 'Sentence', label: [...p.inc.map(ruleText), ...p.exc.map(r => 'not ' + ruleText(r).toLowerCase())].join(' · '), sub: 'Turn the sentence into ' + nP + ' rule' + (nP > 1 ? 's' : ''), p });
    Object.entries(F).forEach(([k, d]) => {
      const opt = (d.opts || []).find(o => o[1].toLowerCase().includes(t) || o[0].toLowerCase() === t);
      const lab = d.type === 'lab' || d.type === 'labage' ? Object.entries(d.type === 'lab' ? LABS : LAB_DATES).find(([lk, L]) => (Array.isArray(L) ? L[0] : L).toLowerCase().includes(t) || lk === t) : null;
      if (opt) out.push({ kind: 'field', f: k, preset: { vs: [opt[0]] }, badge: badgeOf(k, d), label: d.label + ': ' + opt[1], sub: d.sub || d.col });
      else if (lab) out.push({ kind: 'field', f: k, preset: d.type === 'lab' ? { l: lab[0], op: LABS[lab[0]][2], v: LABS[lab[0]][3], v2: LABS[lab[0]][3] + 2 } : { l: lab[0] }, badge: badgeOf(k, d), label: d.type === 'lab' ? `${d.label}: ${LABS[lab[0]][0]}` : `${LAB_DATES[lab[0]]} overdue`, sub: d.sub || d.col });
      else if (d.label.toLowerCase().includes(t) || k === t || (d.cat || '').toLowerCase().includes(t)) out.push({ kind: 'field', f: k, badge: badgeOf(k, d), label: d.label, sub: d.sub || d.col });
    });
    return out.slice(0, 8);
  }, [q]);
  const apply = s => { if (s.kind === 'parse') { onRules(s.p.inc, s.p.exc); say('Sentence turned into rules · adjust any of them below'); } else onAdd(s.f, s.preset); setQ(''); setOpen(false); };
  const key = ev => { if (ev.key === 'ArrowDown') { setHi(h => Math.min(h + 1, sugs.length - 1)); ev.preventDefault(); } else if (ev.key === 'ArrowUp') { setHi(h => Math.max(h - 1, 0)); ev.preventDefault(); } else if (ev.key === 'Enter') { if (sugs[hi]) apply(sugs[hi]); } else if (ev.key === 'Escape') setOpen(false); };
  const nFields = Object.keys(F).length;
  return (
    <div style={{ ...CARD, padding: '18px 20px', position: 'relative', zIndex: 5 }}>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '2px solid ' + (open ? '#0A6F96' : '#F3F8FA'), borderRadius: 12, padding: '4px 6px 4px 16px', background: '#F3F8FA', transition: 'border-color .15s' }}>
          <span style={{ fontSize: 20, color: '#0A6F96', fontWeight: 700 }} aria-hidden="true">+</span>
          <input ref={aRef} value={q} onChange={ev => { setQ(ev.target.value); setOpen(true); setHi(0); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={key} placeholder="Add a rule, or describe people: “diabetes with HbA1c above 9”" aria-label="Add a rule or describe people" style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 16, padding: '12px 0', outline: 'none', color: '#10202A' }} />
          <button className="hov-teal" onClick={() => setBrowse(b => !b)} style={{ flex: 'none', border: '1px solid #DCE6EB', background: '#FFFFFF', borderRadius: 999, padding: '9px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', color: '#10202A', whiteSpace: 'nowrap' }}>{browse ? 'Hide fields' : `Browse ${nFields} fields`}</button>
        </div>
        {open && sugs.length > 0 && <div role="listbox" style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)', background: '#FFFFFF', border: '1px solid #DCE6EB', borderRadius: 12, boxShadow: '0 18px 40px rgba(16,58,82,.16)', padding: 6, zIndex: 40 }}>
          {sugs.map((s, i) => { const b = BADGE[s.badge] || ['#EBF1F4', '#3E525D']; return <div key={i} role="option" aria-selected={i === hi} onMouseDown={ev => { ev.preventDefault(); apply(s); }} onMouseEnter={() => setHi(i)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', background: i === hi ? '#F3F8FA' : 'transparent' }}>
            <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: b[0], color: b[1], minWidth: 76, textAlign: 'center', whiteSpace: 'nowrap' }}>{s.badge}</span>
            <span style={{ minWidth: 0, flex: 1 }}><span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{s.label}</span><span style={{ display: 'block', fontSize: 13, color: '#566A74', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sub}</span></span>
            <span style={{ flex: 'none', fontSize: 13, color: '#566A74', fontWeight: 700 }}>{i === hi ? '↵' : ''}</span>
          </div>; })}
          <div style={{ display: 'flex', gap: 14, padding: '8px 12px 4px', fontSize: 13, color: '#566A74', borderTop: '1px solid #EBF1F4', marginTop: 4 }}><span>↑ ↓ to move</span><span>↵ to add</span><span>Esc to close</span></div>
        </div>}
        {open && q.trim().length >= 2 && !sugs.length && <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)', background: '#FFFFFF', border: '1px solid #DCE6EB', borderRadius: 12, boxShadow: '0 18px 40px rgba(16,58,82,.16)', padding: '14px 16px', fontSize: 14, color: '#3E525D', zIndex: 40, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ flex: 1, minWidth: 200 }}>No existing feature matches “{q}”.</span><button onMouseDown={ev => { ev.preventDefault(); onDescribe(q); }} style={{ border: 0, borderRadius: 999, padding: '8px 14px', background: '#0B2E57', color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Describe it instead →</button></div>}
      </div>
      {browse && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '4px 16px', marginTop: 14, paddingTop: 14, borderTop: '1px solid #EBF1F4' }}>
        {CATS.map(c => <div key={c}>
          <div style={{ ...LBL, padding: '8px 8px 4px' }}>{c}</div>
          {Object.entries(F).filter(([, d]) => d.cat === c).map(([k, d]) => <button key={k} className="hov-row" onClick={() => onAdd(k)} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, textAlign: 'left', border: 0, background: 'transparent', padding: '7px 8px', borderRadius: 12, fontSize: 14, color: '#10202A', cursor: 'pointer' }}>{d.label}<span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: d.excl ? '#E5484D' : '#0A6F96' }}>{d.excl ? 'exclude' : '+'}</span></button>)}
        </div>)}
        <div>
          <div style={{ ...LBL, padding: '8px 8px 4px', color: '#B3261E' }}>Not selectable · outputs</div>
          {NOT_SELECTABLE.map(n => <div key={n} style={{ padding: '7px 8px', fontSize: 14, color: '#566A74' }}>{n}</div>)}
        </div>
      </div>}
      {showTpl && <div style={{ marginTop: 16 }}>
        <div style={{ ...LBL, marginBottom: 8 }}>Or start from a template</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 }}>
          {TEMPLATES.map(t => <button key={t.name} className="hov-bd" onClick={() => onTemplate(t)} style={{ textAlign: 'left', border: '1px solid #DCE6EB', background: '#FFFFFF', borderRadius: 12, padding: 14, cursor: 'pointer', color: '#10202A' }}>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>{t.name}</div>
            <div style={{ fontSize: 13, color: '#566A74', marginTop: 2, lineHeight: 1.4 }}>{t.d}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0A6F96', marginTop: 8 }}>{tplN[t.name] === undefined ? '…' : tplN[t.name] === null ? '—' : fmt(tplN[t.name])} members</div>
          </button>)}
        </div>
      </div>}
    </div>
  );
}

function RuleRow({ r, v, join, exc, onChange, onDel }) {
  const d = F[r.f]; if (!d) return null;
  const num = d.type === 'num', lab = d.type === 'lab', la = d.type === 'labage';
  const hasOp = num || lab, hasV = num || lab || la, between = hasOp && r.op === 'between';
  const allOpts = d.opts || [];
  const opts = d.type === 'code' && !r.open ? allOpts.filter((o, j) => j < 6 || (r.vs || []).includes(o[0])) : allOpts;
  const isChips = d.type === 'enum' || d.type === 'code';
  const unit = num ? d.unit : lab ? (LABS[r.l] || [])[1] : la ? 'days' : '';
  const ctl = (isChips || hasV) && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 10 }}>
    {lab && <select value={r.l} onChange={ev => { const L = LABS[ev.target.value]; onChange({ l: ev.target.value, op: L[2], v: L[3], v2: L[3] + 2 }); }} aria-label="Test" style={{ border: '1px solid #DCE6EB', borderRadius: 12, padding: '8px 10px', fontSize: 14, background: '#FFFFFF', color: '#10202A', fontWeight: 600 }}>{Object.entries(LABS).map(([k, L]) => <option key={k} value={k}>{L[0]}</option>)}</select>}
    {la && <select value={r.l} onChange={ev => onChange({ l: ev.target.value })} aria-label="Test" style={{ border: '1px solid #DCE6EB', borderRadius: 12, padding: '8px 10px', fontSize: 14, background: '#FFFFFF', color: '#10202A', fontWeight: 600 }}>{Object.entries(LAB_DATES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}
    {hasOp && <span style={{ display: 'flex', background: exc ? '#FFFFFF' : '#EBF1F4', border: exc ? '1px solid #FF9A93' : 0, borderRadius: 12, padding: 3 }}>
      {OPS.map(([o, aria]) => <button key={o} onClick={() => onChange({ op: o, v2: o === 'between' && !(Number(r.v2) > Number(r.v)) ? Number(r.v) + (lab ? 2 : 10) : r.v2 })} aria-label={aria} aria-pressed={r.op === o} style={{ border: 0, borderRadius: 12, padding: '5px 10px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', background: r.op === o ? (exc ? '#FDE7E7' : '#FFFFFF') : 'transparent', color: r.op === o ? '#10202A' : '#566A74' }}>{o === 'between' ? '↔' : o}</button>)}
    </span>}
    {la && <span style={{ fontSize: 14, color: '#3E525D' }}>not done in</span>}
    {hasV && <input type="number" step={lab ? 0.1 : 1} value={r.v ?? ''} onChange={ev => onChange({ v: ev.target.value === '' ? '' : Number(ev.target.value) })} aria-label="Value" style={{ width: 96, border: '1px solid #DCE6EB', borderRadius: 12, padding: '8px 10px', fontSize: 14, color: '#10202A', fontWeight: 600 }} />}
    {between && <><span style={{ color: '#566A74' }}>and</span><input type="number" step={lab ? 0.1 : 1} value={r.v2 ?? ''} onChange={ev => onChange({ v2: ev.target.value === '' ? '' : Number(ev.target.value) })} aria-label="Upper value" style={{ width: 96, border: '1px solid #DCE6EB', borderRadius: 12, padding: '8px 10px', fontSize: 14, color: '#10202A', fontWeight: 600 }} /></>}
    {unit && <span style={{ fontSize: 13.5, color: '#566A74' }}>{unit}</span>}
    {isChips && opts.map(([val, l]) => { const a = (r.vs || []).includes(val); return <button key={val} onClick={() => onChange({ vs: tog(r.vs || [], val) })} aria-pressed={a} style={{ borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', ...chip(a) }}>{l}</button>; })}
    {d.type === 'code' && allOpts.length > opts.length && <button onClick={() => onChange({ open: true })} style={{ border: '1px solid #C9D6DC', background: '#FFFFFF', color: '#0A6F96', borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+{allOpts.length - opts.length} more</button>}
  </div>;
  const sub = lab ? 'latest result in the extract' : (d.sub || d.cat);
  if (exc) return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(0,1fr) 40px', gap: 14, alignItems: 'start', padding: '14px 20px', borderTop: '1px solid #FDE7E7' }}>
      <div style={{ paddingTop: 2 }}><div style={{ fontSize: 16, fontWeight: 700 }}>{v.left}</div><div style={{ fontSize: 12, color: '#E5484D', marginTop: 4 }}>{v.leftSub}</div></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999, background: '#FDE7E7', color: '#B3261E' }}>Not</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{d.label}</span><span style={{ fontSize: 13, color: '#566A74' }}>{sub}</span>
          {v.unsup && <span style={{ fontSize: 12, fontWeight: 700, color: '#8A5A00' }}>cannot answer: {v.unsup.reason}</span>}
        </div>
        {ctl}
      </div>
      <button className="hov-x" onClick={onDel} aria-label="Remove exclusion" style={{ border: 0, background: 'transparent', color: '#566A74', fontSize: 15, width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', whiteSpace: 'nowrap' }}>✕</button>
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(0,1fr) 40px', gap: 14, alignItems: 'start', padding: '16px 20px', borderTop: '1px solid #EBF1F4' }}>
      <div style={{ paddingTop: 2 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{v.left}</div>
        <div style={{ height: 6, borderRadius: 12, background: '#EBF1F4', marginTop: 5, overflow: 'hidden' }}><div style={{ height: '100%', width: v.w, background: '#0B2E57', borderRadius: 12, transition: 'width .4s ease' }} /></div>
        <div style={{ fontSize: 13, color: '#566A74', marginTop: 4 }}>{v.leftSub}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999, background: '#DCF1F7', color: '#0A6F96' }}>{join}</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{d.label}</span><span style={{ fontSize: 13, color: '#566A74' }}>{sub}</span>
          {v.unsup && <span style={{ fontSize: 12, fontWeight: 700, color: '#8A5A00' }}>cannot answer: {v.unsup.reason}</span>}
        </div>
        {ctl}
      </div>
      <button className="hov-x" onClick={onDel} aria-label="Remove rule" style={{ border: 0, background: 'transparent', color: '#566A74', fontSize: 15, width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', whiteSpace: 'nowrap' }}>✕</button>
    </div>
  );
}

/* Describe mode: words → catalogue features → rules. (The design queries a knowledge graph when nothing fits; the kit has the feature catalogue only.) */
function Describe({ cb, setCb, onRules, onAdd }) {
  const [q, setQ] = useState(cb.kq || ''); const [res, setRes] = useState(null);
  const ask = text => {
    const t = text !== undefined ? text : q; setQ(t); setCb(s => ({ ...s, kq: t }));
    const p = parseDescription(t); const words = t.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3);
    const fields = Object.entries(F).filter(([k, d]) => !p.inc.concat(p.exc).some(r => r.f === k) && words.some(w => d.label.toLowerCase().includes(w))).slice(0, 5);
    setRes({ t, p, fields });
  };
  useEffect(() => { if (cb.kq && !res) ask(cb.kq); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const hits = res ? [...res.p.inc.map(r => [r, false]), ...res.p.exc.map(r => [r, true])] : [];
  const none = res && !hits.length && !res.fields.length;
  return (
    <div data-screen-label="Describe · feature catalogue" style={{ ...CARD, border: '1px solid #DCE6EB', overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 16px', borderBottom: res ? '1px solid #EBF1F4' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}><span style={{ fontSize: 15, fontWeight: 600 }}>Describe who you want to find</span><span style={{ fontSize: 13, color: '#566A74' }}>We match your words to the feature catalogue of the longitudinal extract and turn them into rules.</span></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <textarea rows={2} value={q} onChange={ev => setQ(ev.target.value)} onKeyDown={ev => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); ask(); } }} placeholder="e.g. Diabetes with HbA1c above 9 who missed refills, excluding cancer" aria-label="Describe who you want to find" style={{ flex: '1 1 360px', minWidth: 0, border: '1px solid #C9D6DC', borderRadius: 12, padding: '10px 12px', fontSize: 14.5, lineHeight: 1.5, background: '#FFFFFF', color: '#10202A', resize: 'vertical' }} />
          <button onClick={() => ask()} style={{ flex: 'none', border: 0, borderRadius: 999, padding: '0 18px', minHeight: 44, background: '#0B2E57', color: '#FFFFFF', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Find features</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {EXAMPLES.map(x => <button key={x} onClick={() => ask(x)} style={{ border: '1px solid #DCE6EB', background: '#F3F8FA', borderRadius: 5, padding: '5px 9px', fontSize: 12, color: '#3E525D', cursor: 'pointer', textAlign: 'left' }}>{x}</button>)}
        </div>
        {none && <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 12, background: '#FFF1C7', color: '#8A5A00', fontSize: 13 }}>Nothing in the catalogue matches. Try naming a condition, a test result, a medicine class, a visit type or a screening.</div>}
      </div>
      {res && !none && <div style={{ padding: '14px 20px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 14px', borderRadius: 12, background: '#F3F8FA', flexWrap: 'wrap' }}>
          <span style={{ flex: 'none', width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, background: '#0A6F96', color: '#FFFFFF' }}>✓</span>
          <span style={{ flex: 1, minWidth: 200, fontSize: 14 }}><b>Covered by existing features.</b> {hits.length + res.fields.length} catalogue feature{hits.length + res.fields.length === 1 ? '' : 's'} match; no new feature is needed.</span>
          {hits.length > 0 && <button onClick={() => onRules(res.p.inc, res.p.exc, res.t)} style={{ flex: 'none', border: 0, borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#0B2E57', color: '#FFFFFF', whiteSpace: 'nowrap' }}>Add all as rules</button>}
        </div>
        {hits.map(([r, ex]) => { const d = F[r.f], bd = BADGE[ex ? 'Exclude' : badgeOf(r.f, d)] || ['#EBF1F4', '#3E525D']; return <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid #EBF1F4', flexWrap: 'wrap' }}>
          <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: bd[0], color: bd[1], minWidth: 76, textAlign: 'center' }}>{ex ? 'Exclude' : badgeOf(r.f, d)}</span>
          <span style={{ flex: 1, minWidth: 200 }}><span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{ruleText(r)}</span><span style={{ fontSize: 13, color: '#566A74' }}>{d.col}</span></span>
          <button onClick={() => (ex ? onRules([], [r], ruleText(r)) : onRules([r], [], ruleText(r)))} style={{ border: '1px solid #C9D6DC', borderRadius: 999, padding: '6px 12px', background: '#FFFFFF', color: '#10202A', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Add rule</button>
        </div>; })}
        {res.fields.map(([k, d]) => <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid #EBF1F4', flexWrap: 'wrap' }}>
          <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#EBF1F4', color: '#3E525D', minWidth: 76, textAlign: 'center' }}>{badgeOf(k, d)}</span>
          <span style={{ flex: 1, minWidth: 200 }}><span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{d.label}</span><span style={{ fontSize: 13, color: '#566A74' }}>{d.sub || d.col}</span></span>
          <button onClick={() => onAdd(k)} style={{ border: '1px solid #C9D6DC', borderRadius: 999, padding: '6px 12px', background: '#FFFFFF', color: '#10202A', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Add rule</button>
        </div>)}
      </div>}
    </div>
  );
}

function Profile({ p }) {
  if (!p) return <div style={{ padding: '18px 4px', color: '#566A74', fontSize: 14 }}>No profile for an empty cohort.</div>;
  const COLS = ['#0A6F96', '#9FD7E6', '#C9D6DC'];
  const mx = Math.max(...p.age.map(a => a[1]), 0.01);
  const net = (p.net || []).map(([l, s]) => [/^Any/.test(l) ? 'In PHG network' : 'No PHG encounter', s]);
  const splits = [['Gender', p.sex], ['Plan', (p.plan || []).filter(x => x[1] > 0).length ? p.plan.filter(x => x[1] > 0) : p.plan], ['Region', [['Not in extract', 1]]], ['Network', net]];
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
    <div>
      <div style={SUB}>Age</div>
      {p.age.map(([l, s]) => <div key={l} style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) 40px', gap: 10, alignItems: 'center', fontSize: 13, margin: '5px 0' }}>
        <span style={{ color: '#3E525D' }}>{l}</span>
        <span style={{ height: 10, borderRadius: 999, background: '#EBF1F4', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: (s / mx * 100).toFixed(1) + '%', background: '#0B2E57', borderRadius: 999, transition: 'width .4s ease' }} /></span>
        <b style={{ textAlign: 'right' }}>{Math.round(s * 100)}%</b>
      </div>)}
    </div>
    {splits.map(([name, segs]) => <div key={name}>
      <div style={SUB}>{name}</div>
      <div style={{ display: 'flex', height: 12, borderRadius: 12, overflow: 'hidden', gap: 2, background: '#EBF1F4' }}>{(segs || []).map(([l, s], i) => <span key={l} style={{ flex: Math.max(s, 0.0001), background: COLS[i % 3], transition: 'flex .4s ease' }} />)}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 6, fontSize: 12.5, color: '#3E525D' }}>{(segs || []).map(([l, s], i) => <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: COLS[i % 3] }} />{l} <b style={{ color: '#10202A' }}>{Math.round(s * 100)}%</b></span>)}</div>
    </div>)}
  </div>;
}
function Sample({ s }) {
  if (!s || !s.length) return <div style={{ padding: '18px 4px', color: '#566A74', fontSize: 14 }}>No members match.</div>;
  return <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
    {s.slice(0, 8).map(m => <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '38px minmax(0,1fr)', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #EBF1F4' }}>
      <span style={{ width: 38, height: 38, borderRadius: '50%', background: '#EBF1F4', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>{m.ini}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}><b style={{ fontSize: 14.5 }}>{m.name}</b><span style={{ fontSize: 13, color: '#566A74' }}>{m.id} · {m.age} · {m.sex === 'F' ? 'woman' : 'man'}</span></span>
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>{(m.facts || []).map(f => <span key={f} style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#F3F8FA', color: '#3E525D' }}>{f}</span>)}</span>
      </span>
    </div>)}
    <p style={{ margin: '12px 0 0', fontSize: 12.5, lineHeight: 1.5, color: '#566A74' }}>Masked members with pseudonyms (the extract carries no names). Real identities open only in the care portal, after the member consents.</p>
  </div>;
}
function Overlap({ cb, cohList, n }) {
  const [rows, setRows] = useState(null);
  const key = JSON.stringify(body(cb)) + '|' + cohList.map(c => c.id + c.version).join(',');
  useEffect(() => { let dead = false; const others = cohList.filter(c => c.id !== cb.id).slice(0, 6); if (!others.length) { setRows([]); return undefined; }
    const b = body(cb);
    Promise.all(others.map(c => api.post('/cohorts/estimate', { ...b, logic: 'all', inc: [...(cb.logic === 'any' ? [] : b.inc), ...c.inc.map((r, i) => ({ ...strip(r), id: 'o' + i }))] }).then(r => ({ c, n: cb.logic === 'any' ? null : r.n })).catch(() => ({ c, n: null })))).then(xs => { if (!dead) setRows(xs); });
    return () => { dead = true; }; }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows) return <Loading what="Comparing with saved cohorts" />;
  if (!rows.length) return <div style={{ padding: '18px 4px', color: '#566A74', fontSize: 14 }}>No saved cohorts to compare with.</div>;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
    {rows.map(({ c, n: k }) => { const p = k === null || !n ? 0 : k / n; return <div key={c.id}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5 }}><span style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span><b>{k === null ? '—' : Math.round(p * 100) + '%'}</b></div>
      <div style={{ height: 10, borderRadius: 12, background: '#EBF1F4', marginTop: 5, overflow: 'hidden' }}><div style={{ height: '100%', width: (p * 100).toFixed(1) + '%', background: p > 0.4 ? '#8A5A00' : '#0A6F96', borderRadius: 12, transition: 'width .4s ease' }} /></div>
      <div style={{ fontSize: 13, color: '#566A74', marginTop: 3 }}>{k === null ? 'not comparable with “any” logic' : `${fmt(k)} members already in ${c.id}`}</div>
    </div>; })}
    <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.5, color: '#566A74' }}>Members in several cohorts are called once, by the highest-priority campaign.</p>
  </div>;
}

/* ───────────────────────── Cohorts (library) tab ───────────────────────── */
function LibraryTab({ cohorts, campList, ownerName, onNew, onEdit, onUse }) {
  const [q, setQ] = useState(''); const [sel, setSel] = useState(null);
  if (cohorts.loading && !cohorts.data) return <Loading what="Loading cohorts" />;
  if (cohorts.error) return <ErrorBox error={cohorts.error} retry={cohorts.reload} what="the cohort library" />;
  const all = cohorts.data.cohorts;
  const t = q.toLowerCase(), list = all.filter(c => !t || c.name.toLowerCase().includes(t) || c.id.toLowerCase().includes(t));
  const s = all.find(c => c.id === sel) || all[0];
  const used = id => campList.filter(k => (k.include || []).includes(id));
  return <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
    <section style={{ ...CARD, flex: '1 1 560px', minWidth: 0, padding: 8 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px 12px', flexWrap: 'wrap' }}>
        <input value={q} onChange={ev => setQ(ev.target.value)} placeholder="Search cohorts…" aria-label="Search cohorts" style={{ flex: 1, minWidth: 180, border: '1px solid #DCE6EB', borderRadius: 999, padding: '10px 12px', fontSize: 14, background: '#F3F8FA', color: '#10202A' }} />
        <button onClick={onNew} style={{ border: 0, borderRadius: 999, padding: '10px 16px', background: '#0B2E57', color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ New cohort</button>
      </div>
      {list.map(c => { const a = s && c.id === s.id, u = used(c.id).length; return <button key={c.id} className={a ? '' : 'hov-row2'} onClick={() => setSel(c.id)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px', gap: 14, alignItems: 'center', width: '100%', textAlign: 'left', border: 0, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', background: a ? '#BCE7F2' : '#FFFFFF', color: '#10202A' }}>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><b style={{ fontSize: 15.5 }}>{c.name}</b><span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#EBF1F4', color: '#3E525D', whiteSpace: 'nowrap' }}>Builder</span></span>
          <span style={{ display: 'block', fontSize: 13, color: '#566A74', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.id} · v{c.version} · {c.refresh} · {ownerName(c.owner)} · {u ? u + ' campaign' + (u > 1 ? 's' : '') : 'not in a campaign'}</span>
        </span>
        <span style={{ textAlign: 'right' }}><span style={{ display: 'block', fontSize: 20, fontWeight: 700 }}>{fmt(c.n)}</span><span style={{ fontSize: 12, fontWeight: 700, color: '#0A6F96' }}>members</span></span>
      </button>; })}
      {!list.length && <p style={{ padding: 16, margin: 0, color: '#566A74', fontSize: 14 }}>{all.length ? `No cohorts match “${q}”.` : 'No cohorts saved yet. Build one first.'}</p>}
    </section>
    {s && <aside style={{ ...CARD, flex: '0 1 440px', minWidth: 300, padding: '22px 24px', position: 'sticky', top: 90, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ fontSize: 13, color: '#566A74' }}>{s.id} · v{s.version} · Builder</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, lineHeight: 1.2 }}>{s.name}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10, flexWrap: 'wrap' }}><span style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1 }}>{fmt(s.n)}</span><span style={{ fontSize: 13.5, color: '#3E525D' }}>members · {(BASES.find(b => b.id === s.base) || BASES[0]).label}</span></div>
      </div>
      <div>
        <div style={SUB}>Definition</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {s.inc.map((r, i) => <div key={'i' + i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 14 }}><span style={{ flex: 'none', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999, background: '#DCF1F7', color: '#0A6F96' }}>{i ? (s.logic === 'any' ? 'Or' : 'And') : 'Where'}</span><span>{ruleText(r)}</span></div>)}
          {s.exc.map((r, i) => <div key={'x' + i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 14 }}><span style={{ flex: 'none', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999, background: '#FDE7E7', color: '#B3261E' }}>Not</span><span>{ruleText(r)}</span></div>)}
        </div>
      </div>
      <div>
        <div style={SUB}>Versions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) auto', gap: 10, alignItems: 'baseline', padding: '8px 0', borderBottom: '1px solid #EBF1F4', fontSize: 13.5 }}>
          <b style={{ color: '#0A6F96' }}>v{s.version}</b><span>{s.version > 1 ? 'Current definition · earlier versions are kept in cohort_rule' : 'Created'}</span><span style={{ color: '#566A74', fontSize: 12.5, whiteSpace: 'nowrap' }}>{fdate(s.updated_at)} · {fmt(s.n)}</span>
        </div>
      </div>
      <div>
        <div style={SUB}>Used in</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {used(s.id).map(k => <span key={k.id} style={{ fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 999, background: '#DCF1F7', color: '#0A6F96' }}>{k.name} · {k.status}</span>)}
          {!used(s.id).length && <span style={{ fontSize: 13.5, color: '#566A74' }}>No campaign yet</span>}
        </div>
      </div>
      <div style={{ background: '#F3F8FA', borderRadius: 12, padding: '12px 14px', font: "12.5px/1.7 'Urbanist',system-ui,sans-serif", color: '#3E525D' }}>COHORT · {s.id} v{s.version}<br />COHORT_MEMBER · {fmt(s.n)} rows · stable 10% holdout<br />tag · cohort:{s.id.toLowerCase()}@v{s.version}
        <details style={{ marginTop: 6 }}><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Compiled SQL</summary><pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', font: "12px/1.6 'IBM Plex Mono',ui-monospace,monospace" }}>{prettySql(s.sql)}</pre></details>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => onUse(s)} style={{ flex: 1, border: 0, borderRadius: 999, padding: '12px 16px', background: '#0B2E57', color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Use in a campaign →</button>
        <button onClick={() => onEdit(s)} style={{ border: '1px solid #DCE6EB', borderRadius: 999, padding: '12px 16px', background: '#FFFFFF', color: '#10202A', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Edit in builder</button>
      </div>
    </aside>}
  </div>;
}

/* ───────────────────────── Campaigns tab ───────────────────────── */
const ST = { Live: ['#0A6F96', '#FFFFFF', '#DCF1F7', '#0A6F96'], Scheduled: ['#0A6F96', '#FFFFFF', '#DDF1F8', '#0A6F96'], Draft: ['#C9D6DC', '#10202A', '#EBF1F4', '#3E525D'] };
function CampaignsTab({ campaigns, cohList, campN, runDate, open, onNew }) {
  if (campaigns.loading && !campaigns.data) return <Loading what="Loading campaigns" />;
  if (campaigns.error) return <ErrorBox error={campaigns.error} retry={campaigns.reload} what="campaigns" />;
  const list = campaigns.data.campaigns;
  const w0 = new Date(runDate + 'T00:00:00Z'); w0.setUTCDate(w0.getUTCDate() - ((w0.getUTCDay() + 6) % 7));   // Monday of the run week
  const weeks = Array.from({ length: 16 }, (_, i) => { const d = new Date(w0); d.setUTCDate(d.getUTCDate() + 7 * i); return d; });
  const weekCol = iso => Math.round((Date.parse(String(iso).slice(0, 10) + 'T00:00:00Z') - w0.getTime()) / 6048e5);
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <section style={{ ...CARD, padding: '20px 22px', overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Calendar · next 16 weeks</span>
        <span style={{ display: 'flex', gap: 14, fontSize: 12.5, color: '#3E525D' }}>
          {[['Live', '#0B2E57'], ['Scheduled', '#0B2E57'], ['Draft', '#C9D6DC']].map(([l, c]) => <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}</span>)}
        </span>
      </div>
      <div style={{ minWidth: 760 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '200px repeat(16,minmax(0,1fr))', gap: 0, fontSize: 13, color: '#566A74', fontWeight: 700 }}>
          <span />
          {weeks.map((d, i) => { const first = i > 0 && d.getUTCMonth() !== weeks[i - 1].getUTCMonth(); return <span key={i} style={{ padding: '0 0 6px 4px', borderLeft: '1px solid ' + (first ? '#DCE6EB' : '#EBF1F4'), color: i === 0 ? '#0A6F96' : '#566A74' }}>{i === 0 ? 'This wk' : first ? d.getUTCDate() + ' ' + MON[d.getUTCMonth()] : String(d.getUTCDate())}</span>; })}
        </div>
        {list.map(k => { const a = Math.max(0, Math.min(15, k.start ? weekCol(k.start) : 0)), b = Math.min(16, a + (k.weeks || 4)), s = ST[k.status] || ST.Draft; return <div key={k.id} style={{ display: 'grid', gridTemplateColumns: '200px repeat(16,minmax(0,1fr))', alignItems: 'center', padding: '6px 0' }}>
          <button onClick={() => open(k)} style={{ gridRow: 1, gridColumn: 1, textAlign: 'left', border: 0, background: 'transparent', padding: '0 10px 0 0', fontSize: 14, fontWeight: 700, color: '#10202A', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.name}</button>
          <span style={{ gridRow: 1, gridColumn: '2 / -1', height: 34, borderRadius: 12, background: '#F3F8FA' }} />
          <button onClick={() => open(k)} style={{ gridRow: 1, gridColumn: `${a + 2} / ${b + 2}`, height: 34, border: 0, borderRadius: 12, background: s[0], color: s[1], fontSize: 12.5, fontWeight: 700, textAlign: 'left', padding: '0 12px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fdate(k.start)} · {k.weeks} wk · {fmt(campN(k))}</button>
        </div>; })}
        {!list.length && <div style={{ padding: '18px 0', color: '#566A74', fontSize: 14 }}>No campaigns yet.</div>}
      </div>
    </section>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
      {list.map(k => { const s = ST[k.status] || ST.Draft; return <button key={k.id} className="hov-ring" onClick={() => open(k)} style={{ textAlign: 'left', background: '#FFFFFF', border: 0, borderRadius: 12, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer', color: '#10202A' }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, width: '100%' }}><span style={{ fontSize: 13, color: '#566A74' }}>{k.id} · priority {k.priority}</span><span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: s[2], color: s[3], whiteSpace: 'nowrap' }}>{k.status}</span></span>
        <span style={{ fontSize: 19, fontWeight: 700 }}>{k.name}</span>
        <span style={{ fontSize: 13.5, color: '#3E525D' }}>{k.goal || 'No goal yet'}</span>
        <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, padding: '12px 0', borderTop: '1px solid #EBF1F4', borderBottom: '1px solid #EBF1F4', width: '100%' }}>
          <span><span style={{ display: 'block', fontSize: 20, fontWeight: 700 }}>{fmt(campN(k))}</span><span style={{ fontSize: 13, color: '#566A74' }}>members</span></span>
        </span>
        <span style={{ fontSize: 13.5, color: '#3E525D', lineHeight: 1.5 }}>{fdate(k.start)} for {k.weeks} weeks · {chList(k.channels).join(', ') || '—'}</span>
      </button>; })}
      <button className="hov-dash" onClick={onNew} style={{ border: '2px dashed #C9D6DC', background: 'transparent', borderRadius: 12, padding: 22, minHeight: 220, fontSize: 16, fontWeight: 700, color: '#3E525D', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ New campaign</button>
    </div>
  </div>;
}

/* Campaign dialog · three steps: Who → What → Review (Studio_7: no Effort step). */
function CampaignDialog({ ce, setCe, cohList, campN, running, onClose, onSaved, runNow }) {
  const [saving, setSaving] = useState(false);
  const say = useToast();
  const trig = useApi('/rules/rule_trigger');
  const TR = (trig.data || []).slice().sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const set = p => setCe(s => ({ ...s, ...p }));
  const n = campN(ce);
  const ch = chList(ce.channels);
  const dx = [...new Set(cohList.filter(c => ce.include.includes(c.id)).flatMap(c => c.inc.filter(r => r.f === 'dx').flatMap(r => r.vs || [])))];
  const ok0 = !!(ce.name || '').trim() && ce.include.length > 0, ok1 = ce.mode === 'automated' || (ce.triggers || []).length > 0, ok2 = ch.length > 0, okAll = ok0 && ok1 && ok2;
  const steps = [['Who', ce.include.length ? ce.include.length + ' cohort' + (ce.include.length > 1 ? 's' : '') + ' · ' + fmt(n) : 'Pick cohorts', ok0], ['What', ce.mode === 'automated' ? 'All DoH triggers' : (ce.triggers || []).length + ' triggers', ok1], ['Review', 'Hand off', okAll]];
  const cohName = id => (cohList.find(k => k.id === id) || { name: id }).name;
  const tname = c => (TR.find(t => t.trigger_code === c) || {}).name || c;
  const payload = status => ({ id: ce.id, name: ce.name, goal: ce.goal, mode: ce.mode, triggers: ce.mode === 'business' ? ce.triggers : null, channels: ch.join(', '), nurses: ce.nurses ?? DEFAULT_EFFORT.nurses, calls_per_day: ce.calls_per_day ?? DEFAULT_EFFORT.calls_per_day, holdout: ce.holdout ?? DEFAULT_EFFORT.holdout, weeks: ce.weeks ?? DEFAULT_EFFORT.weeks, start: ce.start, priority: ce.priority, status, include: ce.include, exclude: ce.exclude });
  const send = async () => {
    if (!okAll) return;
    setSaving(true);
    try { const r = await api.post('/campaigns', payload('Live')); const sc = await api.post('/studio/scope', { campaign_id: r.campaign.id }); say(`${r.campaign.id} handed off · ${sc.scope ? sc.scope.members : ''} cohort members go to care intelligence and the care portal`); onSaved(); onClose(); await runNow(); }
    catch (e) { say('Hand-off failed: ' + e.message); } finally { setSaving(false); }
  };
  const setStatus = async status => { try { const r = await api.patch(`/campaigns/${ce.id}`, { status }); set({ status: r.campaign.status }); say(`${ce.id} is now ${status}`); onSaved(); } catch (e) { say('Could not change the status: ' + e.message); } };
  const review = [['Goal', ce.goal || '—'], ['Who', (ce.include.map(cohName).join(' + ') || '—') + (ce.exclude.length ? ', minus anyone in ' + ce.exclude.map(cohName).join(', ') : '')], ['What', ce.mode === 'automated' ? 'All approved DoH triggers for the cohort’s diagnoses' : (ce.triggers || []).map(tname).join(', ') || '—'], ['Channels', ch.join(', ') || '—']];
  const json = JSON.stringify({ campaign_id: ce.id, cohorts: ce.include, exclude: ce.exclude, trigger_mode: ce.mode, triggers: ce.mode === 'business' ? ce.triggers : 'all', channels: ch, start: ce.start, priority: ce.priority }, null, 1);
  const hint = !(ce.name || '').trim() ? 'Name the campaign at the top.' : !ce.include.length ? 'Add at least one cohort.' : !ok1 ? 'Pick at least one trigger.' : !ok2 ? 'Pick at least one channel.' : ce.step === 2 ? 'Care intelligence picks it up straight away: the rules run when you hand off.' : 'Step ' + (ce.step + 1) + ' of 3';
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(16,58,82,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflow: 'auto' }}>
      <div role="dialog" aria-label="Campaign" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 1040, background: '#FFFFFF', borderRadius: 20, boxShadow: '0 30px 80px rgba(16,58,82,.3)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '24px 28px 0' }}>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: '#0A6F96' }}>{ce.isNew ? 'New campaign' : ce.status + ' campaign'} · {ce.id}</div><input value={ce.name || ''} onChange={ev => set({ name: ev.target.value })} placeholder="Name the campaign" aria-label="Campaign name" style={{ fontSize: 26, fontWeight: 700, border: 0, outline: 'none', padding: '2px 0', color: '#10202A', background: 'transparent', width: '100%', letterSpacing: '-.01em' }} /></div>
          <button onClick={onClose} aria-label="Close" style={{ flex: 'none', border: 0, background: '#EBF1F4', width: 40, height: 40, borderRadius: '50%', fontSize: 16, cursor: 'pointer', color: '#10202A', whiteSpace: 'nowrap' }}>✕</button>
        </div>
        <div data-steps="3" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 6, padding: '18px 28px 0' }}>
          {steps.map(([l, sub, ok], i) => { const a = ce.step === i, done = ok && i < ce.step; return <button key={l} data-step={l} onClick={() => set({ step: i })} style={{ display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', border: 0, background: 'transparent', padding: '10px 0', borderBottom: '3px solid ' + (a ? '#0A6F96' : '#EBF1F4'), cursor: 'pointer', color: '#10202A', minWidth: 0 }}>
            <span style={{ flex: 'none', width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 700, background: a ? '#0B2E57' : done ? '#DCF1F7' : '#EBF1F4', color: a ? '#FFFFFF' : done ? '#0A6F96' : '#3E525D' }}>{done ? '✓' : i + 1}</span>
            <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{l}</span><span style={{ display: 'block', fontSize: 13, color: '#566A74', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span></span>
          </button>; })}
        </div>
        <div style={{ display: 'flex', gap: 24, padding: '24px 28px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {ce.step === 0 && <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 700, color: '#3E525D' }}>Goal<input value={ce.goal || ''} onChange={ev => set({ goal: ev.target.value })} placeholder="What should change for these members?" style={{ border: '1px solid #DCE6EB', borderRadius: 999, padding: '11px 12px', fontSize: 15, color: '#10202A', fontWeight: 500 }} /></label>
              <div>
                <div style={SUB}>Include cohorts</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cohList.map(c => { const a = ce.include.includes(c.id); return <button key={c.id} onClick={() => set({ include: tog(ce.include, c.id), exclude: ce.exclude.filter(x => x !== c.id) })} aria-pressed={a} style={{ display: 'grid', gridTemplateColumns: '22px minmax(0,1fr) auto', gap: 12, alignItems: 'center', textAlign: 'left', border: '1px solid ' + (a ? '#0A6F96' : '#DCE6EB'), background: a ? '#F3F8FA' : '#FFFFFF', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', color: '#10202A' }}>
                    <span style={{ width: 22, height: 22, borderRadius: 7, border: '2px solid ' + (a ? '#0A6F96' : '#C9D6DC'), background: a ? '#0A6F96' : '#FFFFFF', color: '#FFFFFF', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700 }}>{a ? '✓' : ''}</span>
                    <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{c.name}</span><span style={{ display: 'block', fontSize: 13, color: '#566A74', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.id} · {c.inc.map(ruleText).join(' · ')}</span></span>
                    <b style={{ fontSize: 15 }}>{fmt(c.n)}</b>
                  </button>; })}
                  {!cohList.length && <div style={{ fontSize: 14, color: '#566A74' }}>No saved cohorts yet. Build and save one first.</div>}
                </div>
              </div>
              <div>
                <div style={SUB}>Leave out anyone already in</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{cohList.filter(c => !ce.include.includes(c.id)).map(c => { const a = ce.exclude.includes(c.id); return <button key={c.id} onClick={() => set({ exclude: tog(ce.exclude, c.id) })} aria-pressed={a} style={{ border: '1px solid ' + (a ? '#E5484D' : '#DCE6EB'), background: a ? '#FDE7E7' : '#FFFFFF', color: a ? '#B3261E' : '#3E525D', borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{c.name}</button>; })}</div>
              </div>
            </>}
            {ce.step === 1 && <>
              <div>
                <div style={SUB}>Which needs should care intelligence act on?</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
                  {[['automated', 'All DoH triggers', 'Every approved trigger for the cohort’s diagnoses'], ['business', 'Pick triggers', 'Focus the campaign on a few needs']].map(([k, l, d]) => { const a = ce.mode === k; return <button key={k} aria-pressed={a} onClick={() => set(k === 'automated' ? { mode: k } : { mode: k, triggers: (ce.triggers || []).length ? ce.triggers : ['Trig9', 'Trig4'] })} style={{ textAlign: 'left', border: '1px solid ' + (a ? '#0A6F96' : '#DCE6EB'), boxShadow: a ? 'inset 0 0 0 1px #0A6F96' : 'none', background: '#FFFFFF', borderRadius: 12, padding: 14, cursor: 'pointer', color: '#10202A' }}><div style={{ fontSize: 14.5, fontWeight: 700 }}>{l}</div><div style={{ fontSize: 13, color: '#566A74', marginTop: 2 }}>{d}</div></button>; })}
                </div>
                {trig.loading && <Loading what="Loading the trigger library" />}
                {trig.error && <ErrorBox error={trig.error} retry={trig.reload} what="the trigger library" />}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {TR.filter(t => ce.mode === 'business' || !dx.length || /·/.test(t.pathway || '') || (t.pathway === 'T2D' && dx.includes('E11')) || (t.pathway === 'HTN' && dx.includes('I10'))).map(t => { const a = ce.mode === 'automated' || (ce.triggers || []).includes(t.trigger_code); return <button key={t.trigger_code} title={t.trigger_code} aria-pressed={a} onClick={() => { if (ce.mode === 'business') set({ triggers: tog(ce.triggers || [], t.trigger_code) }); }} style={{ borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: ce.mode === 'business' ? 'pointer' : 'default', whiteSpace: 'nowrap', ...chip(a) }}>{t.name}</button>; })}
                </div>
                <div style={{ fontSize: 13, color: '#566A74', marginTop: 8 }}>{ce.mode === 'automated' ? (dx.length ? 'Triggers for ' + dx.filter(x => x === 'E11' || x === 'I10').map(x => (x === 'E11' ? 'type 2 diabetes' : 'hypertension')).join(' and ') + ', plus the ones every member gets. Every trigger that fires becomes a ranked need.' : 'Every rulebook trigger that fires for a member becomes a ranked need.') : (ce.triggers || []).length + ' of ' + TR.length + ' triggers selected.'}</div>
              </div>
              <div>
                <div style={SUB}>Channels</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{[...new Set([...CHANNELS, ...ch])].map(x => { const a = ch.includes(x); return <button key={x} aria-pressed={a} onClick={() => set({ channels: tog(ch, x).join(', ') })} style={{ borderRadius: 999, padding: '7px 14px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', ...chip(a) }}>{x}</button>; })}</div>
              </div>
            </>}
            {ce.step === 2 && <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {review.map(([k, v]) => <div key={k} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr)', gap: 14, padding: '10px 0', borderBottom: '1px solid #EBF1F4', fontSize: 14.5 }}><span style={{ color: '#566A74', fontWeight: 600 }}>{k}</span><span>{v}</span></div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
                <div style={{ background: '#DCF1F7', borderRadius: 12, padding: '12px 14px' }}><b style={{ fontSize: 14, color: '#0A6F96' }}>1 · Cohort</b><div style={{ fontSize: 12.5, color: '#3E525D', marginTop: 2 }}>who is in</div></div>
                <div style={{ background: '#F3F8FA', borderRadius: 12, padding: '12px 14px' }}><b style={{ fontSize: 14 }}>2 · Care intelligence</b><div style={{ fontSize: 12.5, color: '#3E525D', marginTop: 2 }}>risk, DoH triggers, next best action</div></div>
                <div style={{ background: '#F3F8FA', borderRadius: 12, padding: '12px 14px' }}><b style={{ fontSize: 14 }}>3 · Care portal</b><div style={{ fontSize: 12.5, color: '#3E525D', marginTop: 2 }}>nurse call list, record after consent</div></div>
                <div style={{ background: '#DDF1F8', borderRadius: 12, padding: '12px 14px' }}><b style={{ fontSize: 14, color: '#0A6F96' }}>↩ Write-back</b><div style={{ fontSize: 12.5, color: '#3E525D', marginTop: 2 }}>outcomes feed the next run</div></div>
              </div>
              <div style={{ background: '#0B2E57', color: '#DCE6EB', borderRadius: 12, padding: '14px 16px', font: "12.5px/1.7 'Urbanist',system-ui,sans-serif", whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{json}</div>
            </>}
          </div>
          <aside style={{ flex: '0 1 300px', minWidth: 260, background: '#0B2E57', color: '#FFFFFF', borderRadius: 20, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: SH }}>
            <div><div style={{ fontSize: 13, color: '#C9D6DC', fontWeight: 700 }}>Members in scope</div><div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.05, marginTop: 4 }}>{fmt(n)}</div><div style={{ fontSize: 12.5, color: '#6B8FA1', marginTop: 2 }}>{ce.include.length > 1 ? 'De-duplicated across ' + ce.include.length + ' cohorts' : ce.include.length ? 'From ' + ce.include[0] : 'Add a cohort to start'}</div></div>
            {!ce.isNew && <div style={{ paddingTop: 12, borderTop: '1px solid #133F70' }}>
              <div style={{ fontSize: 13, color: '#C9D6DC', fontWeight: 700, marginBottom: 8 }}>Status</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{['Draft', 'Scheduled', 'Live', 'Paused'].map(s => { const a = ce.status === s; return <button key={s} aria-pressed={a} onClick={() => !a && setStatus(s)} style={{ border: '1px solid ' + (a ? '#9FD7E6' : '#133F70'), background: a ? '#9FD7E6' : 'transparent', color: a ? '#10202A' : '#C9D6DC', borderRadius: 999, padding: '5px 12px', fontSize: 12.5, fontWeight: 700, cursor: a ? 'default' : 'pointer' }}>{s}</button>; })}</div>
            </div>}
          </aside>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '16px 28px', borderTop: '1px solid #EBF1F4', background: '#F3F8FA', flexWrap: 'wrap' }}>
          {ce.step > 0 && <button onClick={() => set({ step: ce.step - 1 })} style={{ border: '1px solid #DCE6EB', borderRadius: 999, padding: '11px 18px', background: '#FFFFFF', color: '#10202A', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>← Back</button>}
          <span style={{ flex: 1, fontSize: 13.5, color: '#566A74', minWidth: 160 }}>{hint}</span>
          {ce.step < 2 && <button onClick={() => set({ step: ce.step + 1 })} style={{ border: 0, borderRadius: 999, padding: '12px 20px', background: '#0B2E57', color: '#FFFFFF', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Next →</button>}
          {ce.step === 2 && <button onClick={send} disabled={!okAll || saving || running} style={{ border: 0, borderRadius: 999, padding: '12px 22px', background: '#0B2E57', color: '#FFFFFF', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', opacity: okAll && !saving && !running ? 1 : 0.45, whiteSpace: 'nowrap' }}>{saving || running ? 'Handing off…' : ce.isNew ? 'Hand off to care intelligence →' : 'Save changes and hand off →'}</button>}
        </div>
      </div>
    </div>
  );
}
