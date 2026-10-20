/**
 * Backup file format (one format for a single deck, several decks, or everything):
 *
 *   { format: 'flashcards-backup', version: 1, exportedAt, decks: [{ ...deck, cards: [...] }], cardStats: [...] }
 *
 * Files are untrusted input, so `validateBackup` copies ONLY known fields into fresh objects with
 * the right types, instead of passing parsed JSON straight into the database.
 */
import { initialOrders } from './ordering.js';

export const BACKUP_FORMAT = 'flashcards-backup';
export const BACKUP_VERSION = 1;

const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback);
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function normalizeCard(raw, deckId, fallbackOrder) {
  return {
    id: str(raw.id),
    deckId,
    order: num(raw.order, fallbackOrder),
    term: str(raw.term),
    definition: str(raw.definition),
    imageId: typeof raw.imageId === 'string' ? raw.imageId : null,
    starred: raw.starred === true,
    ease: Math.max(1.3, num(raw.ease, 2.5)), // SM-2 never lets ease fall below 1.3
    interval: Math.max(0, num(raw.interval, 0)),
    dueDate: typeof raw.dueDate === 'number' ? raw.dueDate : null,
    repetitions: Math.max(0, num(raw.repetitions, 0)),
    lapses: Math.max(0, num(raw.lapses, 0)),
  };
}

function normalizeDeck(raw, now) {
  const cardsRaw = Array.isArray(raw.cards) ? raw.cards.filter((c) => c && typeof c === 'object') : [];
  const deck = {
    id: str(raw.id),
    title: str(raw.title, 'Untitled deck'),
    description: str(raw.description),
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === 'string') : [],
    termLang: str(raw.termLang), // text-to-speech languages (optional, added after v1)
    definitionLang: str(raw.definitionLang),
    createdAt: num(raw.createdAt, now),
    updatedAt: num(raw.updatedAt, now),
  };
  const orders = initialOrders(cardsRaw.length);
  deck.cards = cardsRaw.map((c, i) => normalizeCard(c, deck.id, orders[i]));
  return deck;
}

function normalizeStat(raw) {
  return {
    cardId: str(raw.cardId),
    correct: Math.max(0, num(raw.correct, 0)),
    incorrect: Math.max(0, num(raw.incorrect, 0)),
    lastStudied: typeof raw.lastStudied === 'number' ? raw.lastStudied : null,
    streak: Math.max(0, num(raw.streak, 0)),
  };
}

function normalizeSession(raw) {
  return {
    id: str(raw.id),
    deckId: str(raw.deckId),
    mode: str(raw.mode),
    date: num(raw.date, 0),
    correct: Math.max(0, num(raw.correct, 0)),
    total: Math.max(0, num(raw.total, 0)),
  };
}

/** Assemble a backup object from flat store contents. Cards are nested under their deck, sorted by order. */
export function buildBackup({ decks, cards, cardStats = [], sessions = [] }, now = Date.now()) {
  const ids = new Set(cards.map((c) => c.id));
  const deckIds = new Set(decks.map((d) => d.id));
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    decks: decks.map((d) => ({
      ...d,
      cards: cards.filter((c) => c.deckId === d.id).sort((a, b) => a.order - b.order),
    })),
    cardStats: cardStats.filter((s) => ids.has(s.cardId)),
    sessions: sessions.filter((s) => deckIds.has(s.deckId)), // study history, for streaks and the heatmap
  };
}

/** Parse + validate JSON text. Returns { backup } on success or { errors: [...] }. */
export function validateBackup(jsonText, now = Date.now()) {
  let raw;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    return { errors: ['This is not valid JSON.'] };
  }
  if (!raw || typeof raw !== 'object' || raw.format !== BACKUP_FORMAT) {
    return { errors: ['This file is not a Flashcards backup.'] };
  }
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    return { errors: [`This backup is from a newer version of the app (format v${raw.version}).`] };
  }
  if (!Array.isArray(raw.decks)) return { errors: ['The backup has no decks list.'] };

  const decks = raw.decks.filter((d) => d && typeof d === 'object').map((d) => normalizeDeck(d, now));
  const bad = decks.find((d) => !d.id || d.cards.some((c) => !c.id));
  if (bad) return { errors: [`Deck "${bad.title}" has a missing id, so the file looks damaged.`] };

  const cardStats = Array.isArray(raw.cardStats) ? raw.cardStats.filter((s) => s && typeof s === 'object').map(normalizeStat) : [];
  // `sessions` was added after v1 shipped, so it is optional: older files simply have none.
  const sessions = Array.isArray(raw.sessions) ? raw.sessions.filter((s) => s && typeof s === 'object').map(normalizeSession).filter((s) => s.id) : [];
  return { backup: { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: num(raw.exportedAt, now), decks, cardStats, sessions } };
}

/**
 * Give every deck and card a brand-new id and drop progress stats. Used when importing a file
 * as NEW decks so it can never collide with (or overwrite) what you already have.
 */
export function withFreshIds(backup, newId) {
  return {
    ...backup,
    cardStats: [],
    sessions: [],
    decks: backup.decks.map((d) => {
      const id = newId();
      return { ...d, id, cards: d.cards.map((c) => ({ ...c, id: newId(), deckId: id })) };
    }),
  };
}

/**
 * Merge rule when restoring on top of existing data: a backup deck is written if you don't have it,
 * or if the backup copy was edited more recently. Existing decks that are newer are left alone.
 * `existing` maps deck id -> updatedAt.
 */
export function decksToRestore(existing, backupDecks) {
  return backupDecks.filter((d) => !existing.has(d.id) || d.updatedAt > existing.get(d.id));
}
