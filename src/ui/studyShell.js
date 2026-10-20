import { h, setTitle } from './dom.js';
import { isComplete } from '../logic/studyQueue.js';

const MODES = [['study', 'Flashcards'], ['review', 'Review'], ['learn', 'Learn'], ['write', 'Write'], ['test', 'Test'], ['match', 'Match']];

/** Top bar shared by every study mode: back link, deck title, and the mode switcher. */
export function studyHeader(deck, current) {
  setTitle(`${MODES.find(([k]) => k === current)[1]}: ${deck.title}`);
  return h('header', { class: 'topbar study-top' },
    h('a', { class: 'btn', href: '#/' }, '← Decks'),
    h('h1', { class: 'grow' }, deck.title),
    h('a', { class: 'btn', href: `#/deck/${deck.id}` }, 'Edit'),
    h('nav', { class: 'modes', 'aria-label': 'Study mode' },
      MODES.map(([key, label]) =>
        h('a', { href: `#/${key}/${deck.id}`, class: key === current ? 'active' : '', 'aria-current': key === current ? 'page' : null }, label))),
  );
}

export function deckNotFound(root) {
  root.append(h('p', { class: 'page' }, 'Deck not found. ', h('a', { href: '#/' }, 'Back to decks')));
}

/**
 * Cards that can be used in a quiz (both sides filled in). If there are fewer than `min`,
 * shows a message with a link to the editor and returns null.
 */
export function usableCards(cards, deck, root, min = 1) {
  const usable = cards.filter(isComplete);
  if (usable.length >= min) return usable;
  root.append(h('main', { class: 'page' },
    h('p', { class: 'empty' }, `This mode needs at least ${min} card${min === 1 ? '' : 's'} with both a term and a definition. `,
      h('a', { href: `#/deck/${deck.id}` }, 'Add cards'))));
  return null;
}
