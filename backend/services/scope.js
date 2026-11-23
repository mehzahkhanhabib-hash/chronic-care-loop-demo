/**
 * Studio scope: the cohort (or campaign) the Chronic Care Studio last handed off. Cohort builder → care intelligence → care portal
 * all read the same scope, so the members a cohort selected are the members intelligence and the portal show.
 * Stored in app_setting 'studio_scope' as {kind: 'cohort'|'campaign', id, label, set_at, set_by}. Membership comes from cohort_member
 * (the cohort's saved members, control group included and flagged): a campaign scope = its include cohorts minus its exclude cohorts.
 */
const U = require('../importers/util');

function getScope(db) {
  const r = db.get("SELECT value FROM app_setting WHERE key = 'studio_scope'");
  if (!r || !r.value) return null;
  try { const s = JSON.parse(r.value); const ids = memberIds(db, s); return { ...s, members: ids.length, control_group: holdoutIds(db, s).size }; } catch (e) { return null; }
}
function setScope(db, { cohort_id, campaign_id } = {}, by) {
  if (!cohort_id && !campaign_id) { db.run("DELETE FROM app_setting WHERE key = 'studio_scope'"); return null; }
  let s;
  if (campaign_id) {
    const c = db.get('SELECT * FROM campaign WHERE campaign_id = ?', [campaign_id]);
    if (!c) throw Object.assign(new Error(`campaign ${campaign_id} not found`), { status: 404 });
    const coh = db.all("SELECT k.name FROM campaign_cohort cc JOIN cohort k ON k.cohort_id = cc.cohort_id WHERE cc.campaign_id = ? AND cc.role = 'include'", [campaign_id]).map(x => x.name);
    s = { kind: 'campaign', id: campaign_id, label: `${c.name} · ${coh.join(' + ') || 'no cohort'}` };
  } else {
    const k = db.get('SELECT * FROM cohort WHERE cohort_id = ?', [cohort_id]);
    if (!k) throw Object.assign(new Error(`cohort ${cohort_id} not found`), { status: 404 });
    s = { kind: 'cohort', id: cohort_id, label: k.name };
  }
  s.set_at = U.now(); s.set_by = by || null;
  db.run("INSERT OR REPLACE INTO app_setting VALUES ('studio_scope', ?)", [JSON.stringify(s)]);
  return getScope(db);
}
/** Member ids in a scope ({kind, id}). */
function memberIds(db, s) {
  if (!s) return [];
  if (s.kind === 'cohort') return db.all('SELECT member_id FROM cohort_member WHERE cohort_id = ? ORDER BY member_id', [s.id]).map(r => r.member_id);
  return db.all(`SELECT DISTINCT cm.member_id FROM campaign_cohort cc JOIN cohort_member cm ON cm.cohort_id = cc.cohort_id
    WHERE cc.campaign_id = ? AND cc.role = 'include' AND cm.member_id NOT IN (SELECT xm.member_id FROM campaign_cohort x JOIN cohort_member xm ON xm.cohort_id = x.cohort_id WHERE x.campaign_id = cc.campaign_id AND x.role = 'exclude')
    ORDER BY cm.member_id`, [s.id]).map(r => r.member_id);
}
function holdoutIds(db, s) {
  if (!s) return new Set();
  const cohorts = s.kind === 'cohort' ? [s.id] : db.all("SELECT cohort_id FROM campaign_cohort WHERE campaign_id = ? AND role = 'include'", [s.id]).map(r => r.cohort_id);
  if (!cohorts.length) return new Set();
  return new Set(db.all(`SELECT member_id FROM cohort_member WHERE holdout = 1 AND cohort_id IN (${cohorts.map(() => '?').join(',')})`, cohorts).map(r => r.member_id));
}
/** Resolve a request's scope: ?scope=active (the stored Studio scope), ?cohort=COH-…, or ?in_campaign=CMP-…. Returns null when unscoped. */
function resolve(db, q = {}) {
  let s = null;
  if (q.cohort) s = { kind: 'cohort', id: q.cohort };
  else if (q.in_campaign) s = { kind: 'campaign', id: q.in_campaign };
  else if (q.scope === 'active') s = getScope(db);
  if (!s) return null;
  const ids = memberIds(db, s);
  return { ...s, ids, holdout: holdoutIds(db, s), sqlList: ids.length ? ids.filter(x => /^[A-Za-z0-9_-]+$/.test(x)).map(x => `'${x}'`).join(',') : "''" };
}
module.exports = { getScope, setScope, memberIds, resolve };
