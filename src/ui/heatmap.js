import { h } from './dom.js';
import { buildHeatmap } from '../logic/analytics.js';

const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short' });
const label = (cell) => `${cell.count} card${cell.count === 1 ? '' : 's'} studied · ${fmt.format(cell.ts)}`;

/**
 * GitHub-style activity grid: one column per week, one row per weekday.
 * Colour is a single blue ramp, light to dark = more cards (see --heat-N in base.css), so the
 * encoding is magnitude only. Hover shows the exact count; the "table" below is the keyboard /
 * screen-reader route to the same numbers.
 */
export function createHeatmap(activity, now = Date.now(), weeks = 26) {
  const { columns } = buildHeatmap(activity, now, weeks);
  const tip = h('div', { class: 'heat-tip', hidden: true, role: 'presentation' });

  // A label goes above the first week of each month, unless the next month starts within 3 columns
  // (the 14px columns are too narrow for two labels to fit).
  const starts = columns.flatMap((week, i) => {
    const first = week.find(Boolean);
    const prev = columns[i - 1]?.find(Boolean);
    return first && (!prev || new Date(prev.ts).getMonth() !== new Date(first.ts).getMonth()) ? [{ i, ts: first.ts }] : [];
  });
  const labels = new Map(starts.filter((s, k) => !starts[k + 1] || starts[k + 1].i - s.i >= 3).map((s) => [s.i, monthFmt.format(s.ts)]));
  const monthRow = columns.map((_, i) => h('span', { class: 'heat-month' }, labels.get(i) ?? ''));

  const grid = h('div', { class: 'heat-grid', style: `--weeks:${weeks}` },
    columns.map((week) => week.map((cell) =>
      h('div', { class: `heat-cell${cell ? '' : ' empty'}`, dataset: cell ? { level: cell.level, tip: label(cell) } : {}, 'aria-hidden': 'true' }))));

  grid.addEventListener('pointerover', (e) => {
    const text = e.target.dataset?.tip;
    tip.hidden = !text;
    if (text) tip.textContent = text;
  });
  grid.addEventListener('pointermove', (e) => {
    tip.style.left = `${e.clientX + 12}px`;
    tip.style.top = `${e.clientY + 16}px`;
  });
  grid.addEventListener('pointerleave', () => { tip.hidden = true; });

  const legend = h('div', { class: 'heat-legend', 'aria-hidden': 'true' },
    'Less', [0, 1, 2, 3, 4].map((l) => h('span', { class: 'heat-cell', dataset: { level: l } })), 'More');

  // Same data as text: busiest recent days first.
  const rows = columns.flat().filter((c) => c && c.count > 0).sort((a, b) => b.ts - a.ts);
  const table = h('details', { class: 'heat-table' },
    h('summary', {}, 'Show activity as a table'),
    rows.length
      ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Day'), h('th', {}, 'Cards studied'))),
        h('tbody', {}, rows.map((c) => h('tr', {}, h('td', {}, fmt.format(c.ts)), h('td', {}, c.count)))))
      : h('p', { class: 'muted' }, 'No study activity yet.'));

  const scroller = h('div', { class: 'heat-scroll' }, h('div', { class: 'heat-months', style: `--weeks:${weeks}` }, monthRow), grid);
  // On narrow screens the grid scrolls sideways: start at the right edge, where the recent weeks are.
  requestAnimationFrame(() => { scroller.scrollLeft = scroller.scrollWidth; });

  return h('figure', { class: 'heatmap' }, scroller, legend, table, tip);
}
