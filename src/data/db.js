import { openDB } from 'idb';

const DB_NAME = 'flashcards';
const DB_VERSION = 1;

/**
 * The single place that knows the IndexedDB schema.
 * To change the schema later: bump DB_VERSION and add an `if (oldVersion < N)` block
 * below, so existing users' data is migrated instead of lost.
 */
let dbPromise;

export function getDb() {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('decks', { keyPath: 'id' });

        const cards = db.createObjectStore('cards', { keyPath: 'id' });
        cards.createIndex('deckId', 'deckId'); // load a deck's cards
        cards.createIndex('dueDate', 'dueDate'); // spaced repetition (Phase 4)

        db.createObjectStore('cardStats', { keyPath: 'cardId' });
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('deckId', 'deckId');
        db.createObjectStore('images', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' }); // settings, personal bests, flags
      }
    },
  });
  return dbPromise;
}

export const newId = () => crypto.randomUUID();
