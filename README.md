# Flashcards

A fast, ad-free, offline-first flashcard app. No accounts, no tracking, no backend: all data lives in your browser's IndexedDB.

**Status:** Phases 1-4 done (core, import/export, study modes, spaced repetition and stats). See the roadmap below.

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
| Learn / Write | Enter       | submit typed answer, then continue |
| Learn  | 1–4                | pick a multiple-choice option  |
| Learn / Write | O (after a miss) | "I was right" override    |
| Review | Space              | show answer, then Space = Good |
| Review | 1 / 2 / 3 / 4      | Again / Hard / Good / Easy     |
| Test   | Tab, arrows, Enter | native radios/inputs, Enter submits |
| Match  | Tab, Enter / Space | select tiles                   |

## Code map

```
src/
  main.js          boot: seed data, start router
  router.js        hash router (#/, #/deck/:id, #/study/:id); runs each view's cleanup on leave
  logic/           PURE functions, no DOM or database, unit-tested
    ordering.js      card ordering by midpoint (one write per move/insert)
    studyQueue.js    which cards a study session shows (starred filter, shuffle)
    shuffle.js       Fisher-Yates
    importParser.js  pasted text -> cards (configurable separators, Quizlet format), skipped-line reports
    csv.js           CSV parse/serialize, deck <-> CSV, deck -> Quizlet-style text
    backup.js        backup file format, validation/sanitizing, fresh ids, merge rule
    matching.js      forgiving answer check (case/space/punctuation, alternatives, "close" typos)
    learnEngine.js   LearnSession: adaptive rounds, mastery levels, missed cards come back
    testGenerator.js choice/true-false/written questions, distractors, scoring
    matchGame.js     pick unique pairs, tiles, match rule, best-time helpers
    stats.js         per-card correct/incorrect/streak update
    scheduler.js     SM-2 spaced repetition: schedule(), due/new counts, review queue
    analytics.js     study streak, heatmap grid, per-deck summaries
  data/            the ONLY code that touches IndexedDB
    db.js            schema + versioned migrations
    decks.js cards.js   repository functions (CRUD, duplicate, reorder)
    backup.js        export everything, import as new decks, restore (replace / merge)
    stats.js         record answers and sessions; small meta store (personal bests)
    overview.js      cross-deck reads: all cards, due counts, stats page data
    seed.js          sample deck + large test deck
  ui/
    dom.js           h() element helper, debounce
    virtualList.js   windowed list for fixed-height rows (keeps 1,000+ card decks fast)
    toast.js download.js
    studyShell.js    header + mode switcher shared by all study modes
    flipCard.js      two-sided flip card (Flashcards + Review)
    heatmap.js       activity grid with tooltip and table fallback
    quiz.js          reusable question widgets (multiple choice, typed answer, continue panel)
    views/           home.js (deck list), deckEditor.js, study.js,
                     reviewView.js (#/review[/:deckId]), statsView.js (#/stats),
                     learnView.js, writeView.js, testView.js, matchView.js (#/learn|write|test|match/:id),
                     importView.js (#/import[/:deckId]), dataView.js (#/data: backup & restore)
  styles/          base.css (theme variables), components.css
tests/             Vitest tests for logic/ and the data layer (fake-indexeddb)
```

Layering: `ui → data` and `ui → logic`. `logic` never imports from `ui` or `data`.

## Study modes

- **Learn:** rounds of up to 7 cards. A card is asked as multiple choice, then typed; both right = mastered.
  A miss resets that card and brings it back a few questions later in the same round.
- **Write:** type every definition (shuffled); missed cards can be practiced again.
- **Test:** pick question types and count; one page, graded at the end, with a review of misses.
- **Match:** pick 4–12 pairs, timed from your first click; best time is saved per deck and size.
- **Answer matching** ignores case, spacing and punctuation (don't = dont, well-known = well known) but
  keeps accents. `big / large` or `car; automobile` accept either one, and `(parenthesized)` text is
  optional. A one-typo answer on a 5+ letter word shows "Close!" and can be overridden with "I was right".
- Every answer updates per-card stats and each finished session is logged, ready for the Phase 4 stats page.

## Spaced repetition (Review mode)

Uses a simplified **SM-2**. Each card has `ease` (starts 2.5, floor 1.3), `interval` (days), `repetitions`
and `lapses`. Rating a card Good twice gives gaps of 1 and 6 days; after that the gap is multiplied by
`ease` (so 15, 38, ... days). Hard grows more slowly and lowers ease, Easy grows faster and raises it,
and Again resets the ladder, lowers ease by 0.2, and brings the card back in 10 minutes.
All the math is in `src/logic/scheduler.js`, commented line by line.

- **Why SM-2 over Leitner:** Leitner boxes (fixed gaps like 1, 3, 7 days) are simpler to explain, but
  every card in a box gets the same gap. SM-2 gives each card its own gap, so easy cards fade out and
  hard ones return often, which means fewer reviews for the same retention. The cost is a few more
  numbers per card. The scheduler is one pure function, so a Leitner option could be added beside it.
- **Due today** = scheduled for any time up to the end of today. Cards become due at the *start* of a
  day, so reviewing at 8am or 8pm doesn't shift tomorrow's schedule.
- **New cards** are introduced 10 per session, after the due cards. Start another session for more.
- The home page shows a due/new banner and per-deck badges. `#/review` covers all decks.
- **Stats** (`#/stats`): streak, cards mastered (interval of 21+ days), due today, per-deck accuracy,
  and a 26-week activity heatmap. Study history is stored as session records and is part of backups.

## Importing and exporting

- **From Quizlet:** open your set, choose *Export*, copy the text, then in the app click *Import* and
  paste it. The defaults (Tab between term and definition, new line between cards) match Quizlet's
  export. Lines that can't be parsed are listed, not silently dropped.
- **Formats:** pasted text (any separators), CSV (`term,definition[,starred]`, header optional), and
  JSON. Each deck's editor page can export Text, CSV or JSON, and *Import cards…* adds to that deck.
- **Backup (`#/data`):** one JSON file with all decks, cards and progress. *Merge* keeps whichever
  copy of a deck was edited most recently; *Replace* wipes first. Backup files are validated and
  sanitized before they touch the database.
- Text export turns tabs and newlines inside a card into spaces, because the format can't represent them.

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
