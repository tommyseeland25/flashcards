import { h } from './dom.js';
import { computeOffsets, indexAtOffset, visibleRange } from '../logic/layout.js';

/**
 * Windowed list: only the rows near the viewport exist in the DOM, so a 5,000-card deck costs about
 * the same as a 20-card one.
 *
 * Rows may have DIFFERENT heights (a card whose text wraps onto more lines is taller), and a row can
 * grow while you type in it. So we don't assume a height: each mounted row is measured by a
 * ResizeObserver and remembered by item id. Rows we have never seen use the average of the ones we
 * have measured as a guess; that guess is corrected as soon as they scroll into view.
 *
 * `offsets[i]` (see logic/layout.js) is the top of row i, so placing a row is `translateY(offsets[i])`
 * and finding the row under a position is a binary search.
 *
 * Rows are keyed by item id and kept while visible, so a focused textarea is not destroyed while you
 * type in it. Call `setItems()` after changing the items' order or membership.
 */
export function createVirtualList({ estimatedRowHeight = 64, renderRow, overscan = 6, className = '' }) {
  const content = h('div', { class: 'vlist-content' });
  const el = h('div', { class: `vlist ${className}` }, content);
  let items = [];
  let offsets = [0];
  const measured = new Map(); // item.id -> border-box height in px
  let measuredTotal = 0;
  const rows = new Map(); // item.id -> mounted row element
  let frame = 0;
  let lastWidth = 0;

  const guess = () => (measured.size ? measuredTotal / measured.size : estimatedRowHeight);

  /** Store a row's height, keeping the running total (used for the average) in step. */
  function remember(id, height) {
    measuredTotal += height - (measured.get(id) ?? 0);
    measured.set(id, height);
  }

  /** Rebuild offsets from the remembered heights (guessing for unmeasured rows) and size the scroll area. */
  function recompute() {
    const fallback = guess();
    offsets = computeOffsets(items.map((item) => measured.get(item.id) ?? fallback));
    content.style.height = `${offsets[items.length]}px`;
  }

  function place(row, index) {
    row.dataset.index = index;
    row.style.transform = `translateY(${offsets[index]}px)`;
  }

  const placeAll = () => { for (const row of rows.values()) place(row, Number(row.dataset.index)); };

  function render() {
    frame = 0;
    const { first, last } = visibleRange(offsets, el.scrollTop, el.clientHeight, overscan);
    const visible = new Set();
    for (let i = first; i < last; i++) {
      const item = items[i];
      visible.add(item.id);
      let row = rows.get(item.id);
      if (!row) {
        row = renderRow(item, i);
        row.classList.add('vlist-row');
        rows.set(item.id, row);
        content.append(row);
        rowObserver.observe(row);
      }
      place(row, i);
    }
    for (const [id, row] of rows) {
      if (!visible.has(id)) {
        rowObserver.unobserve(row);
        row.remove();
        rows.delete(id);
      }
    }
  }

  const schedule = () => {
    frame ||= requestAnimationFrame(render);
  };

  // Fires when a row's size changes: first appearance, typing that adds a line, a window resize...
  // It does NOT mount new rows itself (that waits for the next frame) because changing the page
  // inside an observer callback can make browsers report a "ResizeObserver loop" error.
  const rowObserver = new ResizeObserver((entries) => {
    let scrollShift = 0;
    let changed = false;
    for (const { target: row, borderBoxSize } of entries) {
      const index = Number(row.dataset.index);
      const item = items[index];
      if (!item || rows.get(item.id) !== row) continue;
      const height = borderBoxSize?.[0]?.blockSize ?? row.getBoundingClientRect().height;
      const previous = measured.get(item.id);
      if (previous !== undefined && Math.abs(previous - height) < 0.5) continue;

      // If a row ABOVE the viewport changes height, everything below it moves. Shift the scroll
      // position by the same amount so what you are looking at stays put.
      const usedBefore = offsets[index + 1] - offsets[index];
      if (offsets[index + 1] <= el.scrollTop) scrollShift += height - usedBefore;
      remember(item.id, height);
      changed = true;
    }
    if (!changed) return;
    recompute();
    placeAll();
    if (scrollShift) el.scrollTop += scrollShift;
    schedule(); // the visible window may have changed
  });

  el.addEventListener('scroll', schedule, { passive: true });
  // A narrower list wraps text onto more lines, so every remembered height can be wrong: re-measure.
  new ResizeObserver(() => {
    if (el.clientWidth !== lastWidth) {
      lastWidth = el.clientWidth;
      measured.clear();
      measuredTotal = 0;
      for (const row of rows.values()) remember(items[Number(row.dataset.index)].id, row.getBoundingClientRect().height);
      recompute();
      placeAll();
    }
    schedule();
  }).observe(el);

  return {
    el,
    content,
    /** Replace the items and redraw (rows for removed items are dropped; measured heights are kept). */
    setItems(next) {
      items = next;
      const ids = new Set(items.map((item) => item.id));
      for (const [id, height] of measured) {
        if (!ids.has(id)) { measured.delete(id); measuredTotal -= height; }
      }
      rowObserver.disconnect();
      for (const row of rows.values()) row.remove();
      rows.clear();
      recompute();
      render();
    },
    /** Rebuild only the visible rows. */
    refresh() {
      this.setItems(items);
    },
    /** The mounted row element for an item id, or undefined if scrolled out. */
    rowFor: (id) => rows.get(id),
    /** Top edge (px, within the list) of row `index`; `items.length` gives the bottom of the last row. */
    offsetOf: (index) => offsets[Math.min(Math.max(index, 0), items.length)],
    scrollToIndex(index) {
      const top = offsets[index];
      const bottom = offsets[index + 1];
      if (top < el.scrollTop) el.scrollTop = top;
      else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
      render();
    },
    /** Row index under a viewport Y coordinate (clamped). */
    indexAtClientY(clientY) {
      return Math.max(0, indexAtOffset(offsets, clientY - el.getBoundingClientRect().top + el.scrollTop));
    },
  };
}
