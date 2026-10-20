# How the Flashcards app works

A guided tour of the code, written for someone who knows some JavaScript but did not write this app.
Line numbers refer to the code as of this commit; if you edit files they will drift, so search for the
function name instead.

> This file grows as the walkthrough goes: Step 1 (the big picture) is here; Step 2 (each subsystem) is
> appended topic by topic.

---

## Step 1: The big picture

### 1.1 Map of the project

About 3,300 lines of JavaScript (+260 of CSS) in `src/`, and about 700 lines of tests.

| Path | What it is |
|---|---|
| `index.html` (25 lines) | The only HTML page. Sets the saved theme before first paint, links the manifest and icons, loads `src/main.js`. Everything else is built by JavaScript into `<div id="app">`. |
| `src/main.js` | Boot sequence. Lists the **routes** (lines 20-32), registers shortcuts and the service worker, seeds the sample deck, starts the router. |
| `src/router.js` | A ~40-line hash router: URL fragment (`#/stats`) -> a "view" function. |
| `src/ui/` (UI layer) | Everything that touches the DOM. `dom.js` (the `h()` element builder, `debounce`), `virtualList.js` (windowed list), `quiz.js` (question widgets), `flipCard.js`, `heatmap.js`, `theme.js`, `shortcuts.js`, `speech.js`, `toast.js`, ... |
| `src/ui/views/` | **One file per screen**: `home`, `deckEditor`, `study` (flashcards), `learn`, `write`, `test`, `match`, `review`, `stats`, `import`, `data` (backup). |
| `src/logic/` (~830 lines) | **Pure functions**: no DOM, no database, no clock (time is passed in). `scheduler.js` (SM-2), `matching.js`, `learnEngine.js`, `testGenerator.js`, `matchGame.js`, `importParser.js`, `csv.js`, `backup.js`, `analytics.js`, `ordering.js`, `studyQueue.js`, `shuffle.js`, `stats.js`. |
| `src/data/` (~410 lines) | The **only** code that talks to IndexedDB: `db.js` (schema), `decks.js`, `cards.js`, `stats.js`, `images.js`, `overview.js`, `backup.js`, `seed.js`. |
| `src/pwa.js`, `public/sw.js`, `public/manifest.webmanifest` | Offline support and installability. |
| `vite.config.js` | Bundler settings plus a small plugin that stamps the service worker at build time. |
| `tests/` | Vitest tests for `logic/` and `data/` (the data tests run against `fake-indexeddb`, an in-memory IndexedDB). |
| `.github/workflows/deploy.yml` | CI: test, build, publish to GitHub Pages on every push. |

**The one rule that organizes the code:** dependencies point downward.

```
ui/  --->  data/   --->  (IndexedDB)
 |
 +----->  logic/   (never imports from ui/ or data/)
```

`logic/` knowing nothing about the DOM or the database is what makes it easy to test and to reason about.
When you read a `logic/` file you can ignore the browser entirely.

### 1.2 How the pieces connect

```
                      THE BROWSER TAB
 +-----------------------------------------------------------------+
 |  index.html --> src/main.js                                     |
 |                    |  registers routes, starts router           |
 |                    v                                            |
 |   URL "#/deck/42" --> router.js --> views/deckEditor.js         |
 |                                         |         |             |
 |        builds DOM with ui/dom.js h()    |         |             |
 |        (virtualList, quiz, flipCard...) |         |             |
 |                                         v         v             |
 |                              logic/ (pure)     data/ (async)    |
 |                              scheduler, matching,   decks, cards,|
 |                              learnEngine, tests,    stats, images|
 |                              import parsers, csv,   backup       |
 |                              backup format           |           |
 |                                     ^                |           |
 |   import/export:  views/importView, dataView         |           |
 |     text/CSV/JSON --logic/--> cards --data/--------->|           |
 +------------------------------------------------------|-----------+
                                                        v
                                         IndexedDB  ("flashcards" DB)
                                         decks | cards | cardStats |
                                         sessions | images | meta

 +----------------------- SERVICE WORKER (separate thread) -----------------------+
 |  public/sw.js sits BETWEEN the page and the network:                          |
 |     page requests "assets/index-abc.js" --> sw.js --> Cache Storage (offline) |
 |  It caches the app's FILES. It never touches IndexedDB (your cards).          |
 +-------------------------------------------------------------------------------+

 BUILD / DEPLOY:  git push --> GitHub Actions: npm ci, npm test, npm run build
                  --> dist/ --> GitHub Pages --> your browser
```

Two kinds of "offline storage" are in play, and they are different: **IndexedDB** holds *your data* (decks,
cards, progress), while the service worker's **Cache Storage** holds *the app's code* (HTML, JS, CSS, icons).

### 1.3 One action traced end to end: pressing Enter to add a card

Scenario: you are in the deck editor, your cursor is in the **Term** box of card 2, and you press Enter.
We follow it through every file.

**0. How you got here (once, when the page opened).**
- `main.js:38-39` seeds data, then calls `startRouter(...)`.
- `router.js:38-39` listens for `hashchange` and runs `navigate()` once immediately.
- `router.js:21-26` loops over the routes, finds the regex `/^\/deck\/([^/]+)$/` (`main.js:22`) that matches
  `#/deck/<id>`, and extracts the id.
- `router.js:26` calls `deckEditorView([deckId], root)` (`deckEditor.js:14`). It loads the deck and cards from
  IndexedDB (`deckEditor.js:15,21`), builds the page, and returns a cleanup function (`:265`).

**1. The keypress.** Every Term/Definition box is a `<textarea>` built in `renderRow` (`deckEditor.js:45`).
Its `onkeydown` handler (`:52-53`) sees `Enter` without Shift, calls `e.preventDefault()` (so no newline is
typed) and calls `insertAfter(card)`.

**2. `insertAfter` (`deckEditor.js:126`)** does the work in a deliberate order:
1. `:127` `cards.indexOf(card)` finds where the current card sits in the in-memory array.
2. `:128` `newCardAfter(deckId, cards, index)` (`data/cards.js:33`). It is *synchronous*. It asks
   `orderBetween(prev, next)` (`logic/ordering.js:14`) for a sort key between the neighbours: the average of
   the two (`:18`), or last-card-order + 1024 if the new card goes at the end (`:17`). Then `makeCard`
   (`cards.js:5`) builds a plain object with a fresh id (`crypto.randomUUID()`, `db.js:34`), empty text and
   starting spaced-repetition values. **Nothing has been written to the database yet.**
3. `:129` `cards.splice(index + 1, 0, fresh)` puts it into the array.
4. `:130` `edited(fresh)` (`:33`) adds it to the `pending` map and calls `queueSave()`, which is
   `debounce(flushCards, 400)` (`:32`; `debounce` is `dom.js:25`). That (re)starts a 400 ms timer.
5. `:131` `redraw()` (`:117`) -> `list.setItems(cards)` (`virtualList.js:55`) -> `render()` (`:17`): works out
   which rows are on screen, and for any row not yet built calls `renderRow` (`:27-28`), which assembles DOM
   with the `h()` helper (`dom.js:7`).
6. `:132-134` scrolls the new row into view and `focus()`es its Term box, so you can type immediately.

**3. You type "ratio".** Each keystroke fires `oninput` (`deckEditor.js:51`): it writes the text onto the
card object (`card.term = ...`) and calls `edited(card)` again. The `pending` map is keyed by card id, so
it just overwrites the same entry, and `debounce` resets the timer each time (`dom.js:35-37`).

**4. 400 ms of quiet -> the save.** The timer fires `run()` (`dom.js:28`) -> `flushCards` (`deckEditor.js:27`):
copy the pending cards into `batch`, `pending.clear()`, then `Promise.all(batch.map(saveCard))`.
`saveCard` (`data/cards.js:45`) does `const db = await getDb()` and `db.put('cards', card)`.
`getDb` (`data/db.js:13`) opens the database the first time and remembers the promise in `dbPromise`
(`??=`, `:14`), so every later call reuses the same connection. `put` is "insert or overwrite by key": the
`cards` store was created with `keyPath: 'id'` (`:19`), so IndexedDB takes the key from `card.id`.
The card is now on disk.

**5. You navigate away.** `router.js:15` `await destroy?.()` runs the cleanup returned at `deckEditor.js:265`:
flush any timers (`:266-267`), save pending edits (`:268`) and delete cards left completely empty (`:269-270`).

Why this design:
- **Optimistic UI.** The row appears and takes focus *before* any database work. Otherwise fast typists could
  type into the wrong row while an `await` was pending.
- **Debounced saves.** Writing on every keystroke would be wasteful; one write after you pause is enough.
- **`order` as a number, not an array index.** Inserting between two cards changes one record, not every
  card after it.

Honest weak spots in this path:
- A fresh blank card *is* written to the database 400 ms after you create it (`edited(fresh)`). If you close
  the tab instead of navigating away, the cleanup (`:265`) never runs and the empty card stays. The study
  modes skip empty cards (`logic/studyQueue.js`), so it is harmless but untidy.
- If you close the tab within 400 ms of typing, that last bit of typing is lost; there is no
  `beforeunload` flush.
- `order` values are floats averaged repeatedly. After ~50 inserts at the *same* spot the gap runs out of
  precision. `needsRenumber` (`ordering.js:22`) exists, but nothing calls it yet.

### Four design decisions to keep in mind

1. **No backend; data lives in the browser.** Private, free to host, works offline, instant. The costs: no
   sync between devices, and clearing site data deletes your decks (hence the Backup feature).
2. **Vanilla JavaScript instead of a framework.** Tiny bundle and nothing to learn first, but *you* are
   responsible for updating the DOM when data changes (you will see `redraw()` calls everywhere). A
   framework automates that.
3. **Pure `logic/` separated from `data/` and `ui/`.** The tricky parts (scheduling, matching, parsing) are
   plain functions that are easy to test and understand.
4. **SM-2 for spaced repetition, and a hand-written service worker.** Both are "small and readable over
   powerful and opaque" choices; details in Step 2.

### Exercise (Step 1)

Without running anything, predict the `order` value of the new card in each case. The deck starts with three
cards whose orders are 1024, 2048 and 3072:
1. You press Enter in card 2. What is the new card's order?
2. Now you press Enter in that *new* card. What is the next new card's order?
3. You press Enter in card 3 (the last one).
4. You press Alt+ArrowUp on card 3 (`moveBy`, `deckEditor.js:138`). Which two `order` values does
   `orderForMove` (`ordering.js:30`) average, and what does it return?

Then check yourself by reading `tests/ordering.test.js`, or by running the app and inspecting IndexedDB in
your browser's dev tools (Application -> IndexedDB -> flashcards -> cards).
