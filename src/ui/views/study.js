import { h } from '../dom.js';
import { getDeck } from '../../data/decks.js';
import { listCards, saveCard } from '../../data/cards.js';
import { buildQueue } from '../../logic/studyQueue.js';

export async function studyView([deckId], root) {
  const deck = await getDeck(deckId);
  if (!deck) {
    root.append(h('p', { class: 'page' }, 'Deck not found. ', h('a', { href: '#/' }, 'Back to decks')));
    return;
  }
  const allCards = await listCards(deckId);
  let queue = [];
  let index = 0;
  let flipped = false;
  let shuffleCards = false;
  let starredOnly = false;

  const front = h('div', { class: 'face front' });
  const back = h('div', { class: 'face back' });
  const star = h('button', { class: 'icon-btn star', 'aria-label': 'Star card', title: 'Star (S)', onclick: () => toggleStar() }, '★');
  const flipper = h('div', { class: 'flipper' }, front, back);
  const card = h('div', {
    class: 'study-card', role: 'button', tabIndex: 0, 'aria-label': 'Flip card',
    onclick: () => flip(),
  }, flipper);
  const progress = h('div', { class: 'progress-fill' });
  const counter = h('span', {});
  const empty = h('p', { class: 'empty', hidden: true });
  const stage = h('div', { class: 'stage' }, card, star);

  function rebuild(keepCard) {
    const current = queue[index];
    queue = buildQueue(allCards, { starredOnly, shuffleCards });
    const kept = keepCard && current ? queue.indexOf(current) : -1;
    index = kept >= 0 ? kept : 0;
    flipped = false;
    show();
  }

  function show() {
    const c = queue[index];
    empty.hidden = !!c;
    stage.hidden = !c;
    if (!c) {
      empty.textContent = starredOnly ? 'No starred cards in this deck yet.' : 'This deck has no cards yet.';
      counter.textContent = '0 / 0';
      progress.style.width = '0%';
      return;
    }
    front.textContent = c.term;
    back.textContent = c.definition;
    card.classList.toggle('flipped', flipped);
    star.classList.toggle('on', c.starred);
    star.setAttribute('aria-pressed', c.starred);
    counter.textContent = `${index + 1} / ${queue.length}`;
    progress.style.width = `${((index + 1) / queue.length) * 100}%`;
  }

  function flip() {
    if (!queue.length) return;
    flipped = !flipped;
    card.classList.toggle('flipped', flipped);
  }
  function go(step) {
    if (!queue.length) return;
    index = (index + step + queue.length) % queue.length;
    flipped = false;
    show();
  }
  async function toggleStar() {
    const c = queue[index];
    if (!c) return;
    c.starred = !c.starred;
    show();
    await saveCard(c);
  }

  function onKey(e) {
    if (e.target.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    const handlers = {
      ' ': flip, Enter: flip, ArrowUp: flip, ArrowDown: flip,
      ArrowRight: () => go(1), ArrowLeft: () => go(-1),
      s: toggleStar, S: toggleStar,
    };
    const fn = handlers[e.key];
    if (!fn) return;
    e.preventDefault();
    fn();
  }
  document.addEventListener('keydown', onKey);

  const toggle = (label, onChange) =>
    h('label', { class: 'toggle' }, h('input', { type: 'checkbox', onchange: (e) => onChange(e.target.checked) }), label);

  root.append(
    h('header', { class: 'topbar' },
      h('a', { class: 'btn', href: '#/' }, '← Decks'),
      h('h1', { class: 'grow' }, deck.title),
      h('a', { class: 'btn', href: `#/deck/${deckId}` }, 'Edit'),
    ),
    h('main', { class: 'page study' },
      h('div', { class: 'progress' }, progress),
      h('div', { class: 'study-meta' }, counter),
      empty,
      stage,
      h('div', { class: 'controls' },
        h('button', { class: 'btn', onclick: () => go(-1) }, '← Prev'),
        h('button', { class: 'btn primary', onclick: flip }, 'Flip'),
        h('button', { class: 'btn', onclick: () => go(1) }, 'Next →'),
      ),
      h('div', { class: 'options' },
        toggle('Shuffle', (v) => { shuffleCards = v; rebuild(true); }),
        toggle('Starred only', (v) => { starredOnly = v; rebuild(true); }),
      ),
      h('p', { class: 'muted hint' }, 'Space: flip · ← →: move · S: star'),
    ),
  );
  rebuild(false);

  return () => document.removeEventListener('keydown', onKey);
}
