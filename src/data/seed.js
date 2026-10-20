import { getDb } from './db.js';
import { createDeckWithCards } from './decks.js';

const SAMPLE = [
  ['Hola', 'Hello'],
  ['Adiós', 'Goodbye'],
  ['Por favor', 'Please'],
  ['Gracias', 'Thank you'],
  ['De nada', "You're welcome"],
  ['¿Cómo estás?', 'How are you?'],
  ['Buenos días', 'Good morning'],
  ['Buenas noches', 'Good night'],
  ['Lo siento', "I'm sorry"],
  ['¿Dónde está el baño?', 'Where is the bathroom?'],
  ['Me llamo...', 'My name is...'],
  ['Mucho gusto', 'Nice to meet you'],
];

const toCards = (pairs) => pairs.map(([term, definition]) => ({ term, definition }));

/** On first launch only, add a sample deck so the app isn't empty. */
export async function seedIfFirstRun() {
  const db = await getDb();
  if (await db.get('meta', 'seeded')) return;
  await createDeckWithCards('Spanish basics (sample)', 'Try studying this deck first!', toCards(SAMPLE));
  await db.put('meta', { key: 'seeded', value: true });
}

/** Dev-only helper to check performance with a big deck. */
export function createLargeTestDeck(n = 2000) {
  const cards = Array.from({ length: n }, (_, i) => ({ term: `Term ${i + 1}`, definition: `Definition ${i + 1}` }));
  return createDeckWithCards(`Large test deck (${n})`, 'Performance testing', cards);
}
