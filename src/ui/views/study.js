import { h } from '../dom.js';
import { getDeck } from '../../data/decks.js';
import { listCards, saveCard } from '../../data/cards.js';
import { buildQueue } from '../../logic/studyQueue.js';
import { studyHeader, deckNotFound } from '../studyShell.js';
import { createFlipCard } from '../flipCard.js';
import { speak, speakButton, stopSpeaking, langFor } from '../speech.js';

export async function studyView([deckId], root) {
  const deck = await getDeck(deckId);
  if (!deck) return deckNotFound(root);
  const allCards = await listCards(deckId);
  let queue = [];
  let index = 0;
  let shuffleCards = false;
  let starredOnly = false;

  const card = createFlipCard();
  const star = h('button', { class: 'icon-btn star', 'aria-label': 'Star card', title: 'Star (S)', onclick: () => toggleStar() }, '☆');
  const progress = h('div', { class: 'progress-fill' });
  const counter = h('span', {});
  const empty = h('p', { class: 'empty', hidden: true });
  const listen = () => { const { side, text } = card.visible(); speak(text, langFor(deck, side)); };
  const stage = h('div', { class: 'stage' }, card.el, speakButton(listen), star);

  function rebuild(keepCard) {
    const current = queue[index];
    queue = buildQueue(allCards, { starredOnly, shuffleCards });
    const kept = keepCard && current ? queue.indexOf(current) : -1;
    index = kept >= 0 ? kept : 0;
    show();
  }

  function showStar(c) {
    star.classList.toggle('on', c.starred);
    star.textContent = c.starred ? '★' : '☆'; // shape changes too, so state isn't colour-only
    star.setAttribute('aria-pressed', c.starred);
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
    card.set(c.term, c.definition);
    showStar(c);
    counter.textContent = `${index + 1} / ${queue.length}`;
    progress.style.width = `${((index + 1) / queue.length) * 100}%`;
  }

  function flip() {
    if (!queue.length) return;
    card.flip();
  }
  function go(step) {
    if (!queue.length) return;
    index = (index + step + queue.length) % queue.length;
    show();
  }
  async function toggleStar() {
    const c = queue[index];
    if (!c) return;
    c.starred = !c.starred;
    showStar(c); // not show(): that would flip the card back over
    await saveCard(c);
  }

  function onKey(e) {
    if (e.target.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    const handlers = {
      ' ': flip, Enter: flip, ArrowUp: flip, ArrowDown: flip,
      ArrowRight: () => go(1), ArrowLeft: () => go(-1),
      s: toggleStar, S: toggleStar, l: listen, L: listen,
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
    studyHeader(deck, 'study'),
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

  return () => {
    document.removeEventListener('keydown', onKey);
    stopSpeaking();
  };
}
