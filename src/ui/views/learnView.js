import { h } from '../dom.js';
import { studyHeader, deckNotFound, usableCards } from '../studyShell.js';
import { askChoice, askWritten, continuePanel } from '../quiz.js';
import { getDeck } from '../../data/decks.js';
import { listCards } from '../../data/cards.js';
import { recordAnswer, recordSession } from '../../data/stats.js';
import { LearnSession } from '../../logic/learnEngine.js';

export async function learnView([deckId], root) {
  const deck = await getDeck(deckId);
  if (!deck) return deckNotFound(root);
  const cards = await listCards(deckId);
  root.append(studyHeader(deck, 'learn'));
  const usable = usableCards(cards, deck, root);
  if (!usable) return;

  let session;
  let current = null; // the active question widget, so it can be disposed
  const area = h('div', { class: 'quiz-area' });
  const fill = h('div', { class: 'progress-fill' });
  const status = h('span', {});
  const show = (widget) => {
    current?.dispose();
    current = widget;
    area.replaceChildren(widget.el);
  };

  function start() {
    session = new LearnSession(usable);
    next();
  }

  function next() {
    const q = session.question();
    if (!q) return finish();
    const { mastered, total, fraction } = session.progress();
    fill.style.width = `${fraction * 100}%`;
    status.textContent = `Round ${session.round} · ${mastered} / ${total} mastered`;

    const onDone = (correct) => {
      recordAnswer(q.cardId, correct).catch(console.error);
      const { roundEnded, done } = session.answer(correct);
      if (done) finish();
      else if (roundEnded) roundSummary();
      else next();
    };
    const widget = q.mode === 'choice' ? askChoice({ options: q.options, answer: q.answer, onDone }) : askWritten({ expected: q.answer, onDone });
    show({
      el: h('div', {},
        h('p', { class: 'muted' }, q.mode === 'choice' ? 'Choose the matching definition' : 'Type the definition'),
        h('div', { class: 'quiz-prompt' }, q.prompt),
        widget.el),
      dispose: widget.dispose,
    });
  }

  function roundSummary() {
    const { mastered, total, fraction } = session.progress();
    fill.style.width = `${fraction * 100}%`;
    show(continuePanel({
      title: `Round ${session.round - 1} complete`,
      body: h('p', {}, `${mastered} of ${total} terms mastered. Keep going — missed terms will come back.`),
      onContinue: next,
    }));
  }

  function finish() {
    fill.style.width = '100%';
    status.textContent = 'Done!';
    const accuracy = Math.round((session.correctAnswers / session.answers) * 100);
    recordSession({ deckId, mode: 'learn', correct: session.correctAnswers, total: session.answers }).catch(console.error);
    show(continuePanel({
      title: `All ${usable.length} terms mastered 🎉`,
      body: h('p', {}, `${session.answers} answers, ${accuracy}% correct on the first try of each question.`),
      label: 'Learn again',
      secondary: h('a', { class: 'btn', href: `#/study/${deckId}` }, 'Back to flashcards'),
      onContinue: start,
    }));
  }

  root.append(h('main', { class: 'page' },
    h('div', { class: 'progress' }, fill), h('div', { class: 'study-meta' }, status), area));
  start();
  return () => current?.dispose();
}
