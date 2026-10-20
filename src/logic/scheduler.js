/**
 * Spaced repetition scheduling: a simplified SM-2 (the SuperMemo-2 algorithm).
 *
 * The idea: the longer you can go without forgetting a card, the longer the next gap should be,
 * and cards you find hard should come back sooner. Each card carries four numbers:
 *   - repetitions: how many times in a row you've recalled it
 *   - interval:    days until the next review
 *   - ease:        a multiplier for how fast the interval grows (starts 2.5, never below 1.3)
 *   - lapses:      how many times you forgot it (for finding "leeches")
 *
 * Differences from textbook SM-2, on purpose:
 *   - four buttons (Again / Hard / Good / Easy) instead of a 0-5 grade, like Anki
 *   - "Again" lowers ease by a flat 0.2 and shows the card again in 10 minutes
 *   - cards become due at the START of a day, so reviewing at 8am or 8pm today doesn't change
 *     whether a card is due tomorrow
 *
 * Pure functions only: pass `now` in, get new field values out. No clock, no storage.
 */

export const RATINGS = ['again', 'hard', 'good', 'easy'];
export const MIN_EASE = 1.3;
export const MASTERED_INTERVAL_DAYS = 21; // Anki calls cards with 21+ day intervals "mature"
export const NEW_CARDS_PER_SESSION = 10;

const MINUTE = 60 * 1000;
const AGAIN_DELAY = 10 * MINUTE;
// Classic SM-2 quality grades for the three "remembered" answers.
const QUALITY = { hard: 3, good: 4, easy: 5 };

// ---- calendar helpers (local time, so "today" matches the user's wall clock) ----
export const startOfDay = (ts) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
/** Midnight `n` days after the day containing `ts`. Uses Date arithmetic so daylight-saving days work. */
export const addDays = (ts, n) => {
  const d = new Date(startOfDay(ts));
  d.setDate(d.getDate() + n);
  return d.getTime();
};
export const endOfDay = (ts) => addDays(ts, 1) - 1;

/**
 * The card's new scheduling fields after a rating. Returns only the fields that change,
 * so callers do `{ ...card, ...schedule(card, 'good') }`.
 */
export function schedule(card, rating, now = Date.now()) {
  if (rating === 'again') {
    return {
      ease: Math.max(MIN_EASE, card.ease - 0.2),
      interval: 0,
      repetitions: 0, // forgotten: start the ladder again
      lapses: card.lapses + 1,
      dueDate: now + AGAIN_DELAY,
    };
  }

  const q = QUALITY[rating];
  // SM-2's ease update. q=4 (good) leaves ease alone, q=5 raises it by 0.1, q=3 lowers it by 0.14.
  const ease = Math.max(MIN_EASE, card.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  const repetitions = card.repetitions + 1;

  let interval;
  if (repetitions === 1) interval = rating === 'easy' ? 4 : 1;
  else if (repetitions === 2) interval = rating === 'easy' ? 8 : rating === 'hard' ? 3 : 6;
  else {
    // From here intervals GROW multiplicatively: that's what makes long gaps cheap to maintain.
    const factor = rating === 'hard' ? 1.2 : ease * (rating === 'easy' ? 1.3 : 1);
    interval = Math.max(card.interval + 1, Math.round(card.interval * factor)); // always at least a day longer
  }

  return { ease, interval, repetitions, lapses: card.lapses, dueDate: addDays(now, interval) };
}

/** What each button would schedule, for labels like "Good · 6d". */
export function previewIntervals(card, now = Date.now()) {
  return Object.fromEntries(
    RATINGS.map((r) => {
      const next = schedule(card, r, now);
      return [r, r === 'again' ? '10m' : formatInterval(next.interval)];
    }),
  );
}

export function formatInterval(days) {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Number((days / 30).toFixed(1))}mo`;
  return `${Number((days / 365).toFixed(1))}y`;
}

// ---- which cards to review ----
export const isNew = (card) => card.dueDate === null;
/** Due = scheduled and due any time up to the end of today. */
export const isDue = (card, now = Date.now()) => card.dueDate !== null && card.dueDate <= endOfDay(now);
export const isMastered = (card) => card.interval >= MASTERED_INTERVAL_DAYS;

const hasContent = (c) => c.term.trim() !== '' && c.definition.trim() !== '';

/** { due, new } counts for a set of cards (blank cards ignored). */
export function dueCounts(cards, now = Date.now()) {
  let due = 0;
  let fresh = 0;
  for (const c of cards) {
    if (!hasContent(c)) continue;
    if (isNew(c)) fresh++;
    else if (isDue(c, now)) due++;
  }
  return { due, new: fresh };
}

/** Today's review queue: due cards (most overdue first), then up to `newLimit` unseen cards in deck order. */
export function reviewQueue(cards, now = Date.now(), { newLimit = NEW_CARDS_PER_SESSION } = {}) {
  const usable = cards.filter(hasContent);
  const due = usable.filter((c) => isDue(c, now)).sort((a, b) => a.dueDate - b.dueDate);
  const fresh = usable.filter(isNew).sort((a, b) => a.order - b.order).slice(0, newLimit);
  return [...due, ...fresh];
}
