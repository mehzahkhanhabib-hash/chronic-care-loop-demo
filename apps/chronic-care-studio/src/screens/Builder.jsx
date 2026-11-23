import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useApi, useDebouncedPost } from '../hooks/useApi';
import { Loading, ErrorBox, Empty, Chip, Avatar, Bar, Card, Section } from '../components/ui';
import { useToast } from '../components/Toast';
import { F, CATS, LABS, LAB_DATES, NOT_SELECTABLE, BASES, TEMPLATES, newRule, ruleOn, ruleText, strip, parseDescription } from '../lib/fields';
import { fmt, pct, dateShort } from '../lib/format';

const blank = () => ({ id: null, name: '', base: 'daman', logic: 'all', refresh: 'Nightly', inc: [], exc: [] });
const TRIGGERS_FALLBACK = ['Trig3', 'BPU', 'Trig4', 'Trig1', 'Trig2', 'Trig5', 'Trig9', 'Trig6', 'Trig12', 'Trig13', 'Trig7', 'Trig11', 'Trig10', 'Trig8'];

export default function Builder({ onChanged }) {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'build';
  const setTab = t => setSp(t === 'build' ? {} : { tab: t });
  const [cb, setCb] = useState(() => { const b = blank(); const t = TEMPLATES[0]; b.name = t.name; b.inc = t.inc.map(r => newRule(r.f, r)); b.exc = t.exc.map(r => newRule(r.f, r)); return b; });
  const cohorts = useApi('/cohorts');
  const campaigns = useApi('/campaigns');
  const [ce, setCe] = useState(null);   // campaign editor state
  const nav = useNavigate();
  const say = useToast();
  const [running, setRunning] = useState(false);
  const runNow = async () => {
    setRunning(true);
    try { const r = await api.post('/intelligence/runs', {}); say(`Rules run ${r.run_id}: ${r.fired} triggers fired, ${r.needs_opened} new needs, ${r.actions} actions`); onChanged && onChanged(); nav('/intelligence'); }
    catch (e) { say('Run failed: ' + e.message); } finally { setRunning(false); }
  };
  const nC = cohorts.data ? cohorts.data.cohorts.length : '…', nK = campaigns.data ? campaigns.data.campaigns.length : '…';
  return (
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      <div className="pagehead">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">Step 1 · Define who</div>
          <h1 className="title">{tab === 'build' ? 'Who are we looking for?' : tab === 'lib' ? 'Cohort library' : 'Campaigns'}</h1>
          <p className="desc">{tab === 'build' ? 'Rules are raw inputs from the longitudinal extract (diagnoses, results, visits, medicines). Risk scores, triggers and personas are outputs of care intelligence and are never used as filters (rulebook §2).' : tab === 'lib' ? 'Saved, versioned cohorts. Every save re-materialises the member list and keeps a stable 10% holdout.' : 'A campaign points one or more cohorts at care intelligence. A member belongs to the highest-priority live campaign; business campaigns keep only their chosen triggers.'}</p>
        </div>
        <div role="tablist" className="tabs">
          {[['build', 'Build'], ['lib', 'Library', nC], ['camp', 'Campaigns', nK]].map(([k, l, n]) => <button key={k} role="tab" className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}{n !== undefined && <span className="cnt">{n}</span>}</button>)}
        </div>
      </div>
      {tab === 'build' && <BuildTab cb={cb} setCb={setCb} cohorts={cohorts} campaigns={campaigns} onSaved={() => { cohorts.reload(); onChanged && onChanged(); }} runNow={runNow} running={running} openCampaign={c => setCe(c)} />}
      {tab === 'lib' && <LibraryTab cohorts={cohorts} campaigns={campaigns} onEdit={c => { setCb({ id: c.id, name: c.name, base: c.base, logic: c.logic, refresh: c.refresh, inc: c.inc.map(r => newRule(r.f, r)), exc: c.exc.map(r => newRule(r.f, r)) }); setTab('build'); }} onUse={c => setCe({ id: null, name: c.name + ' campaign', goal: '', mode: 'automated', triggers: [], channels: 'Voice', nurses: 6, calls_per_day: 25, holdout: 10, start: '2026-11-23', weeks: 8, priority: 5, status: 'Draft', include: [c.id], exclude: [] })} />}
      {tab === 'camp' && <CampaignsTab campaigns={campaigns} cohorts={cohorts} open={c => setCe(c)} runNow={runNow} running={running} />}
      {ce && <CampaignDialog ce={ce} setCe={setCe} cohorts={cohorts.data ? cohorts.data.cohorts : []} onClose={() => setCe(null)} onSaved={() => { campaigns.reload(); onChanged && onChanged(); }} runNow={runNow} />}
    </div>
  );
}

/* ───────────────────────── Build tab ───────────────────────── */
function BuildTab({ cb, setCb, cohorts, campaigns, onSaved, runNow, running, openCampaign }) {
  const body = useMemo(() => ({ base: cb.base, logic: cb.logic, inc: cb.inc.filter(ruleOn).map(strip), exc: cb.exc.filter(ruleOn).map(strip) }), [cb]);
  const est = useDebouncedPost('/cohorts/estimate', body, 250);
  const baseCounts = useBaseCounts();
  const [pv, setPv] = useState('profile');
  const [saving, setSaving] = useState(false);
  const say = useToast();
  const upd = (list, id, patch) => setCb(s => ({ ...s, [list]: s[list].map(r => r.id === id ? { ...r, ...patch } : r) }));
  const del = (list, id) => setCb(s => ({ ...s, [list]: s[list].filter(r => r.id !== id) }));
  const add = (f, exc) => setCb(s => ({ ...s, [exc ? 'exc' : 'inc']: [...s[exc ? 'exc' : 'inc'], newRule(f)] }));
  const e = est.data;
  const save = async (andUse) => {
    if (!cb.name.trim()) { say('Name the cohort first'); return; }
    setSaving(true);
    try {
      const r = await api.post('/cohorts', { id: cb.id || undefined, name: cb.name, base: cb.base, logic: cb.logic, refresh: cb.refresh, inc: cb.inc.filter(ruleOn).map(strip), exc: cb.exc.filter(ruleOn).map(strip) });
      setCb(s => ({ ...s, id: r.cohort_id }));
      say(`Saved ${r.cohort_id} v${r.version} · ${fmt(r.row_count)} members`);
      onSaved();
      if (andUse) openCampaign({ id: null, name: cb.name + ' campaign', goal: '', mode: 'automated', triggers: [], channels: 'Voice', nurses: 6, calls_per_day: 25, holdout: 10, start: '2026-11-23', weeks: 8, priority: 5, status: 'Live', include: [r.cohort_id], exclude: [] });
    } catch (x) { say('Save failed: ' + x.message); } finally { setSaving(false); }
  };
  const lints = useMemo(() => {
    const L = [];
    if (!cb.inc.filter(ruleOn).length) L.push({ ok: false, t: 'Add at least one include rule so the cohort is more than the whole base.' });
    if (!cb.exc.some(r => r.f === 'optout')) L.push({ ok: false, t: 'Exclude members who opted out of contact (consent guardrail G1c).', fix: () => add('optout', true) });
    if (e && e.unsupported && e.unsupported.length) L.push({ ok: false, t: `${e.unsupported.length} rule(s) cannot be answered by the extract: ${e.unsupported.map(u => `${F[u.field] ? F[u.field].label : u.field} (${u.reason})`).join('; ')}` });
    if (e && e.n > 0 && e.n < 5) L.push({ ok: false, t: `Only ${e.n} member(s) match. Small cohorts are fine for the demo; production needs 50 or more.` });
    if (cb.inc.some(r => r.f === 'pdc') && !cb.inc.some(r => r.f === 'dx' || r.f === 'atc')) L.push({ ok: false, t: 'Adherence rules read best together with a condition or medicine-class rule.' });
    if (!L.length) L.push({ ok: true, t: 'Inputs only, consent respected, rules answerable by the extract. Ready to save.' });
    return L;
  }, [cb, e]);
  return (
    <div className="row">
      <section className="col" style={{ flex: '1 1 620px' }}>
        <Card>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <input value={cb.name} onChange={ev => setCb(s => ({ ...s, name: ev.target.value }))} placeholder="Name this cohort" aria-label="Cohort name" style={{ width: '100%', fontSize: 26, fontWeight: 700, border: 0, background: 'transparent', padding: '2px 0', outline: 'none', letterSpacing: '-.015em' }} />
              <div className="sm mut" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: cb.id ? '#3F7A66' : '#B9770E' }} />{cb.id ? `${cb.id} · saved cohort, editing creates a new version` : 'Draft · not saved yet'}</div>
            </div>
            <div className="seg">{['Live', 'Daily', 'Nightly', 'Weekly'].map(o => <button key={o} className={cb.refresh === o ? 'on' : ''} onClick={() => setCb(s => ({ ...s, refresh: o }))}>{o}</button>)}</div>
          </div>
          <div className="lbl" style={{ margin: '18px 0 8px' }}>Start from</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 }}>
            {BASES.map(b => <button key={b.id} className={'base' + (cb.base === b.id ? ' on' : '') + (b.id === 'pura' ? ' off' : '')} aria-pressed={cb.base === b.id} onClick={() => setCb(s => ({ ...s, base: b.id }))}>
              <span className="radio"><span /></span><span><span style={{ display: 'block', fontWeight: 700 }}>{b.label}</span><span className="sm mut" style={{ display: 'block' }}>{b.src} · {baseCounts[b.id] === undefined ? '…' : fmt(baseCounts[b.id])}</span></span></button>)}
          </div>
        </Card>
        <AddRule onAdd={add} onTemplate={t => setCb(s => ({ ...s, name: s.name || t.name, inc: t.inc.map(r => newRule(r.f, r)), exc: t.exc.map(r => newRule(r.f, r)) }))} />
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', flexWrap: 'wrap', borderBottom: '1px solid var(--line2)' }}>
            <span className="sect-t">Include members who match</span>
            <span className="seg"><button className={cb.logic === 'all' ? 'on' : ''} onClick={() => setCb(s => ({ ...s, logic: 'all' }))}>all</button><button className={cb.logic === 'any' ? 'on' : ''} onClick={() => setCb(s => ({ ...s, logic: 'any' }))}>any</button></span>
            <span className="mut">of these rules</span>
            <span className="sm mut" style={{ marginLeft: 'auto' }}>{est.loading ? <><span className="spin" />counting…</> : e ? `Each step counts members in the longitudinal extract (${e.base_note})` : ''}</span>
          </div>
          <div className="rule" style={{ borderTop: 0, background: 'var(--bg2)', alignItems: 'center', padding: '12px 20px' }}>
            <div><div className="left">{e ? fmt(e.B) : '…'}</div><div style={{ height: 6, borderRadius: 6, background: 'var(--teal)', marginTop: 5 }} /></div>
            <div className="mut">Everyone in <b style={{ color: 'var(--ink)' }}>{BASES.find(b => b.id === cb.base).label}</b></div><span />
          </div>
          {!cb.inc.length && <div className="state" style={{ borderTop: '1px solid var(--line2)' }}>No rules yet. Type in the box above, browse the fields, or start from a template.</div>}
          {cb.inc.map((r, i) => <RuleRow key={r.id} r={r} i={i} logic={cb.logic} est={e} B={e ? e.B : 0} onChange={p => upd('inc', r.id, p)} onDel={() => del('inc', r.id)} />)}
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line2)' }}><button className="btn dashed sm" onClick={() => document.getElementById('addrule').focus()}>+ Add a rule</button></div>
          <div style={{ borderTop: '6px solid var(--line2)', background: '#FDF9FA' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', flexWrap: 'wrap' }}><span className="sect-t" style={{ color: 'var(--red)' }}>Exclude anyone who</span><span className="sm mut">Exclusions always win over the rules above</span></div>
            {cb.exc.map((r, i) => <RuleRow key={r.id} r={r} i={i} exc est={e} B={e ? e.B : 0} onChange={p => upd('exc', r.id, p)} onDel={() => del('exc', r.id)} />)}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '12px 20px 16px', borderTop: '1px solid var(--redL)' }}>
              {['optout', 'pregnant', 'onco', 'contacted'].filter(f => !cb.exc.some(r => r.f === f)).map(f => <button key={f} className="btn sm" style={{ border: '1px dashed #DDB0B6', background: '#fff', color: 'var(--red)' }} onClick={() => add(f, true)}>+ {F[f].label}</button>)}
            </div>
          </div>
        </div>
        <Section title="Compiled SQL" aside="read-only · what the backend ran for this estimate">
          {est.error ? <ErrorBox error={est.error} what="the estimate" /> : e ? <pre className="sql">{e.sql}{e.params && e.params.length ? `\n-- parameters: ${JSON.stringify(e.params)}` : ''}</pre> : <Loading what="Compiling" />}
          <div className="xs mut" style={{ marginTop: 8 }}>Not selectable as filters (care-intelligence outputs): {NOT_SELECTABLE.join(' · ')}</div>
        </Section>
        <Section title="Checks">
          <div className="col" style={{ gap: 8 }}>{lints.map((l, i) => <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 14px', borderRadius: 8, background: l.ok ? 'var(--greenS)' : 'var(--amberS)', flexWrap: 'wrap' }}><span style={{ flex: 'none', width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, background: l.ok ? 'var(--green)' : 'var(--amber)', color: '#fff' }}>{l.ok ? '✓' : '!'}</span><span style={{ flex: 1, minWidth: 200 }}>{l.t}</span>{l.fix && <button className="btn sm" onClick={l.fix}>Add exclusion</button>}</div>)}</div>
        </Section>
      </section>
      <aside className="col" style={{ flex: '0 1 390px', minWidth: 300, position: 'sticky', top: 120 }}>
        <Card dark>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><span style={{ fontSize: 14, fontWeight: 700, color: '#CDD6E2' }}>Who you’ve got</span><span className="chip" style={{ background: est.loading ? '#2A3B52' : '#1F4A3F', color: est.loading ? '#CDD6E2' : '#9FD9C3' }}>{est.loading ? 'counting…' : 'exact count · SQL'}</span></div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10 }}><span style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1 }}>{e ? fmt(e.n) : '…'}</span></div>
          <div style={{ fontSize: 14, color: '#CDD6E2', marginTop: 6 }}>members · {e ? pct(e.n, e.B) : '—'} of {e ? fmt(e.B) : '…'}</div>
          <div className="col" style={{ gap: 9, marginTop: 18 }}>
            {e && e.steps.map(s => { const r = [...cb.inc, ...cb.exc].find(x => String(x.id) === String(s.id)); return <div key={String(s.id)}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}><span style={{ color: '#CDD6E2', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.id === 'any' ? s.t : (s.ex ? 'Not: ' : '') + (r ? ruleText(r) : s.id)}</span><b>{fmt(s.n)}</b></div><Bar value={s.n} max={e.B} thin dark color={s.ex ? '#B5545E' : '#A9C3E0'} /></div>; })}
          </div>
          <p style={{ margin: '16px 0 0', fontSize: 12.5, color: '#98A4B5' }}>Counts come from SQL over the 377-column longitudinal table (member_longitudinal). The 10% holdout is applied when the cohort is saved.</p>
        </Card>
        <Card>
          <div className="seg" style={{ width: '100%' }}>{[['profile', 'Profile'], ['sample', 'Sample'], ['overlap', 'Overlap']].map(([k, l]) => <button key={k} className={pv === k ? 'on' : ''} style={{ flex: 1 }} onClick={() => setPv(k)}>{l}</button>)}</div>
          {!e ? <Loading what="Profiling" /> : pv === 'profile' ? <Profile p={e.profile} /> : pv === 'sample' ? <Sample s={e.profile.sample} /> : <Overlap cb={cb} cohorts={cohorts.data ? cohorts.data.cohorts : []} n={e.n} />}
        </Card>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn" style={{ padding: '13px 18px', fontSize: 15 }} disabled={saving || !cb.name.trim()} onClick={() => save(true)}>{saving ? 'Saving…' : 'Save and use in a campaign →'}</button>
          <button className="btn ghost" disabled={saving || !cb.name.trim()} onClick={() => save(false)}>Save cohort only</button>
          <button className="btn dark" disabled={running} onClick={runNow}>{running ? 'Running the rules…' : 'Hand off · run care intelligence now'}</button>
          <div className="sm mut" style={{ textAlign: 'center' }}>Saving writes cohort, cohort_rule and cohort_member (with holdout). Running evaluates every member against the rulebook and refreshes the worklist.</div>
          <div style={{ background: 'var(--tealB)', borderRadius: 8, padding: '12px 14px', fontSize: 13, lineHeight: 1.5, color: 'var(--teal)' }}><b>After hand-off, care intelligence adds</b> risk score and tier · the 14 rulebook triggers · next best action · CURRENT / NEXT / FUTURE care plan · the nurse worklist.</div>
        </Card>
      </aside>
    </div>
  );
}

function useBaseCounts() {
  const [c, setC] = useState({});
  useEffect(() => { let dead = false; Promise.all(['daman', 'seha', 'pura'].map(b => api.post('/cohorts/estimate', { base: b, logic: 'all', inc: [], exc: [] }).then(r => [b, r.B]).catch(() => [b, null]))).then(xs => { if (!dead) setC(Object.fromEntries(xs)); }); return () => { dead = true; }; }, []);
  return c;
}

function AddRule({ onAdd, onTemplate }) {
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const [browse, setBrowse] = useState(false); const [hi, setHi] = useState(0);
  const say = useToast();
  const sugs = useMemo(() => { const t = q.trim().toLowerCase(); if (!t) return []; return Object.entries(F).filter(([k, d]) => d.label.toLowerCase().includes(t) || k.includes(t) || (d.cat || '').toLowerCase().includes(t) || (d.opts || []).some(o => o[1].toLowerCase().includes(t))).slice(0, 8); }, [q]);
  const pick = (k) => { const d = F[k]; const preset = {}; const t = q.trim().toLowerCase(); if (d.type === 'code' || d.type === 'enum') { const o = d.opts.find(o => o[1].toLowerCase().includes(t)); if (o) preset.vs = [o[0]]; } onAdd(k, !!d.excl); setQ(''); setOpen(false); return preset; };
  const describe = () => { const p = parseDescription(q); if (!p.inc.length && !p.exc.length) { say('No feature in the catalogue matches that description'); return; } p.inc.forEach(r => onAdd(r.f) ); setQ(''); setOpen(false); say(`Added ${p.inc.length + p.exc.length} rule(s) from the description`); };
  const key = ev => { if (ev.key === 'ArrowDown') { setHi(h => Math.min(h + 1, sugs.length - 1)); ev.preventDefault(); } else if (ev.key === 'ArrowUp') { setHi(h => Math.max(h - 1, 0)); ev.preventDefault(); } else if (ev.key === 'Enter') { if (sugs[hi]) pick(sugs[hi][0]); else describe(); } else if (ev.key === 'Escape') setOpen(false); };
  return (
    <Card style={{ padding: '18px 20px', position: 'relative', zIndex: 5 }}>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '2px solid ' + (open ? 'var(--teal)' : 'var(--line)'), borderRadius: 8, padding: '4px 6px 4px 16px', background: 'var(--bg2)' }}>
          <span style={{ fontSize: 20, color: 'var(--teal)', fontWeight: 700 }} aria-hidden="true">+</span>
          <input id="addrule" value={q} onChange={ev => { setQ(ev.target.value); setOpen(true); setHi(0); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={key} placeholder="Add a rule, or describe people: “diabetes with HbA1c above 9, excluding opt-outs”" aria-label="Add a rule or describe people" style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 16, padding: '12px 0', outline: 'none' }} />
          <button className="btn ghost sm" onClick={() => setBrowse(b => !b)}>{browse ? 'Hide fields' : 'Browse fields'}</button>
        </div>
        {open && q.trim() && <div className="sug" role="listbox">
          {sugs.map(([k, d], i) => <button key={k} role="option" className="opt" style={{ background: i === hi ? 'var(--bg2)' : undefined }} onMouseDown={() => pick(k)}><span className="badge">{d.cat.split(' ')[0]}</span><span style={{ minWidth: 0, flex: 1 }}><span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{d.label}</span><span className="sm mut" style={{ display: 'block' }}>{d.sub || d.col}</span></span><span className="sm mut" style={{ fontWeight: 700 }}>{d.excl ? 'exclusion' : 'rule'}</span></button>)}
          <button className="opt" onMouseDown={describe}><span className="badge" style={{ background: 'var(--ink)', color: '#fff' }}>Describe</span><span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>Turn “{q}” into rules</span><span className="sm mut">Feature catalogue only; conditions, HbA1c, BP, screenings, admissions, adherence, opt-outs</span></span></button>
          <div style={{ display: 'flex', gap: 14, padding: '8px 12px 4px', fontSize: 13, color: 'var(--mut)', borderTop: '1px solid var(--line2)', marginTop: 4 }}><span>↑ ↓ to move</span><span>↵ to add</span><span>Esc to close</span></div>
        </div>}
      </div>
      {browse && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '4px 16px', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line2)' }}>
        {CATS.map(c => <div key={c}><div className="lbl" style={{ padding: '8px 8px 4px' }}>{c}</div>{Object.entries(F).filter(([, d]) => d.cat === c).map(([k, d]) => <button key={k} onClick={() => onAdd(k, !!d.excl)} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, textAlign: 'left', border: 0, background: 'transparent', padding: '7px 8px', borderRadius: 8, fontSize: 14 }}>{d.label}<span className="xs" style={{ marginLeft: 'auto', fontWeight: 700, color: d.excl ? 'var(--red)' : 'var(--mut)' }}>{d.excl ? 'exclude' : d.type}</span></button>)}</div>)}
        <div><div className="lbl" style={{ padding: '8px 8px 4px', color: 'var(--red)' }}>Not selectable</div>{NOT_SELECTABLE.map(n => <div key={n} className="sm mut" style={{ padding: '7px 8px' }}>{n} <span className="xs">· output</span></div>)}</div>
      </div>}
      <div style={{ marginTop: 16 }}>
        <div className="lbl" style={{ marginBottom: 8 }}>Or start from a template</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 }}>{TEMPLATES.map(t => <button key={t.name} className="base" style={{ flexDirection: 'column', gap: 2 }} onClick={() => onTemplate(t)}><span style={{ fontSize: 14.5, fontWeight: 700 }}>{t.name}</span><span className="sm mut" style={{ lineHeight: 1.4 }}>{t.d}</span></button>)}</div>
      </div>
    </Card>
  );
}

function RuleRow({ r, i, logic, exc, est, B, onChange, onDel }) {
  const d = F[r.f]; if (!d) return null;
  const step = est && est.steps.find(s => String(s.id) === String(r.id));
  const alone = est && est.alone ? est.alone[r.id] : undefined;
  const unsup = est && est.unsupported.find(u => String(u.id) === String(r.id));
  const chips = (d.type === 'enum' || d.type === 'code') ? d.opts : null;
  const toggle = v => onChange({ vs: (r.vs || []).includes(v) ? r.vs.filter(x => x !== v) : [...(r.vs || []), v] });
  const ops = d.type === 'lab' ? ['≥', '≤', 'between'] : d.type === 'num' ? (r.f === 'age' ? ['between', '≥', '≤'] : ['≥', '≤', '=']) : null;
  return (
    <div className={'rule' + (exc ? ' exc' : '')} style={{ background: ruleOn(r) ? undefined : 'var(--bg2)' }}>
      <div style={{ paddingTop: 2 }}>
        <div className="left">{step ? fmt(step.n) : ruleOn(r) ? '…' : '—'}</div>
        {!exc && <Bar value={step ? step.n : 0} max={B} thin />}
        <div className="sm" style={{ color: exc ? 'var(--red)' : 'var(--mut)', marginTop: 4 }}>{exc ? 'removed' : alone !== undefined ? `${fmt(alone)} alone` : logic === 'any' ? 'any of' : 'after this rule'}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}><span className="join">{exc ? 'Not' : i === 0 ? 'Where' : logic === 'any' ? 'Or' : 'And'}</span><span style={{ fontSize: 15, fontWeight: 700 }}>{d.label}</span><span className="sm mut">{d.sub || d.col}</span>{unsup && <Chip kind="AMBER" title={unsup.reason}>cannot answer: {unsup.reason}</Chip>}</div>
        <div className="ctl">
          {d.type === 'lab' && <select className="sel" value={r.l} onChange={ev => { const L = LABS[ev.target.value]; onChange({ l: ev.target.value, op: L[2], v: L[3], v2: L[3] + 2 }); }}>{Object.entries(LABS).map(([k, L]) => <option key={k} value={k}>{L[0]}</option>)}</select>}
          {d.type === 'labage' && <><select className="sel" value={r.l} onChange={ev => onChange({ l: ev.target.value })}>{Object.entries(LAB_DATES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><span className="mut">not done in</span></>}
          {ops && <span className="seg">{ops.map(o => <button key={o} className={r.op === o ? 'on' : ''} onClick={() => onChange({ op: o })} aria-label={o}>{o}</button>)}</span>}
          {(d.type === 'num' || d.type === 'lab' || d.type === 'labage') && <input type="number" className="num" value={r.v ?? ''} onChange={ev => onChange({ v: ev.target.value === '' ? '' : Number(ev.target.value) })} aria-label="Value" />}
          {r.op === 'between' && (d.type === 'num' || d.type === 'lab') && <><span className="mut">and</span><input type="number" className="num" value={r.v2 ?? ''} onChange={ev => onChange({ v2: Number(ev.target.value) })} aria-label="Upper value" /></>}
          <span className="sm mut">{d.type === 'lab' ? (LABS[r.l] || [])[1] : d.type === 'labage' ? 'days' : d.unit}</span>
          {chips && chips.map(([v, l]) => <button key={v} className={'codechip' + ((r.vs || []).includes(v) ? ' on' : '')} aria-pressed={(r.vs || []).includes(v)} onClick={() => toggle(v)}>{l}{d.type === 'code' ? ` · ${v}` : ''}</button>)}
          {chips && !(r.vs || []).length && <span className="sm" style={{ color: 'var(--amber)' }}>pick at least one</span>}
        </div>
      </div>
      <button className="x" onClick={onDel} aria-label="Remove rule">✕</button>
    </div>
  );
}

function Profile({ p }) {
  if (!p) return <Empty>No profile for an empty cohort.</Empty>;
  const split = (name, segs, colors) => <div key={name}><div className="lbl2">{name}</div><div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, background: 'var(--line2)' }}>{segs.map(([l, f], i) => <span key={l} style={{ flex: f || 0.001, background: colors[i % colors.length] }} />)}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 6 }} className="xs">{segs.map(([l, f], i) => <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length] }} />{l} <b>{Math.round(f * 100)}%</b></span>)}</div></div>;
  return <div className="col" style={{ gap: 16, marginTop: 16 }}>
    <div><div className="lbl2">Age</div>{p.age.map(([l, f]) => <div key={l} style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) 40px', gap: 10, alignItems: 'center', fontSize: 13, margin: '5px 0' }}><span className="mut">{l}</span><Bar value={f} max={1} /><b style={{ textAlign: 'right' }}>{Math.round(f * 100)}%</b></div>)}</div>
    {split('Sex', p.sex, ['#3F6C9F', '#A9C3E0'])}{split('Plan type', p.plan, ['#3F6C9F', '#A9C3E0', '#CDD6E2'])}{split('PHG network', p.net, ['#3F7A66', '#CDD6E2'])}
    <p className="xs mut" style={{ margin: 0, lineHeight: 1.5 }}>Shares of the matched members (AGE, GENDER, policy_type, phg_share_l12m_encounters).</p>
  </div>;
}
function Sample({ s }) {
  if (!s || !s.length) return <Empty>No members match.</Empty>;
  return <div style={{ marginTop: 10 }}>{s.map(m => <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '38px minmax(0,1fr)', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line2)' }}><Avatar text={m.ini} size="sm" soft /><span style={{ minWidth: 0 }}><span style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}><b style={{ fontSize: 14.5 }}>{m.name}</b><span className="sm mut mono">{m.id}</span><span className="sm mut">{m.age} · {m.sex}</span></span><span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>{(m.facts || []).map(f => <span key={f} className="chip">{f}</span>)}</span></span></div>)}<p className="xs mut" style={{ margin: '12px 0 0', lineHeight: 1.5 }}>Names are pseudonyms generated from the masked id; the extract carries no real names. Identities open only in the care portal, after consent.</p></div>;
}
function Overlap({ cb, cohorts, n }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { let dead = false; if (!cohorts.length) { setRows([]); return; }
    const base = { base: cb.base, logic: cb.logic, inc: cb.inc.filter(ruleOn).map(strip), exc: cb.exc.filter(ruleOn).map(strip) };
    Promise.all(cohorts.filter(c => c.id !== cb.id).slice(0, 6).map(c => api.post('/cohorts/estimate', { ...base, inc: [...base.inc, ...c.inc.map((r, i) => ({ ...strip(r), id: 'o' + i }))] }).then(r => ({ c, n: r.n })).catch(() => ({ c, n: null })))).then(xs => { if (!dead) setRows(xs); });
    return () => { dead = true; }; }, [JSON.stringify(cb), cohorts.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows) return <Loading what="Comparing with saved cohorts" />;
  if (!rows.length) return <Empty>No saved cohorts to compare with.</Empty>;
  return <div className="col" style={{ gap: 12, marginTop: 16 }}>{rows.map(({ c, n: k }) => <div key={c.id}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5 }}><span style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span><b>{k === null ? '—' : pct(k, n)}</b></div><Bar value={k || 0} max={n || 1} /><div className="sm mut" style={{ marginTop: 3 }}>{k === null ? 'not comparable' : `${fmt(k)} of your ${fmt(n)} are also in ${c.id}`}</div></div>)}<p className="xs mut" style={{ margin: 0, lineHeight: 1.5 }}>Members in several cohorts are called once, by the highest-priority live campaign.</p></div>;
}

/* ───────────────────────── Library tab ───────────────────────── */
function LibraryTab({ cohorts, campaigns, onEdit, onUse }) {
  const [q, setQ] = useState(''); const [sel, setSel] = useState(null);
  if (cohorts.loading) return <Loading what="Loading cohorts" />;
  if (cohorts.error) return <ErrorBox error={cohorts.error} retry={cohorts.reload} what="the cohort library" />;
  const list = cohorts.data.cohorts.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.id.toLowerCase().includes(q.toLowerCase()));
  const cur = list.find(c => c.id === sel) || list[0];
  const camps = campaigns.data ? campaigns.data.campaigns : [];
  return <div className="row">
    <section className="card tight" style={{ flex: '1 1 560px', minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px 12px', flexWrap: 'wrap' }}><input className="txt" value={q} onChange={e => setQ(e.target.value)} placeholder="Search cohorts…" aria-label="Search cohorts" style={{ flex: 1, minWidth: 180 }} /><button className="btn" onClick={() => onEdit({ id: null, name: '', base: 'daman', logic: 'all', refresh: 'Nightly', inc: [], exc: [] })}>+ New cohort</button></div>
      {!list.length && <Empty>No cohorts match “{q}”.</Empty>}
      {list.map(c => <button key={c.id} onClick={() => setSel(c.id)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px', gap: 14, alignItems: 'center', width: '100%', textAlign: 'left', border: 0, borderRadius: 8, padding: '12px 14px', background: cur && cur.id === c.id ? 'var(--tealS)' : 'transparent' }}>
        <span style={{ minWidth: 0 }}><span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><b style={{ fontSize: 15.5 }}>{c.name}</b>{camps.some(k => k.include.includes(c.id) && k.status === 'Live') && <Chip kind="GREEN">in a live campaign</Chip>}</span><span className="sm mut" style={{ display: 'block', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.id} · v{c.version} · {c.refresh} · {c.owner} · {c.inc.map(ruleText).join(' · ')}</span></span>
        <span style={{ textAlign: 'right' }}><span style={{ display: 'block', fontSize: 20, fontWeight: 700 }}>{fmt(c.n)}</span><span className="xs mut">members</span></span></button>)}
    </section>
    {cur && <aside className="card col" style={{ flex: '0 1 440px', minWidth: 300, gap: 16, position: 'sticky', top: 120 }}>
      <div><div className="sm mut mono">{cur.id} · v{cur.version} · {cur.base}</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, lineHeight: 1.2 }}>{cur.name}</div><div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10, flexWrap: 'wrap' }}><span style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1 }}>{fmt(cur.n)}</span><span className="sm" style={{ color: 'var(--ink2)' }}>members · refreshed {cur.refresh.toLowerCase()} · updated {dateShort(cur.updated_at)}</span></div></div>
      <div><div className="lbl2">Definition</div><div className="col" style={{ gap: 6 }}>{cur.inc.map((r, i) => <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 14 }}><span className="join rule" style={{ display: 'inline', padding: '2px 8px', border: 0 }}>{i === 0 ? 'Where' : cur.logic === 'any' ? 'Or' : 'And'}</span><span>{ruleText(r)}</span></div>)}{cur.exc.map((r, i) => <div key={'x' + i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 14 }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 6, background: 'var(--redL)', color: 'var(--redD)' }}>Not</span><span>{ruleText(r)}</span></div>)}</div></div>
      <div><div className="lbl2">Used in</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{camps.filter(k => k.include.includes(cur.id) || k.exclude.includes(cur.id)).map(k => <span key={k.id} className="chip" style={{ background: 'var(--tealS)', color: 'var(--teal)' }}>{k.name} · {k.status}{k.exclude.includes(cur.id) ? ' (excluded)' : ''}</span>)}{!camps.some(k => k.include.includes(cur.id) || k.exclude.includes(cur.id)) && <span className="sm mut">No campaign yet</span>}</div></div>
      <details style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}><summary style={{ cursor: 'pointer', padding: '9px 12px', fontSize: 12.5, fontWeight: 600, color: 'var(--ink2)', background: 'var(--bg2)' }}>Compiled SQL · what materialised cohort_member</summary><pre className="sql" style={{ borderRadius: 0 }}>{cur.sql}</pre></details>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn" style={{ flex: 1 }} onClick={() => onUse(cur)}>Use in a campaign →</button><button className="btn ghost" onClick={() => onEdit(cur)}>Edit in builder</button></div>
    </aside>}
  </div>;
}

/* ───────────────────────── Campaigns tab ───────────────────────── */
function CampaignsTab({ campaigns, cohorts, open, runNow, running }) {
  if (campaigns.loading) return <Loading what="Loading campaigns" />;
  if (campaigns.error) return <ErrorBox error={campaigns.error} retry={campaigns.reload} what="campaigns" />;
  const list = campaigns.data.campaigns; const coh = cohorts.data ? cohorts.data.cohorts : [];
  const weeks = Array.from({ length: 16 }, (_, i) => { const d = new Date('2026-11-16T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 7 * i); return d; });
  const col = s => s === 'Live' ? 'var(--teal)' : s === 'Scheduled' ? '#7E9DC1' : s === 'Paused' ? 'var(--amber)' : '#CDD6E2';
  return <div className="col">
    <Card style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}><span className="sect-t">Calendar · next 16 weeks</span><span style={{ display: 'flex', gap: 14 }} className="xs">{[['Live', 'var(--teal)'], ['Scheduled', '#7E9DC1'], ['Draft', '#CDD6E2']].map(([l, c]) => <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}</span>)}</span></div>
      <div style={{ minWidth: 760 }}>
        <div className="cal" style={{ padding: 0 }}><span /><span style={{ gridColumn: '2 / -1', display: 'grid', gridTemplateColumns: 'repeat(16,minmax(0,1fr))' }} className="xs mut">{weeks.map((d, i) => <span key={i} style={{ padding: '0 0 6px 4px', borderLeft: '1px solid var(--line2)' }}>{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>)}</span></div>
        {list.map(k => { const s = k.start ? Math.max(0, Math.round((Date.parse(k.start) - weeks[0].getTime()) / 6048e5)) : 0; const w = Math.max(1, Math.min(16 - s, k.weeks || 4)); return <div key={k.id} className="cal"><button onClick={() => open(k)} style={{ gridRow: 1, gridColumn: 1, textAlign: 'left', border: 0, background: 'transparent', padding: '0 10px 0 0', fontSize: 14, fontWeight: 700 }}>{k.name}</button><span className="track" /><button className="barc" onClick={() => open(k)} style={{ gridColumn: `${2 + s} / span ${w}`, background: col(k.status), color: k.status === 'Draft' ? 'var(--ink)' : '#fff' }}>{k.status} · {k.weeks} wk</button></div>; })}
      </div>
    </Card>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
      {list.map(k => { const n = coh.filter(c => k.include.includes(c.id)).reduce((a, c) => a + (c.n || 0), 0); return <button key={k.id} className="campcard" onClick={() => open(k)}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, width: '100%' }}><span className="sm mut mono">{k.id} · priority {k.priority}</span><Chip kind={k.status === 'Live' ? 'GREEN' : k.status === 'Scheduled' ? 'AMBER' : ''}>{k.status}</Chip></span>
        <span style={{ fontSize: 19, fontWeight: 700 }}>{k.name}</span><span className="sm" style={{ color: 'var(--ink2)' }}>{k.goal}</span>
        <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, padding: '12px 0', borderTop: '1px solid var(--line2)', width: '100%' }}><span><span style={{ display: 'block', fontSize: 20, fontWeight: 700 }}>{fmt(n)}</span><span className="sm mut">in cohorts (before holdout)</span></span><span><span style={{ display: 'block', fontSize: 20, fontWeight: 700 }}>{fmt((k.nurses || 0) * (k.calls_per_day || 0) * 5)}</span><span className="sm mut">calls a week</span></span><span><span style={{ display: 'block', fontSize: 20, fontWeight: 700 }}>{k.mode === 'business' ? (k.triggers || []).length : 14}</span><span className="sm mut">triggers acted on</span></span></span>
        <span className="sm" style={{ color: 'var(--ink2)', lineHeight: 1.5 }}>{k.start} · {k.weeks} weeks · {k.channels} · {k.include.map(id => (coh.find(c => c.id === id) || { name: id }).name).join(', ')}{k.exclude.length ? ` · not ${k.exclude.join(', ')}` : ''}</span></button>; })}
      <button className="campcard" style={{ border: '2px dashed #CDD6E2', background: 'transparent', minHeight: 220, alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--mut)' }} onClick={() => open({ id: null, name: '', goal: '', mode: 'automated', triggers: [], channels: 'Voice', nurses: 6, calls_per_day: 25, holdout: 10, start: '2026-11-23', weeks: 8, priority: 5, status: 'Draft', include: [], exclude: [] })}>+ New campaign</button>
    </div>
    <Card style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}><div style={{ flex: 1, minWidth: 240 }}><div className="sect-t">Hand off to care intelligence</div><div className="sm mut">Runs every live campaign through the rulebook now: scores, triggers, care plans and the nurse worklist are rebuilt (POST /api/intelligence/runs).</div></div><button className="btn dark" disabled={running} onClick={runNow}>{running ? 'Running…' : 'Run rules now →'}</button></Card>
  </div>;
}

function CampaignDialog({ ce, setCe, cohorts, onClose, onSaved, runNow }) {
  const [step, setStep] = useState(0); const [saving, setSaving] = useState(false);
  const say = useToast();
  const trig = useApi('/rules/rule_trigger');
  const triggers = trig.data ? trig.data.map(t => t.trigger_code) : TRIGGERS_FALLBACK;
  const tname = c => (trig.data || []).find(t => t.trigger_code === c)?.name || c;
  const set = p => setCe(s => ({ ...s, ...p }));
  const toggleIn = (list, id) => set({ [list]: ce[list].includes(id) ? ce[list].filter(x => x !== id) : [...ce[list], id] });
  const n = cohorts.filter(c => ce.include.includes(c.id)).reduce((a, c) => a + (c.n || 0), 0);
  const save = async (status) => {
    if (!ce.name.trim()) { say('Name the campaign'); return; }
    if (!ce.include.length) { say('Pick at least one cohort'); return; }
    setSaving(true);
    try { const r = await api.post('/campaigns', { ...ce, id: ce.id || undefined, status: status || ce.status, triggers: ce.mode === 'business' ? ce.triggers : null }); say(`${r.campaign.id} saved · ${r.campaign.status}`); onSaved(); if (status === 'Live') { onClose(); runNow(); } else onClose(); }
    catch (e) { say('Save failed: ' + e.message); } finally { setSaving(false); }
  };
  const setStatus = async (status) => { if (!ce.id) return save(status); try { await api.patch(`/campaigns/${ce.id}`, { status }); set({ status }); say(`${ce.id} is now ${status}`); onSaved(); } catch (e) { say(e.message); } };
  const steps = [['Who', `${ce.include.length} cohort(s) · ${fmt(n)}`], ['What', ce.mode === 'business' ? `${ce.triggers.length} triggers` : 'all 14 triggers'], ['How much', `${ce.nurses} nurses · ${ce.calls_per_day}/day`], ['Review', ce.status]];
  return <div className="dialog" onClick={onClose}><div className="box" role="dialog" aria-label="Campaign" onClick={e => e.stopPropagation()}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '24px 28px 0' }}><div style={{ flex: 1 }}><div className="eyebrow">{ce.id ? 'Campaign · ' + ce.id : 'New campaign'}</div><input value={ce.name || ''} onChange={e => set({ name: e.target.value })} placeholder="Name the campaign" aria-label="Campaign name" style={{ width: '100%', fontSize: 24, fontWeight: 700, border: 0, outline: 'none', padding: '2px 0', letterSpacing: '-.015em' }} /></div><button onClick={onClose} aria-label="Close" style={{ border: 0, background: 'var(--line2)', width: 40, height: 40, borderRadius: '50%', fontSize: 16 }}>✕</button></div>
    <div className="steps4">{steps.map(([l, s], i) => <button key={l} className={'step4' + (step === i ? ' on' : '')} onClick={() => setStep(i)}><span className="mk">{i + 1}</span><span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{l}</span><span className="sm mut" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s}</span></span></button>)}</div>
    <div style={{ display: 'flex', gap: 24, padding: '24px 28px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div className="col" style={{ flex: '1 1 480px', gap: 18 }}>
        {step === 0 && <><label className="lbl2" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>Goal<input className="txt" value={ce.goal || ''} onChange={e => set({ goal: e.target.value })} placeholder="What should change for these members?" /></label>
          <div><div className="lbl2">Include cohorts</div><div className="col" style={{ gap: 6 }}>{cohorts.map(c => <button key={c.id} className="base" style={{ display: 'grid', gridTemplateColumns: '22px minmax(0,1fr) auto', alignItems: 'center' }} aria-pressed={ce.include.includes(c.id)} onClick={() => toggleIn('include', c.id)}><span style={{ width: 22, height: 22, borderRadius: 7, border: '2px solid ' + (ce.include.includes(c.id) ? 'var(--teal)' : '#CDD6E2'), background: ce.include.includes(c.id) ? 'var(--teal)' : '#fff', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12 }}>{ce.include.includes(c.id) ? '✓' : ''}</span><span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{c.name}</span><span className="sm mut" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.id} · {c.inc.map(ruleText).join(' · ')}</span></span><b>{fmt(c.n)}</b></button>)}</div></div>
          <div><div className="lbl2">Leave out anyone already in</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{cohorts.filter(c => !ce.include.includes(c.id)).map(c => <button key={c.id} className={'codechip' + (ce.exclude.includes(c.id) ? ' on' : '')} onClick={() => toggleIn('exclude', c.id)}>{c.name}</button>)}</div></div></>}
        {step === 1 && <><div><div className="lbl2">Which needs should care intelligence act on?</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}><button className={'base' + (ce.mode === 'automated' ? ' on' : '')} onClick={() => set({ mode: 'automated' })}><span><span style={{ display: 'block', fontWeight: 700 }}>All rulebook triggers</span><span className="sm mut">Automated mode: every fired trigger becomes a need, ranked safety → goal.</span></span></button><button className={'base' + (ce.mode === 'business' ? ' on' : '')} onClick={() => set({ mode: 'business' })}><span><span style={{ display: 'block', fontWeight: 700 }}>Pick triggers</span><span className="sm mut">Business mode: only the chosen triggers become needs.</span></span></button></div>
          {ce.mode === 'business' && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>{triggers.map(c => <button key={c} className={'codechip' + (ce.triggers.includes(c) ? ' on' : '')} onClick={() => toggleIn('triggers', c)}>{c} · {tname(c)}</button>)}</div>}</div>
          <div><div className="lbl2">Channels</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{['Voice', 'WhatsApp', 'SMS', 'App'].map(ch => { const on = (ce.channels || '').split(/,\s*/).includes(ch); return <button key={ch} className={'codechip' + (on ? ' on' : '')} onClick={() => { const cur = (ce.channels || '').split(/,\s*/).filter(Boolean); set({ channels: (on ? cur.filter(x => x !== ch) : [...cur, ch]).join(', ') }); }}>{ch}</button>; })}</div></div></>}
        {step === 2 && <>{[['Nurses on the campaign', 'nurses', 1, 20, ''], ['Calls per nurse per day', 'calls_per_day', 5, 60, ''], ['Holdout (control group)', 'holdout', 0, 30, '%'], ['Duration', 'weeks', 1, 26, ' weeks']].map(([l, k, lo, hi, u]) => <div key={k}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 14, fontWeight: 700 }}><span>{l}</span><span style={{ fontSize: 20 }}>{ce[k]}{u}</span></div><input type="range" min={lo} max={hi} value={ce[k]} onChange={e => set({ [k]: Number(e.target.value) })} aria-label={l} style={{ width: '100%', marginTop: 6 }} /></div>)}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}><label className="lbl2" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>Start<input type="date" className="txt" value={ce.start || ''} onChange={e => set({ start: e.target.value })} /></label><label className="lbl2" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>Priority (1 = first)<select className="sel" value={ce.priority} onChange={e => set({ priority: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map(p => <option key={p}>{p}</option>)}</select></label></div></>}
        {step === 3 && <div className="col" style={{ gap: 10 }}><div className="kv"><dt>Cohorts</dt><dd>{ce.include.map(id => (cohorts.find(c => c.id === id) || { name: id }).name).join(', ') || '—'} ({fmt(n)} before holdout)</dd><dt>Mode</dt><dd>{ce.mode === 'business' ? `business · ${ce.triggers.join(', ') || 'no triggers chosen'}` : 'automated · all 14 triggers'}</dd><dt>Channels</dt><dd>{ce.channels}</dd><dt>Capacity</dt><dd>{ce.nurses} nurses × {ce.calls_per_day} calls/day · {ce.weeks} weeks from {ce.start}</dd><dt>Priority</dt><dd>{ce.priority}</dd><dt>Status</dt><dd>{ce.status}</dd></div>
          <div style={{ background: 'var(--tealB)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: 'var(--teal)', lineHeight: 1.5 }}>Going live hands the campaign to care intelligence: every member in the included cohorts (minus exclusions, holdout, extract exclusions and declined consent) is scored and gets a care plan on the next run.</div></div>}
      </div>
      <aside className="card" style={{ flex: '0 1 300px', background: 'var(--bg2)' }}>
        <div className="lbl2">Reach</div><div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{fmt(Math.round(n * (1 - (ce.holdout || 0) / 100)))}</div><div className="sm mut">members after {ce.holdout}% holdout</div>
        <div className="lbl2" style={{ marginTop: 16 }}>Capacity</div><div style={{ fontSize: 20, fontWeight: 700 }}>{fmt((ce.nurses || 0) * (ce.calls_per_day || 0) * 5 * (ce.weeks || 0))}</div><div className="sm mut">calls over the campaign</div>
        {ce.id && <><div className="lbl2" style={{ marginTop: 16 }}>Status</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{['Draft', 'Scheduled', 'Live', 'Paused'].map(s => <button key={s} className={'codechip' + (ce.status === s ? ' on' : '')} onClick={() => setStatus(s)}>{s}</button>)}</div></>}
      </aside>
    </div>
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '0 28px 24px', flexWrap: 'wrap' }}>{step < 3 && <button className="btn ghost" onClick={() => setStep(s => s + 1)}>Next →</button>}<button className="btn ghost" disabled={saving} onClick={() => save()}>Save {ce.status === 'Live' ? '' : 'as ' + ce.status}</button><button className="btn" disabled={saving} onClick={() => save('Live')}>{saving ? 'Saving…' : 'Go live and run the rules'}</button></div>
  </div></div>;
}
