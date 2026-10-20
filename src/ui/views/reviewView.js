import { h, setTitle } from '../dom.js';
import { studyHeader, deckNotFound } from '../studyShell.js';
import { createFlipCard } from '../flipCard.js';
import { continuePanel } from '../quiz.js';
import { loadImageUrls, imageUrl } from '../../data/images.js';
import { speak, speakButton, stopSpeaking, langFor } from '../speech.js';
import { getDeck, listDecks } from '../../data/decks.js';
import { listCards, saveCard } from '../../data/cards.js';
import { listAllCards } from '../../data/overview.js';
import { recordAnswer, recordSession } from '../../data/stats.js';
import { schedule, previewIntervals, reviewQueue, isNew, formatInterval, startOfDay, NEW_CARDS_PER_SESSION } from '../../logic/scheduler.js';

const BUTTONS = [['again', 'Again', 1], ['hard', 'Hard', 2], ['good', 'Good', 3], ['easy', 'Easy', 4]];

/** #/review reviews every deck; #/review/:deckId reviews one. */
export async function reviewView([deckId], root) {
  const deck = deckId ? await getDeck(deckId) : null;
  if (deckId && !deck) return deckNotFound(root);
  if (!deck) setTitle('Review');
  const decksById = new Map((await listDecks()).map((d) => [d.id, d]));
  let cards = deckId ? await listCards(deckId) : await listAllCards();

  root.append(deck
    ? studyHeader(deck, 'review')
    : h('header', { class: 'topbar' }, h('a', { class: 'btn', href: '#/' }, '← Decks'), h('h1', { class: 'grow' }, 'Review all decks')));

  let queue = [];
  let total = 0; // cards in this batch, for the progress bar
  let graduated = 0; // cards finished (rated anything but Again)
  let answers = 0;
  const unsaved = new Map(); // deckId -> { correct, total }, logged as sessions on finish/leave
  let current = null;
  let stopKeys = null;

  const main = h('main', { class: 'page study' });
  root.append(main);

  async function startBatch() {
    queue = reviewQueue(cards, Date.now());
    await loadImageUrls(queue);
    total = queue.length;
    graduated = 0;
    next();
  }

  function next() {
    stopKeys?.();
    if (queue.length === 0) return finish();
    current = queue[0];
    drawCard();
  }

  function drawCard() {
    const card = current;
    const previews = previewIntervals(card);
    const rate = (rating) => rateCard(rating);
    const ratingBar = h('div', { class: 'ratings', hidden: true },
      BUTTONS.map(([rating, label, key]) =>
        h('button', { class: `btn rate ${rating}`, onclick: () => rate(rating) },
          h('kbd', {}, key), ` ${label}`, h('small', {}, previews[rating]))));
    const showBtn = h('button', { class: 'btn primary', onclick: () => flip.flip() }, 'Show answer (Space)');
    const flip = createFlipCard({ onFlip: (flipped) => { ratingBar.hidden = !flipped; showBtn.hidden = flipped; } });
    flip.set(card.term, card.definition, imageUrl(card.imageId));
    const listen = () => { const { side, text } = flip.visible(); speak(text, langFor(decksById.get(card.deckId), side)); };

    const kind = isNew(card) ? 'New' : card.lapses > 0 && card.repetitions === 0 ? 'Relearning' : 'Review';
    main.replaceChildren(
      h('div', { class: 'progress' }, h('div', { class: 'progress-fill', style: `width:${(graduated / total) * 100}%` })),
      h('div', { class: 'study-meta' }, `${queue.length} left · ${kind}`, !deckId && ` · ${decksById.get(card.deckId)?.title ?? ''}`),
      h('div', { class: 'stage' }, flip.el, speakButton(listen)),
      h('div', { class: 'controls' }, showBtn, ratingBar),
      h('p', { class: 'muted hint' }, 'Space: show answer, then Space = Good · 1 Again · 2 Hard · 3 Good · 4 Easy'),
    );

    const onKey = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input, textarea, select')) return;
      if (e.key === 'l' || e.key === 'L') listen();
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flip.flipped ? rate('good') : flip.flip();
      } else if (flip.flipped && /^[1-4]$/.test(e.key)) rate(BUTTONS[Number(e.key) - 1][0]);
    };
    document.addEventListener('keydown', onKey);
    stopKeys = () => { document.removeEventListener('keydown', onKey); stopKeys = null; };
  }

  async function rateCard(rating) {
    const card = queue.shift();
    stopKeys?.();
    const updated = { ...card, ...schedule(card, rating) };
    const index = cards.findIndex((c) => c.id === card.id);
    cards[index] = updated;

    const log = unsaved.get(card.deckId) ?? { correct: 0, total: 0 };
    log.total++;
    answers++;
    if (rating !== 'again') { log.correct++; graduated++; }
    unsaved.set(card.deckId, log);

    if (rating === 'again') queue.push(updated); // see it again before the session ends
    await Promise.all([saveCard(updated), recordAnswer(card.id, rating !== 'again')]).catch(console.error);
    next();
  }

  /** Write the session log(s). Called on finishing and when leaving early, so partial work still counts. */
  async function flushSessions() {
    const logs = [...unsaved];
    unsaved.clear();
    await Promise.all(logs.map(([id, l]) => recordSession({ deckId: id, mode: 'review', ...l }))).catch(console.error);
  }

  async function finish() {
    await flushSessions();
    const remainingNew = reviewQueue(cards, Date.now()).length;
    const upcoming = cards.filter((c) => !isNew(c) && c.dueDate > Date.now()).sort((a, b) => a.dueDate - b.dueDate)[0];
    const days = upcoming ? Math.round((startOfDay(upcoming.dueDate) - startOfDay(Date.now())) / 86400000) : null;

    const panel = continuePanel({
      title: answers ? `Session complete: ${answers} answer${answers === 1 ? '' : 's'}` : "You're all caught up",
      body: h('p', {}, remainingNew > 0
        ? `${remainingNew} more new card${remainingNew === 1 ? ' is' : 's are'} waiting (${NEW_CARDS_PER_SESSION} per batch).`
        : days === null ? 'Nothing is scheduled yet.' : `Next review ${days <= 0 ? 'later today' : `in ${formatInterval(days)}`}.`),
      label: remainingNew > 0 ? 'Keep going' : 'Back to decks',
      secondary: remainingNew > 0 && h('a', { class: 'btn', href: '#/' }, 'Back to decks'),
      onContinue: remainingNew > 0 ? startBatch : () => { location.hash = '#/'; },
    });
    main.replaceChildren(panel.el);
  }

  startBatch();
  return async () => {
    stopKeys?.();
    stopSpeaking();
    await flushSessions();
  };
}
