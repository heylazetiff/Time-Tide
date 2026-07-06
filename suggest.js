// suggest.js — a free, local heuristic for "when should I do this?"
//
// No API, no model call. It looks at when YOUR past focus sessions actually
// started (day-of-week + hour), weights recent history more heavily than old
// history, smooths across neighbouring hours, and proposes open slots in the
// next 7 days that match your own demonstrated rhythm.
//
// If there isn't enough history yet, it falls back to gentle, uncontroversial
// defaults (mid-morning / early evening) rather than pretending confidence
// it doesn't have.

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CANDIDATE_HOURS = [8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20, 21];
const MIN_SESSIONS_FOR_CONFIDENCE = 8;

function weekOf(dateISO) {
  return Math.floor(new Date(dateISO).getTime() / (7 * 24 * 3600 * 1000));
}

/** Build a score map of "weekday-hour" -> weighted frequency from history. */
function buildHistogram(sessions) {
  const now = Date.now();
  const scores = {};
  for (const s of sessions) {
    const started = new Date(s.startISO);
    if (isNaN(started)) continue;
    const ageWeeks = (now - started.getTime()) / (7 * 24 * 3600 * 1000);
    const recencyWeight = 1 / (1 + Math.max(0, ageWeeks) * 0.25); // recent counts more
    const weekday = started.getDay();
    const hour = started.getHours();
    const key = `${weekday}-${hour}`;
    scores[key] = (scores[key] || 0) + recencyWeight;

    // light smoothing into the adjacent hour on either side
    const prevKey = `${weekday}-${hour - 1}`;
    const nextKey = `${weekday}-${hour + 1}`;
    scores[prevKey] = (scores[prevKey] || 0) + recencyWeight * 0.35;
    scores[nextKey] = (scores[nextKey] || 0) + recencyWeight * 0.35;
  }
  return scores;
}

function defaultScore(hour) {
  // Gentle uncontroversial fallback curve when history is thin:
  // mild preference for mid-morning and early evening, avoids very early/late.
  if (hour >= 9 && hour <= 11) return 1.0;
  if (hour >= 19 && hour <= 20) return 0.9;
  if (hour >= 14 && hour <= 16) return 0.6;
  return 0.3;
}

/**
 * @param {Array} sessions - Store.getSessions()
 * @param {Array} existingTodos - other todos, to avoid stacking suggestions on identical slots
 * @param {number} estMinutes
 * @returns {{slots: Array<{dateISO, weekday, hour, label, score}>, confident: boolean}}
 */
export function suggestSlots(sessions, existingTodos, estMinutes) {
  const confident = sessions.length >= MIN_SESSIONS_FOR_CONFIDENCE;
  const histogram = buildHistogram(sessions);

  // Slots already suggested-and-kept by other pending todos this week, so we
  // spread work out rather than piling everything into one "best" hour.
  const taken = new Set(
    existingTodos
      .filter((t) => !t.done)
      .flatMap((t) => t.suggestedSlots || [])
      .map((s) => `${s.dateISO}-${s.hour}`)
  );

  const candidates = [];
  const today = new Date();
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    const weekday = d.getDay();
    const dateISO = d.toISOString().slice(0, 10);

    for (const hour of CANDIDATE_HOURS) {
      // skip slots in the past today
      if (dayOffset === 0 && hour <= today.getHours()) continue;

      const key = `${dateISO}-${hour}`;
      if (taken.has(key)) continue;

      const historyScore = histogram[`${weekday}-${hour}`] || 0;
      const score = confident
        ? historyScore + defaultScore(hour) * 0.15
        : defaultScore(hour) + historyScore * 0.3;

      candidates.push({ dateISO, weekday, hour, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.dateISO.localeCompare(b.dateISO));

  // Take top slots but keep them on different days where possible, so the
  // suggestion is "spread across your week" rather than 3 slots on one day.
  const chosen = [];
  const usedDays = new Set();
  for (const c of candidates) {
    if (chosen.length >= 3) break;
    if (usedDays.has(c.dateISO) && chosen.length < 2) continue;
    chosen.push(c);
    usedDays.add(c.dateISO);
  }
  if (chosen.length < 3) {
    for (const c of candidates) {
      if (chosen.length >= 3) break;
      if (!chosen.includes(c)) chosen.push(c);
    }
  }

  const label = (c) => {
    const d = new Date(c.dateISO + "T00:00:00");
    const dayLabel = DAY_NAMES[c.weekday];
    const hour12 = c.hour % 12 === 0 ? 12 : c.hour % 12;
    const ampm = c.hour < 12 ? "am" : "pm";
    return `${dayLabel} ${hour12}${ampm}`;
  };

  return {
    confident,
    estMinutes,
    slots: chosen.map((c) => ({ ...c, label: label(c) })),
  };
}
