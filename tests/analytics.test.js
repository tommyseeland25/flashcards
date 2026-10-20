import { describe, it, expect } from 'vitest';
import { dayKey, activityByDay, studyStreak, heatLevel, buildHeatmap, deckSummaries } from '../src/logic/analytics.js';
import { addDays } from '../src/logic/scheduler.js';

const NOW = new Date(2026, 5, 10, 15).getTime(); // Wednesday
const ago = (n, hour = 12) => new Date(addDays(NOW, -n) + hour * 3600000).getTime();
const session = (n, total = 10) => ({ date: ago(n), total });

describe('activity and streak', () => {
  it('sums per local day', () => {
    const a = activityByDay([session(0, 5), session(0, 7), session(1, 3)]);
    expect(a.get(dayKey(NOW))).toBe(12);
    expect(a.get(dayKey(ago(1)))).toBe(3);
  });
  it('late-night study counts for that local day', () => {
    expect(dayKey(new Date(2026, 5, 10, 23, 59).getTime())).toBe('2026-06-10');
    expect(dayKey(new Date(2026, 5, 11, 0, 1).getTime())).toBe('2026-06-11');
  });
  it('counts consecutive days including today', () => {
    expect(studyStreak(activityByDay([session(0), session(1), session(2), session(4)]), NOW)).toBe(3);
  });
  it('keeps the streak alive until midnight if you have not studied yet today', () => {
    expect(studyStreak(activityByDay([session(1), session(2)]), NOW)).toBe(2);
  });
  it('breaks after a missed day, and is zero with no history', () => {
    expect(studyStreak(activityByDay([session(2), session(3)]), NOW)).toBe(0);
    expect(studyStreak(new Map(), NOW)).toBe(0);
  });
});

describe('heatmap', () => {
  it('buckets counts into 0-4', () => {
    expect([0, 1, 25, 26, 50, 100].map((n) => heatLevel(n, 100))).toEqual([0, 1, 1, 2, 2, 4]);
    expect(heatLevel(5, 0)).toBe(0);
  });
  it('builds rectangular weeks ending today, with future days empty', () => {
    const { columns, max } = buildHeatmap(activityByDay([session(0, 9), session(30, 3)]), NOW, 26);
    expect(columns).toHaveLength(26);
    expect(columns.every((w) => w.length === 7)).toBe(true);
    expect(max).toBe(9);
    const last = columns[25];
    expect(last[3]).toMatchObject({ key: '2026-06-10', count: 9, level: 4 }); // Wednesday = index 3
    expect(last[4]).toBeNull(); // Thursday hasn't happened
    expect(columns[0][0].key).toBe('2025-12-14'); // 25 weeks before this week's Sunday (Jun 7)
    expect(columns.flat().filter(Boolean).find((c) => c.key === dayKey(ago(30))).count).toBe(3);
  });
});

describe('deckSummaries', () => {
  const decks = [{ id: 'b', title: 'Beta' }, { id: 'a', title: 'Alpha' }];
  const card = (id, deckId, interval, dueDate) => ({ id, deckId, term: 't', definition: 'd', interval, dueDate });
  const cards = [card('1', 'a', 30, addDays(NOW, 5)), card('2', 'a', 3, addDays(NOW, -1)), card('3', 'a', 0, null), { ...card('4', 'a', 0, null), term: '' }, card('5', 'b', 0, null)];
  const stats = [{ cardId: '1', correct: 3, incorrect: 1 }, { cardId: '2', correct: 1, incorrect: 3 }];
  it('sorts by title and computes mastered, due and accuracy', () => {
    const [alpha, beta] = deckSummaries(decks, cards, stats, NOW);
    expect(alpha).toMatchObject({ cards: 3, mastered: 1, due: 1, answered: 8, accuracy: 0.5 });
    expect(beta).toMatchObject({ cards: 1, answered: 0, accuracy: null });
  });
});
