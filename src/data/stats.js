import { getDb, newId } from './db.js';
import { applyAnswer } from '../logic/stats.js';

/** Update one card's running stats (read-modify-write in a single transaction). */
export async function recordAnswer(cardId, correct) {
  const db = await getDb();
  const tx = db.transaction('cardStats', 'readwrite');
  const current = await tx.store.get(cardId);
  await tx.store.put(applyAnswer(current, cardId, correct));
  await tx.done;
}

/** One row per finished study session; Phase 4's stats page reads these. */
export async function recordSession({ deckId, mode, correct, total }) {
  const db = await getDb();
  await db.put('sessions', { id: newId(), deckId, mode, date: Date.now(), correct, total });
}

export async function getMeta(key, fallback = null) {
  const db = await getDb();
  return (await db.get('meta', key))?.value ?? fallback;
}

export async function setMeta(key, value) {
  const db = await getDb();
  await db.put('meta', { key, value });
}
