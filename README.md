# Flashcards

A fast, ad-free, offline-first flashcard app. No accounts, no tracking, no backend: all data lives in your browser's IndexedDB.

**Status:** Phase 1 (core) done. See the roadmap below.

## Run it

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the production build
npm test           # unit tests (Vitest)
```

On first launch a sample Spanish deck is added. In dev mode the home page has a button to add a
2,000-card deck for performance testing.

## Keyboard shortcuts

| Where  | Key                | Action                         |
|--------|--------------------|--------------------------------|
| Editor | Tab                | term → definition              |
| Editor | Enter              | new card below                 |
| Study  | Space / Enter / ↑↓ | flip                           |
| Study  | ← →                | previous / next                |
| Study  | S                  | star / unstar                  |

## Code map

```
src/
  main.js          boot: seed data, start router
  router.js        hash router (#/, #/deck/:id, #/study/:id); runs each view's cleanup on leave
  logic/           PURE functions, no DOM or database, unit-tested
    ordering.js      card ordering by midpoint (one write per move/insert)
    studyQueue.js    which cards a study session shows (starred filter, shuffle)
    shuffle.js       Fisher-Yates
  data/            the ONLY code that touches IndexedDB
    db.js            schema + versioned migrations
    decks.js cards.js   repository functions (CRUD, duplicate, reorder)
    seed.js          sample deck + large test deck
  ui/
    dom.js           h() element helper, debounce
    virtualList.js   windowed list for fixed-height rows (keeps 1,000+ card decks fast)
    toast.js
    views/           home.js (deck list), deckEditor.js, study.js
  styles/          base.css (theme variables), components.css
tests/             Vitest tests for logic/ and the data layer (fake-indexeddb)
```

Layering: `ui → data` and `ui → logic`. `logic` never imports from `ui` or `data`.

## Design notes

- **Vanilla JS, no framework:** smallest bundle (about 7 KB gzipped), and nothing to learn first. Views
  are plain functions `(params, root) => cleanup`.
- **Ordering:** each card has a numeric `order`. Inserting or dragging sets it to the midpoint of its
  neighbours, so only one record is written.
- **Editor saves:** typing is debounced (400 ms) and flushed when you leave the page.
- **Dependencies:** runtime: `idb` only. Dev: `vite`, `vitest`, `fake-indexeddb` (an in-memory
  IndexedDB so the data layer can be tested in Node).

## Roadmap

1. Core (done): decks, fast editor, deck list, flashcard study
2. Import/export: pasted text (Quizlet format), CSV, JSON, full backup
3. Study modes: Learn, Write, Test, Match
4. Spaced repetition (SM-2) and stats
5. Polish: themes, text-to-speech, images, shortcuts overlay, PWA, accessibility
