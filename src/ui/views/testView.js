import { h } from '../dom.js';
import { studyHeader, deckNotFound, usableCards } from '../studyShell.js';
import { getDeck } from '../../data/decks.js';
import { listCards } from '../../data/cards.js';
import { recordAnswer, recordSession } from '../../data/stats.js';
import { generateTest, gradeTest, QUESTION_TYPES } from '../../logic/testGenerator.js';

const TYPE_LABELS = { choice: 'Multiple choice', truefalse: 'True / false', written: 'Written' };

export async function testView([deckId], root) {
  const deck = await getDeck(deckId);
  if (!deck) return deckNotFound(root);
  const cards = await listCards(deckId);
  root.append(studyHeader(deck, 'test'));
  const usable = usableCards(cards, deck, root);
  if (!usable) return;

  const main = h('main', { class: 'page' });
  root.append(main);
  const settings = { types: new Set(QUESTION_TYPES), count: Math.min(20, usable.length) };

  // ---- 1. setup ----
  function showSetup() {
    const countInput = h('input', {
      type: 'number', min: 1, max: usable.length, value: settings.count, 'aria-label': 'Number of questions',
      onchange: (e) => { settings.count = Math.max(1, Math.min(usable.length, Number(e.target.value) || 1)); e.target.value = settings.count; },
    });
    const startBtn = h('button', { class: 'btn primary', type: 'submit' }, 'Start test');
    main.replaceChildren(h('form', {
      class: 'panel',
      onsubmit: (e) => { e.preventDefault(); showTest(generateTest(usable, { types: [...settings.types], count: settings.count })); },
    },
      h('h2', {}, 'Create a test'),
      h('fieldset', { class: 'plain' }, h('legend', {}, 'Question types'),
        QUESTION_TYPES.map((t) => h('label', { class: 'toggle' },
          h('input', {
            type: 'checkbox', checked: settings.types.has(t),
            onchange: (e) => { e.target.checked ? settings.types.add(t) : settings.types.delete(t); startBtn.disabled = settings.types.size === 0; },
          }), TYPE_LABELS[t]))),
      h('label', {}, `Questions (max ${usable.length}) `, countInput),
      startBtn,
    ));
    countInput.focus();
  }

  // ---- 2. taking the test: one page, native radios/inputs so Tab, arrows and Enter just work ----
  function showTest(questions) {
    const form = h('form', {
      class: 'test-form',
      onsubmit: (e) => { e.preventDefault(); submit(questions, readResponses(questions, new FormData(form))); },
    },
      h('h2', {}, `Test · ${questions.length} questions`),
      questions.map(renderQuestion),
      h('div', { class: 'toolbar' }, h('button', { class: 'btn primary', type: 'submit' }, 'Check answers')),
    );
    main.replaceChildren(form);
    window.scrollTo(0, 0);
  }

  function renderQuestion(q, i) {
    const name = `q${i}`;
    const radio = (value, label) => h('label', { class: 'option' }, h('input', { type: 'radio', name, value }), h('span', {}, label));
    let body;
    if (q.type === 'choice') body = q.options.map((o, k) => radio(String(k), o));
    else if (q.type === 'truefalse') body = [radio('true', 'True'), radio('false', 'False')];
    else body = h('input', { name, class: 'answer-input', autocomplete: 'off', 'aria-label': 'Your answer', placeholder: 'Type the definition' });

    return h('fieldset', { class: 'question' },
      h('legend', {}, `${i + 1}. `, q.type === 'truefalse' ? 'True or false: this term and definition go together' : q.type === 'choice' ? 'Choose the definition' : 'Write the definition'),
      h('div', { class: 'quiz-prompt small' }, q.prompt),
      q.type === 'truefalse' && h('div', { class: 'statement' }, q.shown),
      body,
    );
  }

  /** Turn form values into the response shapes gradeTest expects. */
  function readResponses(questions, data) {
    return questions.map((q, i) => {
      const value = data.get(`q${i}`);
      if (value === null || value === '') return undefined;
      if (q.type === 'choice') return q.options[Number(value)];
      if (q.type === 'truefalse') return value === 'true';
      return value;
    });
  }

  // ---- 3. results ----
  function submit(questions, responses) {
    const overrides = new Set();
    const first = gradeTest(questions, responses);
    // Stats are recorded once, from the automatic grading (later "I was right" overrides don't change them).
    first.results.forEach((r) => recordAnswer(r.question.cardId, r.correct).catch(console.error));
    recordSession({ deckId, mode: 'test', correct: first.score, total: first.total }).catch(console.error);

    const draw = () => {
      const graded = gradeTest(questions, responses, overrides);
      const problems = graded.results.map((r, i) => ({ ...r, i })).filter((r) => !r.correct || r.overridden);
      main.replaceChildren(
        h('div', { class: 'panel summary' },
          h('h2', {}, 'Results'),
          h('p', { class: 'score', 'aria-live': 'polite' }, `${graded.score} / ${graded.total} (${graded.percent}%)`),
          h('div', { class: 'toolbar' },
            h('button', { class: 'btn primary', onclick: () => showTest(generateTest(usable, { types: [...settings.types], count: settings.count })) }, 'New test'),
            h('button', { class: 'btn', onclick: showSetup }, 'Change settings')),
        ),
        problems.length ? h('h2', {}, 'Review missed questions') : h('p', { class: 'empty' }, 'No mistakes — nice work!'),
        ...problems.map((r) => reviewItem(r, draw, overrides)),
      );
      window.scrollTo(0, 0);
    };
    draw();
  }

  function reviewItem({ question: q, response, i, overridden }, redraw, overrides) {
    const shown = response === undefined ? '(no answer)' : q.type === 'truefalse' ? (response ? 'True' : 'False') : response;
    const expected = q.type === 'truefalse' ? `${q.answer ? 'True' : 'False'} — the definition is “${q.definition}”` : q.answer;
    return h('div', { class: `review ${overridden ? 'overridden' : ''}` },
      h('div', { class: 'quiz-prompt small' }, `${i + 1}. ${q.prompt}`),
      q.type === 'truefalse' && h('div', { class: 'statement' }, q.shown),
      h('p', {}, h('span', { class: 'muted' }, 'Your answer: '), shown),
      h('p', {}, h('span', { class: 'muted' }, 'Correct answer: '), expected),
      q.type === 'written' && h('button', {
        class: 'btn', onclick: () => { overrides.has(i) ? overrides.delete(i) : overrides.add(i); redraw(); },
      }, overridden ? 'Undo: I was wrong' : 'I was right'),
    );
  }

  showSetup();
}
