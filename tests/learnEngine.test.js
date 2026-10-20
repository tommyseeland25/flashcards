import { describe, it, expect } from 'vitest';
import { LearnSession } from '../src/logic/learnEngine.js';

const cards = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, term: `t${i}`, definition: `d${i}` }));
const noShuffle = () => 0.999; // Fisher-Yates with ~1 keeps order

describe('LearnSession', () => {
  it('asks choice first, then typed, and masters after both are right', () => {
    const s = new LearnSession(cards(1), { random: noShuffle });
    expect(s.question().mode).toBe('write'); // one card can't have multiple-choice options

    const s2 = new LearnSession(cards(5), { random: noShuffle });
    const id = s2.question().cardId;
    expect(s2.question().mode).toBe('choice');
    expect(s2.question().options).toContain(s2.question().answer);
    s2.answer(true);
    // finish the rest of round 1 correctly, then the card should come back as a typed question
    while (s2.question().cardId !== id && !s2.done) s2.answer(true);
    expect(s2.question().mode).toBe('write');
  });

  it('repeats missed cards soon, in the same round, until answered right', () => {
    const s = new LearnSession(cards(5), { random: noShuffle });
    const first = s.question().cardId;
    s.answer(false);
    expect(s.question().cardId).not.toBe(first); // not immediately
    const order = [];
    for (let i = 0; i < 3; i++) { order.push(s.question().cardId); s.answer(true); }
    expect(s.question().cardId).toBe(first); // back after 3 others
    expect(s.progress().fraction).toBeLessThan(0.5);
  });

  it('finishes with every card mastered and reports rounds', () => {
    const s = new LearnSession(cards(10), { roundSize: 4, random: noShuffle });
    let rounds = 0;
    let guard = 0;
    while (!s.done && guard++ < 500) {
      const { roundEnded } = s.answer(true);
      if (roundEnded && !s.done) rounds++;
    }
    expect(s.done).toBe(true);
    expect(s.progress()).toEqual({ mastered: 10, total: 10, fraction: 1 });
    expect(rounds).toBeGreaterThan(1);
    expect(s.correctAnswers).toBe(s.answers);
  });

  it('a wrong answer resets progress on that card', () => {
    const s = new LearnSession(cards(3), { random: noShuffle });
    s.answer(true); // card A level 1
    const before = s.progress().fraction;
    while (s.question().cardId !== 'c0') s.answer(true);
    s.answer(false);
    expect(s.progress().fraction).toBeLessThan(before + 0.5);
    expect(s.levels.get('c0')).toBe(0);
  });

  it('ignores incomplete cards and handles empty decks', () => {
    const s = new LearnSession([{ id: 'x', term: 'a', definition: '' }]);
    expect(s.done).toBe(true);
    expect(s.question()).toBeNull();
    expect(s.progress().fraction).toBe(1);
  });
});
