import { h } from './dom.js';

/**
 * The two-sided flashcard used by Flashcards and Review.
 * The flip is a CSS 3D transform (see components.css), which the browser animates on the GPU.
 * `onFlip` lets the host react (e.g. Review reveals its rating buttons).
 */
export function createFlipCard({ onFlip } = {}) {
  const front = h('div', { class: 'face front' });
  const back = h('div', { class: 'face back' });
  const el = h('div', {
    class: 'study-card', role: 'button', tabIndex: 0, 'aria-label': 'Flip card',
    onclick: () => api.flip(),
  }, h('div', { class: 'flipper' }, front, back));

  const api = {
    el,
    get flipped() { return el.classList.contains('flipped'); },
    /** Show new content, face up on the term side. */
    set(term, definition) {
      front.textContent = term;
      back.textContent = definition;
      el.classList.remove('flipped');
    },
    flip() {
      el.classList.toggle('flipped');
      onFlip?.(api.flipped);
    },
  };
  return api;
}
