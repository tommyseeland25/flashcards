import { shuffle } from './shuffle.js';

/** A card is usable for study once it has some content on either side. */
export function isStudyable(card) {
  return card.term.trim() !== '' || card.definition.trim() !== '';
}

/**
 * Build the list of cards to show in a study session.
 * Cards arrive sorted by `order`; shuffling is optional.
 */
export function buildQueue(cards, { starredOnly = false, shuffleCards = false, random } = {}) {
  let queue = cards.filter(isStudyable);
  if (starredOnly) queue = queue.filter((c) => c.starred);
  return shuffleCards ? shuffle(queue, random) : queue;
}
