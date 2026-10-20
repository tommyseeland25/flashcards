import { getDb, newId } from './db.js';
import { initialOrders, orderBetween, orderForMove } from '../logic/ordering.js';

/** Fresh card with default spaced-repetition fields (SM-2 starting values). */
export function makeCard(deckId, order, { term = '', definition = '' } = {}) {
  return {
    id: newId(),
    deckId,
    order,
    term,
    definition,
    imageId: null,
    starred: false,
    ease: 2.5,
    interval: 0,
    dueDate: null,
    repetitions: 0,
    lapses: 0,
  };
}

/** All cards in a deck, sorted by `order`. */
export async function listCards(deckId) {
  const db = await getDb();
  const cards = await db.getAllFromIndex('cards', 'deckId', deckId);
  return cards.sort((a, b) => a.order - b.order);
}

/**
 * Create a card positioned after `afterIndex` WITHOUT waiting for the database, so the UI can
 * show (and focus) it immediately. Persist it with `saveCard`.
 */
export function newCardAfter(deckId, cards, afterIndex = cards.length - 1, fields) {
  const order = orderBetween(cards[afterIndex]?.order, cards[afterIndex + 1]?.order);
  return makeCard(deckId, order, fields);
}

/** Create and persist a card (used where nothing needs to be shown instantly). */
export async function addCard(deckId, cards, afterIndex, fields) {
  const card = newCardAfter(deckId, cards, afterIndex, fields);
  await saveCard(card);
  return card;
}

export async function saveCard(card) {
  const db = await getDb();
  await db.put('cards', card);
}

export async function deleteCard(cardId) {
  const db = await getDb();
  await db.delete('cards', cardId);
}

/**
 * Move one card within the sorted list. Mutates the card in place (rather than copying it) so any
 * other reference to it, e.g. a pending debounced save in the editor, sees the new order.
 */
export async function moveCard(cards, from, to) {
  const card = cards[from];
  card.order = orderForMove(cards, from, to);
  await saveCard(card);
  return card;
}

/** Bulk insert (seed data, imports). Single transaction = fast and all-or-nothing. */
export async function addCards(cardList) {
  const db = await getDb();
  const tx = db.transaction('cards', 'readwrite');
  await Promise.all([...cardList.map((c) => tx.store.put(c)), tx.done]);
}

/** Add many cards ({ term, definition, starred? }) to the end of a deck, keeping their given order. */
export async function appendCards(deckId, newCards) {
  const existing = await listCards(deckId);
  const start = existing.length ? existing[existing.length - 1].order : 0;
  const orders = initialOrders(newCards.length).map((o) => start + o);
  await addCards(
    newCards.map((c, i) => ({ ...makeCard(deckId, orders[i], c), starred: c.starred === true })),
  );
}
