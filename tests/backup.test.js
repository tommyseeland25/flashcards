import { describe, it, expect } from 'vitest';
import { buildBackup, validateBackup, withFreshIds, decksToRestore } from '../src/logic/backup.js';

const deck = { id: 'd1', title: 'Deck', description: '', tags: ['x'], createdAt: 1, updatedAt: 2 };
const card = (id, order, term) => ({ id, deckId: 'd1', order, term, definition: term.toUpperCase(), imageId: null, starred: false, ease: 2.5, interval: 0, dueDate: null, repetitions: 0, lapses: 0 });

describe('backup', () => {
  const backup = buildBackup({ decks: [deck], cards: [card('c2', 2, 'b'), card('c1', 1, 'a')], cardStats: [{ cardId: 'c1', correct: 3, incorrect: 1, lastStudied: 5, streak: 2 }, { cardId: 'gone', correct: 1, incorrect: 0, lastStudied: null, streak: 0 }] }, 100);

  it('nests cards under decks in order and drops orphan stats', () => {
    expect(backup.decks[0].cards.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(backup.cardStats).toHaveLength(1);
  });
  it('round-trips through JSON', () => {
    const { backup: restored, errors } = validateBackup(JSON.stringify(backup));
    expect(errors).toBeUndefined();
    expect(restored.decks[0]).toEqual(backup.decks[0]);
    expect(restored.cardStats).toEqual(backup.cardStats);
  });
  it('rejects non-JSON, foreign JSON, and newer versions', () => {
    expect(validateBackup('nope').errors[0]).toMatch(/not valid JSON/);
    expect(validateBackup('{"decks":[]}').errors[0]).toMatch(/not a Flashcards backup/);
    expect(validateBackup(JSON.stringify({ ...backup, version: 99 })).errors[0]).toMatch(/newer version/);
  });
  it('rejects decks or cards without ids', () => {
    const broken = { ...backup, decks: [{ ...deck, id: '', cards: [] }] };
    expect(validateBackup(JSON.stringify(broken)).errors[0]).toMatch(/damaged/);
  });
  it('sanitizes types and unknown fields', () => {
    const hostile = { ...backup, decks: [{ ...deck, __proto__x: 1, evil: 'y', cards: [{ ...card('c1', 1, 'a'), ease: 'abc', interval: -5, starred: 'yes', extra: 1 }] }] };
    const c = validateBackup(JSON.stringify(hostile)).backup.decks[0].cards[0];
    expect(c.ease).toBe(2.5);
    expect(c.interval).toBe(0);
    expect(c.starred).toBe(false);
    expect(c).not.toHaveProperty('extra');
  });
  it('withFreshIds renames everything consistently', () => {
    let n = 0;
    const fresh = withFreshIds(backup, () => `new${++n}`);
    const d = fresh.decks[0];
    expect(d.id).toBe('new1');
    expect(d.cards.every((c) => c.deckId === 'new1' && c.id.startsWith('new'))).toBe(true);
    expect(fresh.cardStats).toEqual([]);
  });
  it('merge keeps the newer copy of a deck', () => {
    const existing = new Map([['d1', 10], ['d2', 1]]);
    const incoming = [{ id: 'd1', updatedAt: 5 }, { id: 'd2', updatedAt: 9 }, { id: 'd3', updatedAt: 0 }];
    expect(decksToRestore(existing, incoming).map((d) => d.id)).toEqual(['d2', 'd3']);
  });
});
