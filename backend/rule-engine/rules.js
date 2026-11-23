/** In-memory view of the rule tables (Layer C) with the condition evaluator. Loaded fresh for every run so CSV edits + re-setup apply. */
const num = x => (typeof x === 'number' ? x : (x === null || x === undefined || x === '' ? null : (Number.isFinite(Number(x)) ? Number(x) : null)));

class Rules {
  constructor(db) {
    this.version = db.get('SELECT rule_version FROM rule_version LIMIT 1').rule_version;
    this.triggers = db.all('SELECT * FROM rule_trigger').sort((a, b) => num(a.sort_order) - num(b.sort_order));
    this.classes = db.all('SELECT * FROM rule_need_class').sort((a, b) => num(a.sort_order) - num(b.sort_order));
    this.classIndex = Object.fromEntries(this.classes.map(c => [c.class, c]));
    this.actions = Object.fromEntries(db.all('SELECT * FROM rule_action').map(a => [a.trigger_code, a]));
    this.tiers = db.all('SELECT * FROM rule_tier').map(t => ({ ...t, tier: num(t.tier), r_min: num(t.r_min), r_max: num(t.r_max) })).filter(t => t.tier !== null);
    this.cadence = db.all('SELECT * FROM rule_cadence');
    this.priority = db.all('SELECT * FROM rule_contact_priority');
    this.alerts = db.all('SELECT * FROM rule_alert').sort((a, b) => num(a.sort_order) - num(b.sort_order));
    this.writeback = Object.fromEntries(db.all('SELECT * FROM rule_writeback').map(w => [w.outcome, w]));
    this.slots = db.all('SELECT * FROM rule_slot');
    this.bands = db.all('SELECT * FROM risk_score_band');
    this.components = db.all('SELECT * FROM rule_risk_component');
    this.queueOrder = db.all('SELECT * FROM rule_queue_order').sort((a, b) => num(a.rank) - num(b.rank));
    this.conditions = {};
    for (const c of db.all('SELECT * FROM rule_condition')) {
      const key = `${c.rule_type}|${c.target}|${c.variant}`;
      (this.conditions[key] = this.conditions[key] || {})[c.group_no] = (this.conditions[key][c.group_no] || []).concat([c]);
    }
  }
  static test(c, v) {
    const x = v[c.column_name], op = c.op;
    if (op === 'is_null') return x === null || x === undefined;
    if (op === 'not_null') return x !== null && x !== undefined;
    if (op === 'missing_or_gt') return x === null || x === undefined || (typeof x === 'number' && x > Number(c.value));
    if (typeof x !== 'number') return false;
    const y = Number(c.value);
    return { '=': x === y, '>=': x >= y, '<=': x <= y, '>': x > y, '<': x < y }[op] || false;
  }
  /** Groups are OR-ed, conditions inside a group AND-ed. Returns the matching group's conditions or null. */
  match(ruleType, target, variant, v) {
    const groups = this.conditions[`${ruleType}|${target}|${variant}`];
    if (!groups) return null;
    for (const conds of Object.values(groups)) if (conds.every(c => Rules.test(c, v))) return conds;
    return null;
  }
  /** Which variant to evaluate a trigger with: the run setting ('rulebook' thresholds or 'extract' flags), falling back when a variant has no rows. */
  variantFor(t, setting) {
    const want = setting === 'extract' ? (t.use_variant === 'extract' ? 'extract' : 'rulebook') : 'rulebook';
    return this.conditions[`trigger|${t.trigger_code}|${want}`] ? want : (this.conditions[`trigger|${t.trigger_code}|rulebook`] ? 'rulebook' : 'extract');
  }
  tier(R) { const t = this.tiers.find(t => R >= t.r_min && R <= t.r_max); return t || this.tiers[this.tiers.length - 1]; }
  contactPriority(alert, firedCodes) {
    for (const r of this.priority) if (r.alert === alert && (!r.also_requires_trigger || firedCodes.has(r.also_requires_trigger))) return r;
    return this.priority.find(r => r.priority === 'P4') || { priority: 'P4', sla_days: null };
  }
  slotFor(rank) { for (const s of this.slots) if (s.from_rank && rank >= num(s.from_rank) && rank <= num(s.to_rank)) return s.slot; return 'FUTURE'; }
}
module.exports = { Rules, num };
