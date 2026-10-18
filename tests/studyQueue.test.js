import { describe, it, expect } from 'vitest';
import { buildQueue } from '../src/logic/studyQueue.js';
import { shuffle } from '../src/logic/shuffle.js';

const card = (id, term, definition, starred = false) => ({ id, term, definition, starred });
const cards = [card(1, 'a', 'A', true), card(2, 'b', 'B'), card(3, '', ''), card(4, 'd', 'D', true)];

describe('buildQueue', () => {
  it('skips empty cards and keeps order', () => expect(buildQueue(cards).map((c) => c.id)).toEqual([1, 2, 4]));
  it('filters starred', () => expect(buildQueue(cards, { starredOnly: true }).map((c) => c.id)).toEqual([1, 4]));
  it('shuffles without losing cards', () => {
    const ids = buildQueue(cards, { shuffleCards: true }).map((c) => c.id).sort();
    expect(ids).toEqual([1, 2, 4]);
  });
});

describe('shuffle', () => {
  it('does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
  it('is deterministic with an injected random', () => {
    expect(shuffle([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  });
});
