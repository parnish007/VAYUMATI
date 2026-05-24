/**
 * PA (Protective Action) Score service.
 *
 * Scores are kept in memory — fast for demo, resets on restart.
 * Score rules per CLAUDE.md:
 *   report_submitted: 20 pts
 *   mask_worn:        20 pts
 *   child_indoors:    20 pts
 *   alt_route:        20 pts
 *   soil_compliance:  20 pts  (non-farmers get this automatically)
 * Max: 100 pts/week, resets Monday 00:00 Nepal time.
 */

const ACTION_MAX = {
  report_submitted: 20,
  mask_worn:        20,
  child_indoors:    20,
  alt_route:        20,
  soil_compliance:  20,
};

// Badge unlock conditions (evaluated after each action).
// Counts track cumulative totals (not reset weekly).
const BADGE_CHECKS = {
  first_report:    (counts) => counts.report_submitted >= 1,
  mask_hero:       (counts) => counts.selfie_approved >= 1,
  clean_commuter:  (counts) => counts.alt_route >= 3,
  guardian:        (counts) => counts.child_indoors >= 2,
  soil_ally:       (counts, role) => role === "farmer" && counts.soil_compliance >= 1,
  "7day_streak":   (counts) => counts.streak_days >= 7,
};

// user_id → { breakdown, pa_score, badges, counts, streak_days, week_start }
const store = new Map();

function nepalWeekStart() {
  const nowMs = Date.now() + 5 * 3_600_000 + 45 * 60_000; // UTC+5:45
  const nepal = new Date(nowMs);
  const day = nepal.getUTCDay(); // 0=Sun, 1=Mon
  const daysBack = day === 0 ? 6 : day - 1;
  return nowMs - daysBack * 86_400_000 - (nepal.getUTCHours() * 3_600_000 + nepal.getUTCMinutes() * 60_000 + nepal.getUTCSeconds() * 1_000 + nepal.getUTCMilliseconds());
}

function initEntry(role) {
  const breakdown = {
    report_submitted: 0,
    mask_worn:        0,
    child_indoors:    0,
    alt_route:        0,
    soil_compliance:  role !== "farmer" ? 20 : 0, // auto-award non-farmers
  };
  const pa_score = role !== "farmer" ? 20 : 0;
  return {
    breakdown,
    pa_score,
    badges: [],
    counts: {
      report_submitted: 0,
      selfie_approved:  0,
      alt_route:        0,
      child_indoors:    0,
      soil_compliance:  role !== "farmer" ? 1 : 0,
      streak_days:      0,
    },
    streak_days: 0,
    week_start:  nepalWeekStart(),
  };
}

function maybeReset(entry) {
  const ws = nepalWeekStart();
  if (ws > entry.week_start) {
    // New week — reset weekly breakdown and score but keep counts and badges.
    const role = entry._role || "individual";
    const fresh = initEntry(role);
    fresh.badges      = entry.badges;
    fresh.counts      = entry.counts;
    fresh.streak_days = entry.streak_days;
    fresh._role       = role;
    return fresh;
  }
  return entry;
}

function computeBadges(entry, role) {
  const badges = new Set(entry.badges);
  for (const [badge, check] of Object.entries(BADGE_CHECKS)) {
    if (!badges.has(badge) && check(entry.counts, role)) {
      badges.add(badge);
    }
  }
  return [...badges];
}

/**
 * Get the current PA score for a user. Creates a default entry if missing.
 */
function getScore(userId, role) {
  if (!store.has(userId)) {
    const e = initEntry(role);
    e._role = role;
    store.set(userId, e);
  }
  const entry = maybeReset(store.get(userId));
  store.set(userId, entry);
  return {
    pa_score:    entry.pa_score,
    breakdown:   entry.breakdown,
    badges:      entry.badges,
    streak_days: entry.streak_days,
    ward_rank:   null, // computed separately if needed
  };
}

/**
 * Record a PA action for a user. Idempotent within a week (capped at ACTION_MAX).
 * Returns the updated score object + list of newly unlocked badges.
 */
function addAction(userId, action, role) {
  if (!store.has(userId)) {
    const e = initEntry(role);
    e._role = role;
    store.set(userId, e);
  }
  let entry = maybeReset(store.get(userId));

  const cap = ACTION_MAX[action];
  if (!cap) {
    store.set(userId, entry);
    return { ...getScore(userId, role), newBadges: [] };
  }

  const current = entry.breakdown[action] ?? 0;
  if (current < cap) {
    const gained = cap - current;
    entry.breakdown[action] = cap;
    entry.pa_score = Math.min(100, entry.pa_score + gained);
  }

  // Always increment cumulative count (even if score was already maxed).
  const countKey = action === "mask_worn" ? "selfie_approved" : action;
  entry.counts[countKey] = (entry.counts[countKey] ?? 0) + 1;

  const prevBadges = new Set(entry.badges);
  entry.badges = computeBadges(entry, role);
  const newBadges = entry.badges.filter((b) => !prevBadges.has(b));

  store.set(userId, entry);

  return {
    pa_score:    entry.pa_score,
    breakdown:   entry.breakdown,
    badges:      entry.badges,
    streak_days: entry.streak_days,
    ward_rank:   null,
    newBadges,
  };
}

module.exports = { getScore, addAction };
