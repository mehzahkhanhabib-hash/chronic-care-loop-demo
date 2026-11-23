import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/** "How it works" navigation guide, shown when the Studio opens (once per browser session) and from the ? button in the header.
 *  Same pattern as the Circle Health Command Centre Action Hub's info modal: eyebrow, title, the layered journey, other features.
 *  Live counts come from the header's own reads (GET /api/cohorts, /api/intelligence/kpis, /api/portal/worklist). */
const LAYERS = [
  { n: 1, label: 'Layer one', to: '/builder', screen: 'Cohort builder', title: 'Who should we reach?', desc: 'Build a cohort from raw inputs in the 250-member longitudinal extract: diagnoses, latest results, visits, medicines. Save it, put it in a campaign and hand it off.', live: c => c.cohorts === null ? '' : `${c.cohorts} cohorts saved` },
  { n: 2, label: 'Layer two', to: '/intelligence', screen: 'Care intelligence', title: 'Who needs us most, and what for?', desc: 'Every handed-off member is scored against the CCC Rulebook: risk R = C + M + K + U + A (max 23), tier, the 14 triggers, alert colour and contact priority. Fired triggers become a care plan: Current, Next, Future, safety first.', live: c => c.members === null ? '' : `${c.members} members scored` },
  { n: 3, label: 'Layer three', to: '/portal', screen: 'Care portal', title: 'Who acts on it, and did it work?', desc: 'The nurse works the ranked list: consent, the call, the next best actions, the outcome. Every decision writes back and feeds the next intelligence run; only claims close a care gap.', live: c => c.today === null ? '' : `${c.today} to call today` },
];
const FEATURES = [
  ['🎯', 'One hand-off, three layers', 'The cohort you hand off is the set of members care intelligence shows and the care portal queues. Clear it from the banner to see everyone.'],
  ['📘', 'Rulebook as data', 'Scores, triggers, next best actions, priorities and cadence are rule tables from the CCC Rulebook, with a rule id on every result.'],
  ['🔍', 'Why this score', 'Every number traces back: longitudinal column → member value → rule id → condition → result → next best action.'],
  ['🩺', 'Member 360 from raw claims', 'History in the portal (claims, labs, medicines, admissions) comes from the raw claims, not the longitudinal snapshot.'],
];

export default function HowItWorks({ open, onClose, counts }) {
  const nav = useNavigate();
  useEffect(() => { if (!open) return; const f = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [open, onClose]);
  if (!open) return null;
  const go = to => { onClose(); nav(to); };
  return (
    <div className="hiw-ov" onClick={onClose}>
      <div className="hiw" role="dialog" aria-modal="true" aria-labelledby="hiw-t" onClick={e => e.stopPropagation()}>
        <div className="hiw-head">
          <div>
            <div className="hiw-eye">Control Command Center · Navigation guide</div>
            <h2 id="hiw-t">How it works</h2>
            <div className="hiw-sub">From the people we want to reach, to what each of them needs, to the nurse who acts on it.</div>
          </div>
          <button className="hiw-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="hiw-body">
          <div className="hiw-sec">The three-layer journey</div>
          <div className="hiw-strip">
            {LAYERS.map((l, i) => <button key={l.n} className="hiw-step" onClick={() => go(l.to)} title={`Open ${l.screen}`}>
              {i < LAYERS.length - 1 && <span className="hiw-arrow" aria-hidden="true">→</span>}
              <span className="hiw-num">{l.n}</span>
              <span className="hiw-lab">{l.label} · {l.screen}</span>
              <span className="hiw-tt">{l.title}</span>
              <span className="hiw-ds">{l.desc}</span>
              <span className="hiw-live">{l.live(counts)}</span>
              <span className="hiw-open">Open {l.screen} →</span>
            </button>)}
          </div>
          <div className="hiw-flow"><b>Cohort builder</b><span>hand-off: the cohort's members</span><b>Care intelligence</b><span>care plan · priority · worklist</span><b>Care portal</b><span>consent · outcomes · write-back</span><b>next run</b></div>
          <div className="hiw-sec">Other features</div>
          <div className="hiw-grid">{FEATURES.map(([i, t, d]) => <div className="hiw-fc" key={t}><span className="hiw-ic">{i}</span><div><div className="hiw-fn">{t}</div><div className="hiw-fd">{d}</div></div></div>)}</div>
          <div className="hiw-tip"><b>Tip.</b> Reopen this guide any time with the <b>?</b> button at the top. Start at layer one: build a cohort, save it, set up a campaign and hand it off.</div>
        </div>
        <div className="hiw-foot"><button className="hiw-btn ghost" onClick={onClose}>Close</button><button className="hiw-btn" onClick={() => go('/builder')}>Start with layer one →</button></div>
      </div>
    </div>
  );
}
