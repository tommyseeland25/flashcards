import { describe, it, expect } from 'vitest';
import { orderBetween, orderForMove, needsRenumber, initialOrders } from '../src/logic/ordering.js';

describe('orderBetween', () => {
  it('handles empty list and edges', () => {
    expect(orderBetween(undefined, undefined)).toBe(1024);
    expect(orderBetween(undefined, 10)).toBeLessThan(10);
    expect(orderBetween(10, undefined)).toBeGreaterThan(10);
  });
  it('returns the midpoint', () => expect(orderBetween(2, 4)).toBe(3));
  it('flags neighbours that are too close', () => {
    expect(needsRenumber(1, 1 + 1e-9)).toBe(true);
    expect(needsRenumber(1, 2)).toBe(false);
  });
});

describe('orderForMove', () => {
  const items = initialOrders(4).map((order, i) => ({ id: i, order })); // 1024..4096
  it('moves to the front', () => expect(orderForMove(items, 2, 0)).toBeLessThan(1024));
  it('moves to the end', () => expect(orderForMove(items, 0, 3)).toBeGreaterThan(4096));
  it('moves between neighbours', () => {
    const o = orderForMove(items, 0, 2); // ends between old items 2 and 3
    expect(o).toBeGreaterThan(3072);
    expect(o).toBeLessThan(4096);
  });
});
