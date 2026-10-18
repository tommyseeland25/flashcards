import { h } from './dom.js';

/**
 * Windowed list for fixed-height rows: only rows near the viewport exist in the DOM,
 * so a 5,000-card deck costs the same as a 20-card one.
 *
 * Rows are keyed by item id and kept while visible, so a focused input is not
 * destroyed when you type in it. Call `refresh()` after changing item contents/order.
 */
export function createVirtualList({ rowHeight, renderRow, overscan = 6, className = '' }) {
  const content = h('div', { class: 'vlist-content' });
  const el = h('div', { class: `vlist ${className}` }, content);
  let items = [];
  const rows = new Map(); // item.id -> row element
  let frame = 0;

  function render() {
    frame = 0;
    const first = Math.max(0, Math.floor(el.scrollTop / rowHeight) - overscan);
    const last = Math.min(items.length, Math.ceil((el.scrollTop + el.clientHeight) / rowHeight) + overscan);
    const visible = new Set();

    for (let i = first; i < last; i++) {
      const item = items[i];
      visible.add(item.id);
      let row = rows.get(item.id);
      if (!row) {
        row = renderRow(item, i);
        row.classList.add('vlist-row');
        row.style.height = `${rowHeight}px`;
        rows.set(item.id, row);
        content.append(row);
      }
      row.style.transform = `translateY(${i * rowHeight}px)`;
      row.dataset.index = i;
    }
    for (const [id, row] of rows) {
      if (!visible.has(id)) {
        row.remove();
        rows.delete(id);
      }
    }
  }

  const schedule = () => {
    frame ||= requestAnimationFrame(render);
  };
  el.addEventListener('scroll', schedule, { passive: true });
  new ResizeObserver(schedule).observe(el);

  return {
    el,
    content,
    /** Replace the item array and redraw (rows for removed items are dropped). */
    setItems(next) {
      items = next;
      content.style.height = `${items.length * rowHeight}px`;
      for (const row of rows.values()) row.remove();
      rows.clear();
      render();
    },
    /** Rebuild only the visible rows (e.g. after a drag reorder). */
    refresh() {
      this.setItems(items);
    },
    /** The mounted row element for an item id, or undefined if scrolled out. */
    rowFor: (id) => rows.get(id),
    scrollToIndex(index) {
      const top = index * rowHeight;
      if (top < el.scrollTop) el.scrollTop = top;
      else if (top + rowHeight > el.scrollTop + el.clientHeight) el.scrollTop = top + rowHeight - el.clientHeight;
      render();
    },
    /** Row index under a viewport Y coordinate (clamped). */
    indexAtClientY(clientY) {
      const y = clientY - el.getBoundingClientRect().top + el.scrollTop;
      return Math.min(items.length - 1, Math.max(0, Math.floor(y / rowHeight)));
    },
  };
}
