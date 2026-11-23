/** Formatting and rulebook display helpers (no clinical logic lives here: colours, tiers and priorities come from the API). */
export const ALERT_COL = { RED: 'var(--risk-crit)', AMBER: 'var(--risk-high)', YELLOW: 'var(--risk-mod)', GREEN: 'var(--risk-low)' };
export const ALERT_TAG = { RED: 't-crit', AMBER: 't-warn', YELLOW: 't-info', GREEN: 't-ok' };
export const ALERT_TEXT = { RED: 'Same-day clinician · script stops', AMBER: 'Clinician review within 72 h', YELLOW: 'Next touchpoint', GREEN: 'Routine cadence' };
export const CLASS_LABEL = { safety: 'Safety', acute: 'Acute event', unctl: 'Uncontrolled', barrier: 'Barrier', gap: 'Verified gap', goal: 'Patient goal' };
export const CLASS_TAG = { safety: 't-crit', acute: 't-crit', unctl: 't-warn', barrier: 't-warn', gap: 't-info', goal: 't-ok' };
export const CLASS_DOT = { safety: 'crit', acute: 'crit', unctl: 'warn', barrier: 'warn', gap: '', goal: '' };
export const GAP_STATES = ['Potential', 'Verified', 'Scheduled', 'Reported', 'Closed'];
export const GAP_TAG = { Potential: 't-warn', Verified: 't-info', Scheduled: 't-ok', Reported: 't-acc', Closed: 't-neu' };
export const KIND_LABEL = { nba: 'Care plan action', call: 'Outreach call', follow_up: 'Follow-up', retry: 'Retry call', escalation: 'Escalation', nudge: 'Digital nudge', booking: 'Booking', verify: 'Verify in claims' };
export const PRIORITY_TEXT = { P1: 'Same day', P2: 'Next working day', P3: 'Within 3 working days', P4: 'Digital nudge' };
export const TIMES = ['09:00', '10:00', '10:30', '11:30', '13:00', '14:30', '16:00', '16:30', '18:00', '18:30'];

export const initials = n => (n || '?').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
export const first = n => (n || '').split(' ')[0];
export const num = (v, d = 0) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: 0 }));
export const money = v => (v === null || v === undefined ? '—' : 'AED ' + Math.round(Number(v)).toLocaleString('en-GB'));
export const moneyK = v => (v === null || v === undefined ? '—' : 'AED ' + (Number(v) >= 1000 ? Math.round(Number(v) / 1000) + 'k' : Math.round(Number(v))));
const D = iso => new Date(String(iso).slice(0, 10) + 'T12:00:00');
export const fmtDay = iso => { if (!iso) return '—'; const d = D(iso); return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
export const fmtDM = iso => { if (!iso) return '—'; const d = D(iso); return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', ''); };
export const fmtDT = ts => (ts ? ts.replace('T', ' ').slice(0, 16) : '—');
export const addDays = (iso, n) => { const d = D(iso); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const daysFrom = (iso, today) => Math.round((D(iso) - D(today)) / 86400000);
export const relDay = (iso, today) => { if (!iso) return '—'; const d = daysFrom(iso, today); if (isNaN(d)) return iso; return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : d > 1 ? fmtDM(iso) : `Overdue · ${-d} days`; };
export const fmtT = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
export const pathwayLabel = p => (p === 'T2D·HTN' ? 'Type 2 diabetes · Hypertension' : p === 'T2D' ? 'Type 2 diabetes' : p === 'HTN' ? 'Hypertension' : p || '—');
export const titleCase = s => (s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
export const dxName = c => ((c && (c.group4 || c.group3)) || '').replace(/^[A-Z0-9.]+ - [A-Z0-9.]+ /, '') || (c && c.diagnosis_id) || '';
export const genderWord = g => (g === 'F' ? 'Female' : g === 'M' ? 'Male' : g || '—');
/** Colour hint for a lab value against commonly used targets; the value itself is always the raw-claims observation. */
export const labFlag = (code, v) => {
  if (v === null || v === undefined) return '';
  if (code === '4548-4' || code === '17856-6') return v >= 8 ? 'crit' : v >= 7 ? 'warn' : 'ok';
  if (code === '8480-6') return v >= 160 ? 'crit' : v >= 140 ? 'warn' : 'ok';
  if (code === '8462-4') return v >= 100 ? 'crit' : v >= 90 ? 'warn' : 'ok';
  if (['33914-3', '62238-1', '69405-9', '48642-3', '48643-1'].includes(code)) return v < 30 ? 'crit' : v < 60 ? 'warn' : 'ok';
  return '';
};
export const FLAG_COL = { crit: 'var(--critical)', warn: 'var(--warning)', ok: 'var(--success)' };
