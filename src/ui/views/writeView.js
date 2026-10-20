import { h } from '../dom.js';
import { studyHeader, deckNotFound, usableCards } from '../studyShell.js';
import { askWritten, continuePanel, promptBlock } from '../quiz.js';
import { loadImageUrls } from '../../data/images.js';
import { getDeck } from '../../data/decks.js';
import { listCards } from '../../data/cards.js';
import { recordAnswer, recordSession } from '../../data/stats.js';
import { shuffle } from '../../logic/shuffle.js';

export async function writeView([deckId], root) {
  const deck = await getDeck(deckId);
  if (!deck) return deckNotFound(root);
  const cards = await listCards(deckId);
  root.append(studyHeader(deck, 'write'));
  const usable = usableCards(cards, deck, root);
  if (!usable) return;
  await loadImageUrls(usable);

  let queue = [];
  let index = 0;
  let missed = [];
  let correctCount = 0;
  let current = null;
  const area = h('div', { class: 'quiz-area' });
  const fill = h('div', { class: 'progress-fill' });
  const status = h('span', {});
  const show = (widget) => {
    current?.dispose();
    current = widget;
    area.replaceChildren(widget.el);
  };

  function start(cardsToAsk) {
    queue = shuffle(cardsToAsk);
    index = 0;
    missed = [];
    correctCount = 0;
    next();
  }

  function next() {
    if (index >= queue.length) return finish();
    const card = queue[index];
    fill.style.width = `${(index / queue.length) * 100}%`;
    status.textContent = `${index + 1} / ${queue.length}`;
    const widget = askWritten({
      expected: card.definition,
      onDone: (correct) => {
        recordAnswer(card.id, correct).catch(console.error);
        if (correct) correctCount++;
        else missed.push(card);
        index++;
        next();
      },
    });
    show({
      el: h('div', {}, h('p', { class: 'muted' }, 'Type the definition'), promptBlock(card.term, card.imageId), widget.el),
      dispose: widget.dispose,
    });
  }

  function finish() {
    fill.style.width = '100%';
    status.textContent = 'Done!';
    recordSession({ deckId, mode: 'write', correct: correctCount, total: queue.length }).catch(console.error);
    const retry = missed.length > 0;
    show(continuePanel({
      title: `${correctCount} / ${queue.length} correct`,
      body: retry
        ? h('div', {}, h('p', {}, 'Missed:'), h('ul', {}, missed.map((c) => h('li', {}, `${c.term} — ${c.definition}`))))
        : h('p', {}, 'Perfect round!'),
      label: retry ? 'Practice missed' : 'Go again',
      secondary: retry && h('button', { class: 'btn', onclick: () => start(usable) }, 'Restart all'),
      onContinue: () => start(retry ? missed : usable),
    }));
  }

  root.append(h('main', { class: 'page' },
    h('div', { class: 'progress' }, fill), h('div', { class: 'study-meta' }, status), area));
  start(usable);
  return () => current?.dispose();
}
