import { h } from '../dom.js';
import { createHeatmap } from '../heatmap.js';
import { loadStatsData } from '../../data/overview.js';
import { activityByDay, dayKey, deckSummaries, studyStreak } from '../../logic/analytics.js';
import { dueCounts } from '../../logic/scheduler.js';

const pct = (x) => `${Math.round(x * 100)}%`;
const tile = (value, caption) => h('div', { class: 'tile-stat' }, h('div', { class: 'big' }, value), h('div', { class: 'muted' }, caption));

export async function statsView(_params, root) {
  const { decks, cards, cardStats, sessions } = await loadStatsData();
  const now = Date.now();
  const activity = activityByDay(sessions);
  const rows = deckSummaries(decks, cards, cardStats, now);
  const totalCards = rows.reduce((n, r) => n + r.cards, 0);
  const mastered = rows.reduce((n, r) => n + r.mastered, 0);
  const streak = studyStreak(activity, now);
  const today = activity.get(dayKey(now)) ?? 0;
  const { due } = dueCounts(cards, now);

  const bar = (fraction) => h('div', { class: 'bar', role: 'presentation' }, h('div', { class: 'bar-fill', style: `width:${Math.round(fraction * 100)}%` }));

  root.append(
    h('header', { class: 'topbar' }, h('a', { class: 'btn', href: '#/' }, '← Decks'), h('h1', {}, 'Stats')),
    h('main', { class: 'page' },
      h('div', { class: 'tiles-stat' },
        tile(`${streak} day${streak === 1 ? '' : 's'}`, 'Study streak'),
        tile(`${mastered} / ${totalCards}`, 'Cards mastered'),
        tile(due, 'Due today'),
        tile(today, 'Cards studied today')),
      h('section', { class: 'panel wide' },
        h('h2', {}, 'Activity, last 26 weeks'),
        createHeatmap(activity, now)),
      h('section', { class: 'panel wide' },
        h('h2', {}, 'Decks'),
        rows.length
          ? h('div', { class: 'table-scroll' }, h('table', { class: 'deck-table' },
            h('thead', {}, h('tr', {}, ['Deck', 'Cards', 'Mastered', 'Accuracy', 'Due'].map((t) => h('th', {}, t)))),
            h('tbody', {}, rows.map((r) => h('tr', {},
              h('td', {}, h('a', { href: `#/study/${r.deck.id}` }, r.deck.title)),
              h('td', {}, r.cards),
              h('td', {}, `${r.mastered} / ${r.cards}`, bar(r.cards ? r.mastered / r.cards : 0)),
              h('td', {}, r.accuracy === null ? '—' : pct(r.accuracy), r.accuracy !== null && bar(r.accuracy)),
              h('td', {}, r.due))))))
          : h('p', { class: 'muted' }, 'No decks yet.'),
        h('p', { class: 'muted' }, 'Mastered = a card whose review interval has reached 21 days. Accuracy counts every answer in Learn, Write, Test and Review.')),
    ),
  );
}
