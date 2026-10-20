import { getDb, newId } from './db.js';
import { addCards, appendCards, listCards, makeCard } from './cards.js';
import { initialOrders } from '../logic/ordering.js';

/** Decks with a `cardCount`, for the home page. */
export async function listDecks() {
  const db = await getDb();
  const decks = await db.getAll('decks');
  return Promise.all(
    decks.map(async (d) => ({ ...d, cardCount: await db.countFromIndex('cards', 'deckId', d.id) })),
  );
}

export async function getDeck(id) {
  const db = await getDb();
  return db.get('decks', id);
}

export async function createDeck({ title = 'Untitled deck', description = '', tags = [], termLang = '', definitionLang = '' } = {}) {
  const now = Date.now();
  const deck = { id: newId(), title, description, tags, termLang, definitionLang, createdAt: now, updatedAt: now };
  const db = await getDb();
  await db.put('decks', deck);
  return deck;
}

export async function updateDeck(deck) {
  const updated = { ...deck, updatedAt: Date.now() };
  const db = await getDb();
  await db.put('decks', updated);
  return updated;
}

/** Deleting a deck also deletes its cards, in one transaction. */
export async function deleteDeck(id) {
  const db = await getDb();
  const cardKeys = await db.getAllKeysFromIndex('cards', 'deckId', id);
  const tx = db.transaction(['decks', 'cards'], 'readwrite');
  await Promise.all([
    tx.objectStore('decks').delete(id),
    ...cardKeys.map((k) => tx.objectStore('cards').delete(k)),
    tx.done,
  ]);
}

/** Copy a deck and its cards. Study progress is reset on the copy. */
export async function duplicateDeck(id) {
  const original = await getDeck(id);
  const copy = await createDeck({
    title: `${original.title} (copy)`,
    description: original.description,
    tags: [...original.tags],
    termLang: original.termLang ?? '',
    definitionLang: original.definitionLang ?? '',
  });
  const cards = await listCards(id);
  const orders = initialOrders(cards.length);
  await addCards(
    cards.map((c, i) => ({
      ...makeCard(copy.id, orders[i], { term: c.term, definition: c.definition }),
      starred: c.starred,
      imageId: c.imageId,
    })),
  );
  return copy;
}

/** Create a deck and fill it with `cards` ({ term, definition, starred? }) in one go. */
export async function createDeckWithCards(title, description, cards) {
  const deck = await createDeck({ title, description });
  await appendCards(deck.id, cards);
  return deck;
}
