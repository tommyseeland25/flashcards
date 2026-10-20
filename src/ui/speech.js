import { h } from './dom.js';

/**
 * Text to speech through the browser's built-in Web Speech API: offline-capable on most
 * devices (it uses the OS voices), with no network call and no dependency.
 * `lang` is a BCP-47 code such as "es-ES"; empty means "the browser's default voice".
 */
export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text, lang = '') {
  if (!speechSupported || !text.trim()) return;
  speechSynthesis.cancel(); // don't queue up if the button is pressed repeatedly
  const utterance = new SpeechSynthesisUtterance(text);
  if (lang) utterance.lang = lang;
  speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (speechSupported) speechSynthesis.cancel();
}

/** Which language to use for the face being shown: the deck sets one per side. */
export const langFor = (deck, side) => (side === 'term' ? deck?.termLang : deck?.definitionLang) ?? '';

/** A speaker button (null where unsupported, so callers can drop it into h() children). */
export function speakButton(onSpeak) {
  if (!speechSupported) return null;
  return h('button', { class: 'icon-btn speak', 'aria-label': 'Listen to this card', title: 'Listen (L)', onclick: onSpeak }, '🔊');
}
