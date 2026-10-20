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

  let text = { term: '', definition: '' };

  const api = {
    el,
    get flipped() { return el.classList.contains('flipped'); },
    /** Show new content, face up on the term side. */
    set(term, definition, imageSrc = null) {
      text = { term, definition };
      // The image belongs to the term side; the text goes in a span so it can sit under the picture.
      front.replaceChildren(...(imageSrc ? [h('img', { class: 'card-img', src: imageSrc, alt: 'Picture on this card' })] : []), h('span', {}, term));
      back.textContent = definition;
      el.classList.remove('flipped');
    },
    /** The side currently face-up and its text, e.g. for text to speech. */
    visible() {
      const side = api.flipped ? 'definition' : 'term';
      return { side, text: text[side] };
    },
    flip() {
      el.classList.toggle('flipped');
      onFlip?.(api.flipped);
    },
  };
  return api;
}
