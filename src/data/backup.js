import { getDb, newId } from './db.js';
import { buildBackup, decksToRestore, withFreshIds } from '../logic/backup.js';

/** Everything (or just the given decks) as a backup object, ready for JSON.stringify. */
export async function exportBackup(deckIds) {
  const db = await getDb();
  let decks = await db.getAll('decks');
  if (deckIds) decks = decks.filter((d) => deckIds.includes(d.id));
  const keep = new Set(decks.map((d) => d.id));
  const cards = (await db.getAll('cards')).filter((c) => keep.has(c.deckId));
  const cardStats = await db.getAll('cardStats');
  const sessions = await db.getAll('sessions');
  return buildBackup({ decks, cards, cardStats, sessions });
}

/** Write decks (with nested cards) and stats in one transaction: all or nothing. */
async function writeDecks(tx, decks, cardStats, sessions = []) {
  for (const { cards, ...deck } of decks) {
    tx.objectStore('decks').put(deck);
    for (const card of cards) tx.objectStore('cards').put(card);
  }
  for (const stat of cardStats) tx.objectStore('cardStats').put(stat);
  for (const session of sessions) tx.objectStore('sessions').put(session);
}

/** Import a validated backup as brand-new decks (fresh ids, so nothing existing is touched). */
export async function importAsNewDecks(backup) {
  const fresh = withFreshIds(backup, newId);
  const db = await getDb();
  const tx = db.transaction(['decks', 'cards', 'cardStats'], 'readwrite');
  await writeDecks(tx, fresh.decks, fresh.cardStats, []);
  await tx.done;
  return fresh.decks;
}

/**
 * Restore a backup keeping its ids.
 *  - 'replace': wipe decks, cards and stats first, then write the backup.
 *  - 'merge': add decks you don't have, and overwrite ones the backup has a newer copy of.
 * Settings and personal bests ('meta') are left alone either way. Study history (sessions) follows its decks.
 * Returns how many decks were written.
 */
export async function restoreBackup(backup, mode) {
  const db = await getDb();
  const tx = db.transaction(['decks', 'cards', 'cardStats', 'sessions'], 'readwrite');
  let decks = backup.decks;

  if (mode === 'replace') {
    await Promise.all(['decks', 'cards', 'cardStats', 'sessions'].map((name) => tx.objectStore(name).clear()));
  } else {
    const existing = new Map((await tx.objectStore('decks').getAll()).map((d) => [d.id, d.updatedAt]));
    decks = decksToRestore(existing, backup.decks);
    // A replaced deck's old cards go too, so cards deleted since the backup don't linger.
    const cardStore = tx.objectStore('cards');
    for (const d of decks) {
      for (const key of await cardStore.index('deckId').getAllKeys(d.id)) cardStore.delete(key);
    }
  }
  const written = new Set(decks.flatMap((d) => d.cards.map((c) => c.id)));
  const deckIds = new Set(decks.map((d) => d.id));
  await writeDecks(
    tx,
    decks,
    backup.cardStats.filter((s) => written.has(s.cardId)),
    backup.sessions.filter((s) => deckIds.has(s.deckId)),
  );
  await tx.done;
  return decks.length;
}
