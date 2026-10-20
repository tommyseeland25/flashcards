import { getDb } from './db.js';
import { dueCounts } from '../logic/scheduler.js';

/** Every card in every deck (used by cross-deck review, due counts and the stats page). */
export async function listAllCards() {
  const db = await getDb();
  return db.getAll('cards');
}

/** deckId -> { due, new }. One pass over all cards, cheap even for thousands. */
export async function loadDueCounts(now = Date.now()) {
  const byDeck = new Map();
  for (const card of await listAllCards()) {
    if (!byDeck.has(card.deckId)) byDeck.set(card.deckId, []);
    byDeck.get(card.deckId).push(card);
  }
  return new Map([...byDeck].map(([id, cards]) => [id, dueCounts(cards, now)]));
}

/** Everything the stats page needs, read in one go. */
export async function loadStatsData() {
  const db = await getDb();
  const [decks, cards, cardStats, sessions] = await Promise.all([
    db.getAll('decks'), db.getAll('cards'), db.getAll('cardStats'), db.getAll('sessions'),
  ]);
  return { decks, cards, cardStats, sessions };
}
