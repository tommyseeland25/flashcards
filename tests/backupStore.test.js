import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { createDeckWithCards, listDecks } from '../src/data/decks.js';
import { listCards, saveCard } from '../src/data/cards.js';
import { exportBackup, importAsNewDecks, restoreBackup } from '../src/data/backup.js';
import { validateBackup } from '../src/logic/backup.js';
import { getDb } from '../src/data/db.js';
import { recordSession } from '../src/data/stats.js';
import { saveImage, purgeOrphanImages } from '../src/data/images.js';
import { loadImageUrls } from '../src/data/images.js';

const roundTrip = async (ids) => validateBackup(JSON.stringify(await exportBackup(ids))).backup;
const cardsOf = (c) => ({ term: c.term, definition: c.definition });

describe('backup store', () => {
  it('replace restores exactly what was exported', async () => {
    const a = await createDeckWithCards('A', '', [{ term: '1', definition: 'one' }, { term: '2', definition: 'two', starred: true }]);
    await createDeckWithCards('B', '', [{ term: 'x', definition: 'y' }]);
    const backup = await roundTrip();

    await createDeckWithCards('Extra', '', [{ term: 'z', definition: 'z' }]); // not in the backup
    await restoreBackup(backup, 'replace');

    const decks = await listDecks();
    expect(decks.map((d) => d.title).sort()).toEqual(['A', 'B']);
    const cards = await listCards(a.id);
    expect(cards.map(cardsOf)).toEqual([{ term: '1', definition: 'one' }, { term: '2', definition: 'two' }]);
    expect(cards[1].starred).toBe(true);
  });

  it('study history travels with a backup', async () => {
    const [deck] = await listDecks();
    await recordSession({ deckId: deck.id, mode: 'learn', correct: 3, total: 4 });
    const backup = await roundTrip();
    expect(backup.sessions.some((s) => s.deckId === deck.id && s.total === 4)).toBe(true);

    const db = await getDb();
    await db.clear('sessions');
    await restoreBackup(backup, 'replace');
    expect((await db.getAll('sessions')).some((s) => s.deckId === deck.id && s.total === 4)).toBe(true);
  });

  it('images survive backup, restore and orphan purge', async () => {
    globalThis.URL.createObjectURL ??= () => 'blob:test';
    const deck = (await listDecks()).find((d) => d.title === 'A');
    const [card] = await listCards(deck.id);
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 250, 251, 252]);
    const imageId = await saveImage(new Blob([bytes], { type: 'image/png' }));
    await saveCard({ ...card, imageId });
    const orphanId = await saveImage(new Blob([bytes], { type: 'image/png' })); // no card uses this one

    const backup = await roundTrip();
    expect(backup.images.map((i) => i.id)).toEqual([imageId]);

    await restoreBackup(backup, 'replace'); // wipes the images store first
    const db = await getDb();
    const stored = await db.get('images', imageId);
    expect(new Uint8Array(await stored.blob.arrayBuffer())).toEqual(bytes);
    expect(stored.type).toBe('image/png');
    expect(await db.get('images', orphanId)).toBeUndefined();

    await saveImage(new Blob([bytes], { type: 'image/png' }));
    await purgeOrphanImages();
    expect(await db.getAllKeys('images')).toEqual([imageId]);
    await loadImageUrls([{ imageId }]);
  });

  it('importing as new decks never touches existing ones', async () => {
    const before = (await listDecks()).length;
    const backup = await roundTrip();
    const created = await importAsNewDecks(backup);
    expect(created).toHaveLength(before);
    expect(await listDecks()).toHaveLength(before * 2);
  });

  it('merge keeps newer local decks and refreshes older ones', async () => {
    const deck = (await listDecks()).find((d) => d.title === 'A'); // has 2 cards
    const backup = await roundTrip([deck.id]);

    // Local copy is newer than the backup: merge must keep it.
    const db = await getDb();
    await db.put('decks', { ...deck, title: 'Local edit', updatedAt: backup.decks[0].updatedAt + 1000 });
    expect(await restoreBackup(backup, 'merge')).toBe(0);
    expect((await db.get('decks', deck.id)).title).toBe('Local edit');

    // Backup is newer: it wins, and cards removed after the backup are brought back.
    await db.put('decks', { ...deck, title: 'Old', updatedAt: 0 });
    const cards = await listCards(deck.id);
    await db.delete('cards', cards[0].id);
    await saveCard({ ...cards[1], term: 'changed' });
    expect(await restoreBackup(backup, 'merge')).toBe(1);
    expect((await db.get('decks', deck.id)).title).toBe(deck.title);
    expect((await listCards(deck.id)).map((c) => c.term)).toEqual(['1', '2']);
  });
});
