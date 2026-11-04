/**
 * Pure layout maths for the editor: no DOM, so it can be unit-tested.
 *
 * Two jobs:
 *  1. A list of rows with DIFFERENT heights (cards whose text wraps onto more lines). We keep an array of
 *     "offsets", the top edge of every row, and use it to find which rows are on screen.
 *  2. Working out how tall an auto-growing textarea should be from a measurement.
 */

/**
 * offsets[i] = distance from the top of the list to the top of row i, so
 * offsets[heights.length] is the total height. This is a "prefix sum".
 * Example: heights [64, 100, 64] -> offsets [0, 64, 164, 228].
 */
export function computeOffsets(heights) {
  const offsets = new Array(heights.length + 1);
  offsets[0] = 0;
  for (let i = 0; i < heights.length; i++) offsets[i + 1] = offsets[i] + heights[i];
  return offsets;
}

/**
 * Index of the row that contains vertical position `y` (clamped to the first/last row).
 * Binary search, so it is O(log n): a 5,000-row list needs ~13 comparisons, not 5,000.
 * Returns -1 for an empty list.
 */
export function indexAtOffset(offsets, y) {
  const rowCount = offsets.length - 1;
  if (rowCount <= 0) return -1;
  let low = 0;
  let high = rowCount - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1; // round up so the loop always makes progress
    if (offsets[mid] <= y) low = mid;
    else high = mid - 1;
  }
  return low;
}

/**
 * Which rows to keep in the DOM: those intersecting the viewport, plus `overscan` extra rows on each
 * side so quick scrolling doesn't show blank space. Returns { first, last } with `last` exclusive.
 */
export function visibleRange(offsets, scrollTop, viewportHeight, overscan = 0) {
  const rowCount = offsets.length - 1;
  if (rowCount <= 0) return { first: 0, last: 0 };
  const top = indexAtOffset(offsets, scrollTop);
  const bottom = indexAtOffset(offsets, scrollTop + viewportHeight);
  return { first: Math.max(0, top - overscan), last: Math.min(rowCount, bottom + 1 + overscan) };
}

/**
 * The CSS `height` that makes a textarea show all its text, given the measured `scrollHeight`
 * (content + padding, but NOT borders). With `box-sizing: border-box` the height we set includes the
 * borders, so they must be added back; with content-box they must not.
 */
export function fitHeight({ scrollHeight, borderTop = 0, borderBottom = 0, boxSizing = 'border-box' }) {
  return boxSizing === 'border-box' ? scrollHeight + borderTop + borderBottom : scrollHeight;
}
