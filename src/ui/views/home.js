import { h } from '../dom.js';
import { listDecks, createDeck, deleteDeck, duplicateDeck } from '../../data/decks.js';
import { createLargeTestDeck } from '../../data/seed.js';

const SORTS = {
  updated: ['Recently edited', (a, b) => b.updatedAt - a.updatedAt],
  created: ['Newest', (a, b) => b.createdAt - a.createdAt],
  title: ['Title (A–Z)', (a, b) => a.title.localeCompare(b.title)],
  size: ['Most cards', (a, b) => b.cardCount - a.cardCount],
};

const matchesQuery = (deck, q) =>
  [deck.title, deck.description, ...deck.tags].join(' ').toLowerCase().includes(q);

export async function homeView(_params, root) {
  let decks = await listDecks();
  let query = '';
  let sort = 'updated';

  const list = h('ul', { class: 'deck-list' });

  async function reload() {
    decks = await listDecks();
    draw();
  }

  function draw() {
    const shown = decks.filter((d) => matchesQuery(d, query)).sort(SORTS[sort][1]);
    list.replaceChildren(
      ...(shown.length
        ? shown.map(deckItem)
        : [h('li', { class: 'empty' }, decks.length ? 'No decks match your search.' : 'No decks yet — create one!')]),
    );
  }

  function deckItem(deck) {
    return h(
      'li',
      { class: 'deck' },
      h(
        'a',
        { class: 'deck-main', href: `#/study/${deck.id}` },
        h('h2', {}, deck.title),
        deck.description && h('p', {}, deck.description),
        h('p', { class: 'muted' }, `${deck.cardCount} card${deck.cardCount === 1 ? '' : 's'}`,
          deck.tags.length ? ` · ${deck.tags.join(', ')}` : ''),
      ),
      h(
        'div',
        { class: 'deck-actions' },
        h('a', { class: 'btn', href: `#/deck/${deck.id}` }, 'Edit'),
        h('button', { class: 'btn', onclick: async () => { await duplicateDeck(deck.id); reload(); } }, 'Duplicate'),
        h('button', {
          class: 'btn danger',
          onclick: async () => {
            if (!confirm(`Delete "${deck.title}" and its ${deck.cardCount} cards?`)) return;
            await deleteDeck(deck.id);
            reload();
          },
        }, 'Delete'),
      ),
    );
  }

  root.append(
    h('header', { class: 'topbar' },
      h('h1', {}, 'Flashcards'),
      h('button', {
        class: 'btn primary',
        onclick: async () => { location.hash = `#/deck/${(await createDeck()).id}`; },
      }, 'New deck'),
    ),
    h('main', { class: 'page' },
      h('div', { class: 'toolbar' },
        h('input', {
          type: 'search', placeholder: 'Search decks…', 'aria-label': 'Search decks',
          oninput: (e) => { query = e.target.value.trim().toLowerCase(); draw(); },
        }),
        h('select', { 'aria-label': 'Sort decks', onchange: (e) => { sort = e.target.value; draw(); } },
          Object.entries(SORTS).map(([key, [label]]) => h('option', { value: key }, label))),
      ),
      list,
      import.meta.env.DEV && h('p', {},
        h('button', { class: 'btn-link', onclick: async () => { await createLargeTestDeck(2000); reload(); } },
          'Dev: add 2,000-card test deck')),
    ),
  );
  draw();
}
