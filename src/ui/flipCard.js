import { h } from './dom.js';

/**
 * The two-sided flashcard used by Flashcards and Review.
 * The flip is a CSS 3D transform (see components.css), which the browser animates on the GPU.
 * `onFlip` lets the host react (e.g. Review reveals its rating buttons).
 *
 * Accessibility: the card is a button whose name is the text currently showing; the hidden face is
 * aria-hidden; and a visually hidden live region reads out each new card and each flip.
 */
export function createFlipCard({ onFlip } = {}) {
  const front = h('div', { class: 'face front' });
  const back = h('div', { class: 'face back' });
  const button = h('div', {
    class: 'study-card', role: 'button', tabIndex: 0,
    onclick: () => api.flip(),
  }, h('div', { class: 'flipper' }, front, back));
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite' });
  const el = h('div', { class: 'flip-wrap' }, button, live);

  let text = { term: '', definition: '' };

  /** Keep the accessible name, hidden face and announcement in step with what is visible. */
  const sync = (announce) => {
    const side = api.flipped ? 'definition' : 'term';
    front.setAttribute('aria-hidden', side !== 'term');
    back.setAttribute('aria-hidden', side !== 'definition');
    button.setAttribute('aria-label', `${text[side]}. Press to flip.`);
    if (announce) live.textContent = text[side];
  };

  const api = {
    el,
    get flipped() { return button.classList.contains('flipped'); },
    /** Show new content, face up on the term side. */
    set(term, definition, imageSrc = null) {
      text = { term, definition };
      // The image belongs to the term side; the text goes in a span so it can sit under the picture.
      front.replaceChildren(...(imageSrc ? [h('img', { class: 'card-img', src: imageSrc, alt: 'Picture on this card' })] : []), h('span', {}, term));
      back.textContent = definition;
      button.classList.remove('flipped');
      sync(true);
    },
    /** The side currently face-up and its text, e.g. for text to speech. */
    visible() {
      const side = api.flipped ? 'definition' : 'term';
      return { side, text: text[side] };
    },
    flip() {
      button.classList.toggle('flipped');
      sync(true);
      onFlip?.(api.flipped);
    },
  };
  return api;
}
