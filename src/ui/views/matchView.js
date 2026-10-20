import { h } from '../dom.js';
import { studyHeader, deckNotFound, usableCards } from '../studyShell.js';
import { getDeck } from '../../data/decks.js';
import { listCards } from '../../data/cards.js';
import { getMeta, setMeta, recordSession } from '../../data/stats.js';
import { pickPairs, buildTiles, isMatch, isNewBest, formatTime } from '../../logic/matchGame.js';

const WRONG_FLASH_MS = 500;

export async function matchView([deckId], root) {
  const deck = await getDeck(deckId);
  if (!deck) return deckNotFound(root);
  const cards = await listCards(deckId);
  root.append(studyHeader(deck, 'match'));
  const usable = usableCards(cards, deck, root, 2);
  if (!usable) return;

  // How many distinct pairs the deck can supply (duplicates are skipped), and the sizes we offer.
  const available = pickPairs(usable, Infinity).length;
  const sizes = [4, 6, 8, 12].filter((n) => n <= available);
  if (!sizes.length) sizes.push(available);
  let pairCount = sizes.includes(6) ? 6 : sizes[sizes.length - 1];

  let tiles, selected, matched, mistakes, startedAt, timerId, locked, best;
  const timeEl = h('span', { class: 'timer', 'aria-label': 'Elapsed time' }, '0:00.0');
  const bestEl = h('span', { class: 'muted' });
  const grid = h('div', { class: 'tiles' });
  const result = h('div', { hidden: true });

  async function newGame() {
    clearInterval(timerId);
    tiles = buildTiles(pickPairs(usable, pairCount));
    selected = null;
    matched = new Set();
    mistakes = 0;
    startedAt = null;
    locked = false;
    timeEl.textContent = '0:00.0';
    result.hidden = true;
    best = await getMeta(`matchBest:${deckId}:${pairCount}`);
    bestEl.textContent = best == null ? 'No best time yet' : `Best: ${formatTime(best)}`;
    drawTiles();
  }

  function drawTiles() {
    grid.replaceChildren(...tiles.map((t) => h('button', {
      class: `tile ${matched.has(t.pairId) ? 'matched' : ''} ${selected?.id === t.id ? 'selected' : ''}`,
      dataset: { id: t.id }, disabled: matched.has(t.pairId), 'aria-pressed': selected?.id === t.id,
      onclick: () => click(t),
    }, t.text)));
  }

  const tileEl = (t) => grid.querySelector(`[data-id="${CSS.escape(t.id)}"]`);

  function click(tile) {
    if (locked || matched.has(tile.pairId)) return;
    if (startedAt === null) {
      startedAt = performance.now();
      timerId = setInterval(() => { timeEl.textContent = formatTime(performance.now() - startedAt); }, 100);
    }
    if (!selected) { selected = tile; return drawTilesKeepingFocus(tile); }
    if (selected.id === tile.id) { selected = null; return drawTilesKeepingFocus(tile); }

    if (isMatch(selected, tile)) {
      matched.add(tile.pairId);
      selected = null;
      drawTiles();
      if (matched.size === tiles.length / 2) finish();
    } else {
      mistakes++;
      locked = true;
      const pair = [selected, tile];
      pair.forEach((t) => tileEl(t).classList.add('miss'));
      selected = null;
      setTimeout(() => { locked = false; drawTilesKeepingFocus(tile); }, WRONG_FLASH_MS);
    }
  }

  /** Redraw but keep keyboard focus on the tile the user just used. */
  function drawTilesKeepingFocus(tile) {
    drawTiles();
    tileEl(tile)?.focus();
  }

  async function finish() {
    clearInterval(timerId);
    const time = performance.now() - startedAt;
    timeEl.textContent = formatTime(time);
    const record = isNewBest(time, best);
    if (record) await setMeta(`matchBest:${deckId}:${pairCount}`, Math.round(time));
    recordSession({ deckId, mode: 'match', correct: tiles.length / 2, total: tiles.length / 2 + mistakes }).catch(console.error);
    result.hidden = false;
    result.replaceChildren(h('div', { class: 'panel summary' },
      h('h2', {}, record ? '🏆 New best time!' : 'Matched them all!'),
      h('p', {}, `${formatTime(time)} with ${mistakes} mistake${mistakes === 1 ? '' : 's'}.`,
        !record && best != null ? ` Best: ${formatTime(best)}.` : ''),
      h('button', { class: 'btn primary', onclick: newGame }, 'Play again'),
    ));
    result.querySelector('button').focus();
  }

  root.append(h('main', { class: 'page' },
    h('div', { class: 'toolbar match-bar' },
      timeEl, bestEl, h('span', { class: 'grow' }),
      sizes.length > 1 && h('label', {}, 'Pairs ',
        h('select', {
          'aria-label': 'Number of pairs',
          onchange: (e) => { pairCount = Number(e.target.value); newGame(); },
        }, sizes.map((n) => h('option', { value: n, selected: n === pairCount }, n)))),
      h('button', { class: 'btn', onclick: newGame }, 'Restart')),
    h('p', { class: 'muted hint' }, 'Click a term, then its definition. Tab and Enter work too. The clock starts on your first click.'),
    result,
    grid,
  ));
  await newGame();
  return () => clearInterval(timerId);
}
