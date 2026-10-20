import { shuffle } from './shuffle.js';
import { isComplete } from './studyQueue.js';
import { normalize } from './matching.js';

/**
 * Pick `n` cards for a round. Cards whose term or definition duplicates one already picked are
 * skipped, so every tile has exactly one correct partner.
 */
export function pickPairs(cards, n, random = Math.random) {
  const terms = new Set();
  const definitions = new Set();
  const picked = [];
  for (const card of shuffle(cards.filter(isComplete), random)) {
    const t = normalize(card.term);
    const d = normalize(card.definition);
    if (terms.has(t) || definitions.has(d)) continue;
    terms.add(t);
    definitions.add(d);
    picked.push(card);
    if (picked.length === n) break;
  }
  return picked;
}

/** Two tiles per pair (one term, one definition), shuffled together. */
export function buildTiles(pairs, random = Math.random) {
  return shuffle(
    pairs.flatMap((c) => [
      { id: `${c.id}:term`, pairId: c.id, kind: 'term', text: c.term },
      { id: `${c.id}:definition`, pairId: c.id, kind: 'definition', text: c.definition },
    ]),
    random,
  );
}

/** Two tiles match when they belong to the same card but show different sides. */
export const isMatch = (a, b) => a.pairId === b.pairId && a.kind !== b.kind;

export const isNewBest = (timeMs, bestMs) => bestMs == null || timeMs < bestMs;

/** 83450 -> "1:23.4" */
export function formatTime(ms) {
  const tenths = Math.floor(ms / 100) % 10;
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${Math.floor(totalSeconds / 60)}:${seconds}.${tenths}`;
}
