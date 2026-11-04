# Flashcards

A fast, ad-free, offline-first flashcard app. No accounts, no tracking, no backend: all data lives in your browser's IndexedDB.

**Status:** all five phases done (core, import/export, study modes, spaced repetition and stats, polish). See the roadmap below.

## Run it

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the production build (this is where the offline service worker runs)
npm test           # unit tests (Vitest)
```

On first launch a sample Spanish deck is added. In dev mode the home page has a button to add a
2,000-card deck for performance testing.

## Keyboard shortcuts

| Where  | Key                | Action                         |
|--------|--------------------|--------------------------------|
| Editor | Tab                | term → definition              |
| Editor | Enter              | new card below                 |
| Editor | Shift+Enter        | new line inside a term/definition |
| Editor | Alt+↑ / Alt+↓      | move the card up / down        |
| Anywhere | ?                | show the shortcuts overlay     |
| Study  | Space / Enter / ↑↓ | flip                           |
| Study  | ← →                | previous / next                |
| Study  | S, L               | star / unstar, listen          |
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
  main.js          boot: shortcuts, service worker, seed data, start router
  pwa.js           service worker registration + "new version, Reload" toast
  router.js        hash router (#/, #/deck/:id, #/study/:id); runs each view's cleanup on leave
  logic/           PURE functions, no DOM or database, unit-tested
    ordering.js      card ordering by midpoint (one write per move/insert)
    layout.js        row-offset maths for the variable-height list; textarea fit height
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
    images.js        picture Blobs, object-URL cache, base64 for backups, orphan cleanup
    overview.js      cross-deck reads: all cards, due counts, stats page data
    seed.js          sample deck + large test deck
  ui/
    dom.js           h() element helper, debounce
    virtualList.js   windowed list; measures each row's real height (keeps 1,000+ card decks fast)
    autosize.js      auto-growing textareas (CSS field-sizing, with a measuring fallback)
    toast.js download.js
    studyShell.js    header + mode switcher shared by all study modes
    theme.js         light / dark / system (saved in localStorage, applied before first paint)
    shortcuts.js     the ? help dialog
    speech.js        text to speech (Web Speech API)
    imageTools.js    shrink chosen pictures before storing them
    flipCard.js      two-sided flip card (Flashcards + Review), accessible
    heatmap.js       activity grid with tooltip and table fallback
    quiz.js          reusable question widgets (multiple choice, typed answer, continue panel)
    views/           home.js (deck list), deckEditor.js, study.js,
                     reviewView.js (#/review[/:deckId]), statsView.js (#/stats),
                     learnView.js, writeView.js, testView.js, matchView.js (#/learn|write|test|match/:id),
                     importView.js (#/import[/:deckId]), dataView.js (#/data: backup & restore)
  styles/          base.css (theme variables), components.css
public/            manifest, icons, and sw.js (the service worker; stamped at build time)
vite.config.js     Vite settings + the small plugin that stamps sw.js
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

## Offline use and installing (PWA)

The production build is a static folder (`dist/`): host it anywhere over HTTPS (GitHub Pages, Netlify,
Cloudflare Pages, any web server; it uses relative URLs, so a sub-folder is fine). Open it once online and
the service worker (`public/sw.js`) downloads the whole app; after that it opens with no network, and
your browser offers *Install* / *Add to Home Screen*. Your cards live in IndexedDB on the device, so they
are available offline too. `npm run dev` deliberately does NOT register the service worker (it would
cache stale files while you edit); use `npm run build && npm run preview` to test offline behaviour.

- **Deploying to GitHub Pages:** `.github/workflows/deploy.yml` tests, builds and publishes `dist/` on every
  push to `main` (or `master`). One-time setup: push the repo to GitHub, then *Settings → Pages → Build and
  deployment → Source: GitHub Actions*. The site appears at `https://<user>.github.io/<repo-name>/`. A failing
  test stops the deploy. You can also run it by hand from the repo's *Actions* tab.
- **Updates:** when you deploy a new build, installed copies download it in the background and show a
  "new version is ready, Reload" message. Pages already open keep working on the old files until then.
- **Why a hand-written service worker** instead of `vite-plugin-pwa`: it's ~40 readable lines with no new
  dependency (the plugin pulls in Workbox and many packages). The trade-off is that caching strategy
  is basic (cache everything at install, cache first). That suits an app with no server data.
- **Data safety:** the app asks the browser for *persistent storage* so it is not evicted when space is low.
  Browsers may still refuse, and clearing site data deletes your decks, so use *Backup* now and then.

## Polish features

- **Themes:** the `◐` button on the home page cycles System, Light and Dark.
- **Text to speech:** set a *term language* and *definition language* (for example `es-ES`, `en-US`) on the
  deck editor page, then press 🔊 or `L` while studying or reviewing. It uses your device's built-in voices.
- **Pictures:** use the 🖼 button on a card row. Pictures are shrunk (max 800 px, WebP) and stored in
  IndexedDB, shown on the term side and above quiz prompts, and included in backups.
- **Accessibility:** keyboard-only use throughout (including Alt+↑/↓ to reorder cards), focus moves to the
  page content after navigation, each page has a title and heading, live regions announce flips and
  feedback, control borders and text meet WCAG AA contrast in both themes, and reduced-motion is honoured.
  An automated axe-core scan of every page in both themes reports no violations (that is not a substitute
  for testing with a screen reader).

## Extending

The architecture leaves room for the ideas you listed:

- **Cloud sync:** all reads/writes go through `src/data/`. Ids are UUIDs and decks carry `updatedAt`, and
  `logic/backup.js` already has a merge rule ("newer deck wins"). A sync layer would reuse those.
- **Sharing a deck:** a deck export is already a self-contained JSON file (`exportBackup([deckId])`);
  sharing by link would encode that JSON (compressed) in the URL, or upload it somewhere.
- **Markdown / LaTeX:** card text is rendered in one place per mode (`flipCard.js`, `promptBlock`
  in `quiz.js`, the Test view). Add a `renderCardText()` helper and use it there.
- **Cloze deletions:** add a `type` field to cards (a schema version bump in `data/db.js`), generate
  questions from it in `logic/testGenerator.js` / `learnEngine.js`, and extend the editor row.

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
5. Polish (done): themes, text-to-speech, images, shortcuts overlay, PWA, accessibility
