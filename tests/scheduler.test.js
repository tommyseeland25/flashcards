import { describe, it, expect } from 'vitest';
import { schedule, previewIntervals, formatInterval, dueCounts, reviewQueue, isDue, addDays, startOfDay, endOfDay, MIN_EASE } from '../src/logic/scheduler.js';

const NOW = new Date(2026, 5, 10, 15, 30).getTime(); // 10 Jun 2026, 3:30pm local
const fresh = (over = {}) => ({ id: 'c', term: 't', definition: 'd', order: 1, ease: 2.5, interval: 0, dueDate: null, repetitions: 0, lapses: 0, ...over });
const apply = (card, rating, now = NOW) => ({ ...card, ...schedule(card, rating, now) });
const daysFromNow = (ts) => Math.round((ts - startOfDay(NOW)) / 86400000);

describe('schedule', () => {
  it('walks the classic ladder: 1 day, 6 days, then multiplies by ease', () => {
    let c = apply(fresh(), 'good');
    expect([c.interval, c.repetitions, daysFromNow(c.dueDate)]).toEqual([1, 1, 1]);
    c = apply(c, 'good');
    expect([c.interval, c.repetitions]).toEqual([6, 2]);
    c = apply(c, 'good');
    expect(c.interval).toBe(15); // 6 * 2.5
    expect(c.ease).toBe(2.5); // "good" leaves ease unchanged
    c = apply(c, 'good');
    expect(c.interval).toBe(38); // 15 * 2.5 = 37.5, rounded
  });

  it('easy grows faster and raises ease; hard grows slower and lowers it', () => {
    const base = fresh({ repetitions: 2, interval: 6 });
    const easy = apply(base, 'easy');
    const good = apply(base, 'good');
    const hard = apply(base, 'hard');
    expect(easy.interval).toBeGreaterThan(good.interval);
    expect(good.interval).toBeGreaterThan(hard.interval);
    expect(easy.ease).toBeCloseTo(2.6);
    expect(hard.ease).toBeCloseTo(2.36);
  });

  it('again resets the ladder, counts a lapse, and is due in 10 minutes', () => {
    const learned = fresh({ repetitions: 5, interval: 40, ease: 2.5 });
    const c = apply(learned, 'again');
    expect(c).toMatchObject({ repetitions: 0, interval: 0, lapses: 1 });
    expect(c.ease).toBeCloseTo(2.3);
    expect(c.dueDate - NOW).toBe(10 * 60 * 1000);
    expect(isDue(c, NOW)).toBe(true); // still part of today's work
    // the next success starts back at 1 day
    expect(apply(c, 'good').interval).toBe(1);
  });

  it('never lets ease drop below the floor', () => {
    let c = fresh({ ease: 1.4 });
    for (let i = 0; i < 5; i++) c = apply(c, 'again');
    expect(c.ease).toBe(MIN_EASE);
    c = fresh({ ease: MIN_EASE, repetitions: 3, interval: 10 });
    expect(apply(c, 'hard').ease).toBe(MIN_EASE);
  });

  it('intervals always grow by at least a day after the first two reviews', () => {
    const c = apply(fresh({ repetitions: 3, interval: 1, ease: MIN_EASE }), 'hard');
    expect(c.interval).toBeGreaterThanOrEqual(2);
  });

  it('due dates land on a day boundary regardless of time of day', () => {
    const morning = schedule(fresh(), 'good', new Date(2026, 5, 10, 8).getTime()).dueDate;
    const night = schedule(fresh(), 'good', new Date(2026, 5, 10, 23, 59).getTime()).dueDate;
    expect(morning).toBe(night);
    expect(new Date(morning).getHours()).toBe(0);
  });

  it('handles day arithmetic across a month end', () => {
    expect(new Date(addDays(new Date(2026, 0, 31, 12).getTime(), 1)).getDate()).toBe(1);
    expect(endOfDay(NOW) - startOfDay(NOW)).toBe(86400000 - 1);
  });
});

describe('previews and formatting', () => {
  it('labels each button', () => {
    expect(previewIntervals(fresh(), NOW)).toEqual({ again: '10m', hard: '1d', good: '1d', easy: '4d' });
  });
  it('formats long intervals', () => {
    expect(formatInterval(6)).toBe('6d');
    expect(formatInterval(45)).toBe('1.5mo');
    expect(formatInterval(400)).toBe('1.1y');
  });
});

describe('queue and counts', () => {
  const day = (n) => addDays(NOW, n);
  const cards = [
    fresh({ id: 'overdue', dueDate: day(-3), interval: 5, order: 1 }),
    fresh({ id: 'today', dueDate: startOfDay(NOW), interval: 5, order: 2 }),
    fresh({ id: 'later', dueDate: day(2), interval: 5, order: 3 }),
    ...Array.from({ length: 12 }, (_, i) => fresh({ id: `new${i}`, order: 10 + i })),
    fresh({ id: 'blank', term: '', definition: '' }),
  ];
  it('counts due and new, ignoring blanks and future cards', () => {
    expect(dueCounts(cards, NOW)).toEqual({ due: 2, new: 12 });
  });
  it('queues overdue first, then a limited number of new cards in order', () => {
    const q = reviewQueue(cards, NOW, { newLimit: 3 }).map((c) => c.id);
    expect(q).toEqual(['overdue', 'today', 'new0', 'new1', 'new2']);
  });
});
