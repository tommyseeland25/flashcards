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
  // Each face is a scrolling box with ONE inner "body" that holds the text (and the picture). The body
  // is what gets centred; see the comment on .face-body in components.css for why it is built this way.
  const frontBody = h('div', { class: 'face-body' });
  const backBody = h('div', { class: 'face-body' });
  const front = h('div', { class: 'face front' }, frontBody);
  const back = h('div', { class: 'face back' }, backBody);
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
      frontBody.replaceChildren(...(imageSrc ? [h('img', { class: 'card-img', src: imageSrc, alt: 'Picture on this card' })] : []), h('span', {}, term));
      backBody.replaceChildren(h('span', {}, definition));
      button.classList.remove('flipped');
      front.scrollTop = 0; // a new card always starts at the top of both faces
      back.scrollTop = 0;
      sync(true);
    },
    /** The side currently face-up and its text, e.g. for text to speech. */
    visible() {
      const side = api.flipped ? 'definition' : 'term';
      return { side, text: text[side] };
    },
    flip() {
      button.classList.toggle('flipped');
      // Start the face that is turning toward you at its top. (The face turning away keeps its
      // position until it is needed again, so its text doesn't visibly jump mid-flip.)
      (api.flipped ? back : front).scrollTop = 0;
      sync(true);
      onFlip?.(api.flipped);
    },
  };
  return api;
}
