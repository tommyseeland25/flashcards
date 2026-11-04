import { describe, it, expect } from 'vitest';
import { computeOffsets, indexAtOffset, visibleRange, fitHeight } from '../src/logic/layout.js';

describe('computeOffsets', () => {
  it('builds running totals, ending with the total height', () => {
    expect(computeOffsets([64, 100, 64])).toEqual([0, 64, 164, 228]);
  });
  it('handles an empty list', () => expect(computeOffsets([])).toEqual([0]));
});

describe('indexAtOffset', () => {
  const offsets = computeOffsets([64, 100, 64]); // rows cover 0-64, 64-164, 164-228
  it('finds the row containing a position, including exact boundaries', () => {
    expect([0, 63, 64, 163, 164, 227].map((y) => indexAtOffset(offsets, y))).toEqual([0, 0, 1, 1, 2, 2]);
  });
  it('clamps above the top and below the bottom', () => {
    expect(indexAtOffset(offsets, -50)).toBe(0);
    expect(indexAtOffset(offsets, 9999)).toBe(2);
  });
  it('returns -1 for an empty list', () => expect(indexAtOffset([0], 10)).toBe(-1));
  it('agrees with a plain linear scan on a big uneven list', () => {
    const heights = Array.from({ length: 2000 }, (_, i) => 40 + ((i * 37) % 90));
    const big = computeOffsets(heights);
    const linear = (y) => { let found = 0; for (let i = 0; i < heights.length; i++) if (big[i] <= y) found = i; return found; };
    for (const y of [0, 1, 500, 12345, 50000, big[2000] - 1, big[2000] + 100]) expect(indexAtOffset(big, y)).toBe(linear(y));
  });
});

describe('visibleRange', () => {
  const offsets = computeOffsets(Array(100).fill(50)); // 100 rows of 50px
  it('returns the rows touching the viewport (last is exclusive)', () => {
    expect(visibleRange(offsets, 0, 200)).toEqual({ first: 0, last: 5 }); // rows 0-3 plus row 4 starting exactly at 200
    expect(visibleRange(offsets, 120, 100)).toEqual({ first: 2, last: 5 });
  });
  it('adds overscan but never goes out of range', () => {
    expect(visibleRange(offsets, 0, 100, 3)).toEqual({ first: 0, last: 6 });
    expect(visibleRange(offsets, 4900, 500, 6)).toEqual({ first: 92, last: 100 });
  });
  it('works with rows of different heights', () => {
    const uneven = computeOffsets([50, 300, 50, 50]); // the second row is tall
    expect(visibleRange(uneven, 100, 100)).toEqual({ first: 1, last: 2 }); // viewport sits inside the tall row
  });
  it('handles an empty list', () => expect(visibleRange([0], 0, 500, 6)).toEqual({ first: 0, last: 0 }));
});

describe('fitHeight', () => {
  it('adds borders for border-box, not for content-box', () => {
    expect(fitHeight({ scrollHeight: 100, borderTop: 1, borderBottom: 1, boxSizing: 'border-box' })).toBe(102);
    expect(fitHeight({ scrollHeight: 100, borderTop: 1, borderBottom: 1, boxSizing: 'content-box' })).toBe(100);
  });
  it('defaults to border-box with no borders', () => expect(fitHeight({ scrollHeight: 80 })).toBe(80));
});
