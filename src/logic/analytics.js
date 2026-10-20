import { addDays, isDue, isMastered, startOfDay } from './scheduler.js';

/** Local calendar day as "YYYY-MM-DD" (local, not UTC, so late-night study counts for the day you did it). */
export function dayKey(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Map of day -> number of cards studied that day, summed from session records. */
export function activityByDay(sessions) {
  const days = new Map();
  for (const s of sessions) {
    const key = dayKey(s.date);
    days.set(key, (days.get(key) ?? 0) + s.total);
  }
  return days;
}

/**
 * Consecutive days with any study, counting back from today. If you haven't studied yet TODAY
 * the streak is still alive (you have until midnight), so counting starts from yesterday.
 */
export function studyStreak(activity, now = Date.now()) {
  let day = startOfDay(now);
  if (!activity.has(dayKey(day))) day = addDays(day, -1);
  let streak = 0;
  while (activity.has(dayKey(day))) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

/** 0 = nothing; 1-4 = quartiles of the busiest day. */
export const heatLevel = (count, max) => (count <= 0 || max <= 0 ? 0 : Math.min(4, Math.ceil((4 * count) / max)));

/**
 * Grid for a GitHub-style heatmap: `weeks` columns of 7 days (Sunday first), ending with this week.
 * Days after today are null so the grid stays rectangular.
 */
export function buildHeatmap(activity, now = Date.now(), weeks = 26) {
  const today = startOfDay(now);
  const thisSunday = addDays(today, -new Date(today).getDay());
  const first = addDays(thisSunday, -7 * (weeks - 1));
  const counts = [...activity.values()];
  const max = counts.length ? Math.max(...counts) : 0;

  const columns = [];
  for (let w = 0; w < weeks; w++) {
    columns.push(
      Array.from({ length: 7 }, (_, d) => {
        const ts = addDays(first, w * 7 + d);
        if (ts > today) return null;
        const key = dayKey(ts);
        const count = activity.get(key) ?? 0;
        return { key, ts, count, level: heatLevel(count, max) };
      }),
    );
  }
  return { columns, max };
}

/** One row per deck for the stats table. Accuracy is null until a card has been answered. */
export function deckSummaries(decks, cards, cardStats, now = Date.now()) {
  const statById = new Map(cardStats.map((s) => [s.cardId, s]));
  return decks
    .map((deck) => {
      const own = cards.filter((c) => c.deckId === deck.id && c.term.trim() && c.definition.trim());
      let correct = 0;
      let incorrect = 0;
      for (const c of own) {
        const s = statById.get(c.id);
        if (s) { correct += s.correct; incorrect += s.incorrect; }
      }
      const answered = correct + incorrect;
      return {
        deck,
        cards: own.length,
        mastered: own.filter(isMastered).length,
        due: own.filter((c) => isDue(c, now)).length,
        answered,
        accuracy: answered ? correct / answered : null,
      };
    })
    .sort((a, b) => a.deck.title.localeCompare(b.deck.title));
}
