import { describe, it, expect } from 'vitest';
import { generateTest, gradeTest, makeChoiceOptions } from '../src/logic/testGenerator.js';

const cards = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, term: `term${i}`, definition: `def${i}` }));

describe('makeChoiceOptions', () => {
  it('has the answer once plus unique distractors', () => {
    const o = makeChoiceOptions(cards[0], cards);
    expect(o).toHaveLength(4);
    expect(o.filter((x) => x === 'def0')).toHaveLength(1);
    expect(new Set(o).size).toBe(4);
  });
  it('never offers a distractor equal to the answer, even with duplicate definitions', () => {
    const dupes = [{ id: 'a', term: 'a', definition: 'Same' }, { id: 'b', term: 'b', definition: 'same!' }, { id: 'c', term: 'c', definition: 'other' }];
    expect(makeChoiceOptions(dupes[0], dupes)).toHaveLength(2);
  });
});

describe('generateTest', () => {
  it('respects count and splits types evenly', () => {
    const qs = generateTest(cards, { count: 9, types: ['choice', 'truefalse', 'written'] });
    expect(qs).toHaveLength(9);
    for (const t of ['choice', 'truefalse', 'written']) expect(qs.filter((q) => q.type === t)).toHaveLength(3);
    expect(new Set(qs.map((q) => q.cardId)).size).toBe(9);
  });
  it('caps count at deck size and skips incomplete cards', () => {
    const withBlank = [...cards.slice(0, 3), { id: 'x', term: 'only term', definition: '' }];
    expect(generateTest(withBlank, { count: 50 })).toHaveLength(3);
  });
  it('falls back to written when multiple choice is impossible', () => {
    const qs = generateTest([cards[0]], { types: ['choice'], count: 5 });
    expect(qs.map((q) => q.type)).toEqual(['written']);
  });
  it('builds true/false questions whose answer matches what is shown', () => {
    const qs = generateTest(cards, { types: ['truefalse'], count: 12, random: Math.random });
    for (const q of qs) expect(q.answer).toBe(q.shown === q.definition);
    expect(qs.some((q) => !q.answer)).toBe(true);
  });
});

describe('gradeTest', () => {
  const questions = [
    { type: 'choice', answer: 'A', options: ['A', 'B'], prompt: 'p', definition: 'A' },
    { type: 'truefalse', answer: false, prompt: 'p', shown: 'x', definition: 'y' },
    { type: 'written', answer: "Don't stop", prompt: 'p', definition: "Don't stop" },
    { type: 'written', answer: 'cat', prompt: 'p', definition: 'cat' },
  ];
  it('scores each type and treats missing answers as wrong', () => {
    const g = gradeTest(questions, ['A', false, 'dont STOP']);
    expect(g.results.map((r) => r.correct)).toEqual([true, true, true, false]);
    expect(g).toMatchObject({ score: 3, total: 4, percent: 75 });
  });
  it('applies "I was right" overrides', () => {
    const g = gradeTest(questions, ['B', true, 'x', 'dog'], new Set([3]));
    expect(g.score).toBe(1);
    expect(g.results[3].overridden).toBe(true);
  });
  it('handles an empty test', () => expect(gradeTest([], []).percent).toBe(0));
});
