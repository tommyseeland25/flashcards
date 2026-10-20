import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { createDeck, createDeckWithCards, deleteDeck, duplicateDeck, listDecks } from '../src/data/decks.js';
import { addCard, listCards, moveCard } from '../src/data/cards.js';

describe('deck repository', () => {
  it('duplicates a deck with its cards, then deletes cascade', async () => {
    const deck = await createDeckWithCards('Spanish', '', [{ term: 'hola', definition: 'hello' }, { term: 'adios', definition: 'bye' }]);
    const copy = await duplicateDeck(deck.id);
    expect(copy.id).not.toBe(deck.id);
    expect((await listCards(copy.id)).map((c) => c.term)).toEqual(['hola', 'adios']);

    await deleteDeck(deck.id);
    expect(await listCards(deck.id)).toEqual([]);
    expect((await listCards(copy.id)).length).toBe(2);
    expect((await listDecks()).find((d) => d.id === copy.id).cardCount).toBe(2);
  });

  it('inserts and moves cards while keeping order sorted', async () => {
    const deck = await createDeck({ title: 'Order' });
    let cards = [];
    for (const t of ['a', 'b', 'c']) cards.push(await addCard(deck.id, cards, cards.length - 1, { term: t }));
    const inserted = await addCard(deck.id, cards, 0, { term: 'x' }); // after 'a'
    expect((await listCards(deck.id)).map((c) => c.term)).toEqual(['a', 'x', 'b', 'c']);

    cards = await listCards(deck.id);
    await moveCard(cards, 3, 0); // 'c' to front
    expect((await listCards(deck.id)).map((c) => c.term)).toEqual(['c', 'a', 'x', 'b']);
    expect(inserted.term).toBe('x');
  });
});
