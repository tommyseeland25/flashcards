import { describe, it, expect } from 'vitest';
import { pickPairs, buildTiles, isMatch, isNewBest, formatTime } from '../src/logic/matchGame.js';
import { applyAnswer } from '../src/logic/stats.js';

const c = (id, term, definition) => ({ id, term, definition });

describe('match game', () => {
  it('never picks two cards with the same term or definition', () => {
    const cards = [c('1', 'a', 'x'), c('2', 'A', 'y'), c('3', 'b', 'X'), c('4', 'd', 'z')];
    for (let i = 0; i < 20; i++) {
      const picked = pickPairs(cards, 4);
      const terms = picked.map((p) => p.term.toLowerCase());
      const defs = picked.map((p) => p.definition.toLowerCase());
      expect(new Set(terms).size).toBe(terms.length);
      expect(new Set(defs).size).toBe(defs.length);
      expect(picked.map((p) => p.id)).toContain('4'); // conflicts with nothing, so always fits
    }
  });
  it('builds two tiles per pair that match only each other', () => {
    const tiles = buildTiles([c('1', 'a', 'x'), c('2', 'b', 'y')]);
    expect(tiles).toHaveLength(4);
    const [t1, d1] = ['1:term', '1:definition'].map((id) => tiles.find((t) => t.id === id));
    const t2 = tiles.find((t) => t.id === '2:term');
    expect(isMatch(t1, d1)).toBe(true);
    expect(isMatch(t1, t2)).toBe(false);
    expect(isMatch(t1, t1)).toBe(false);
  });
  it('compares best times and formats them', () => {
    expect(isNewBest(5000, null)).toBe(true);
    expect(isNewBest(5000, 4000)).toBe(false);
    expect(isNewBest(3000, 4000)).toBe(true);
    expect(formatTime(83450)).toBe('1:23.4');
    expect(formatTime(900)).toBe('0:00.9');
  });
});

describe('applyAnswer', () => {
  it('tracks counts and streaks', () => {
    let s = applyAnswer(undefined, 'c', true, 10);
    s = applyAnswer(s, 'c', true, 20);
    expect(s).toEqual({ cardId: 'c', correct: 2, incorrect: 0, lastStudied: 20, streak: 2 });
    s = applyAnswer(s, 'c', false, 30);
    expect(s).toMatchObject({ correct: 2, incorrect: 1, streak: 0, lastStudied: 30 });
  });
});
