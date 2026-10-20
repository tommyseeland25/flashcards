import { h } from './dom.js';
import { grade } from '../logic/matching.js';

/*
 * Reusable question widgets for Learn and Write. Each returns { el, dispose }:
 * `el` goes into the page, and `dispose()` removes its keyboard listener. A view must call
 * dispose() before showing the next question or leaving the page.
 * `onDone(correct)` fires once, after the user has seen the feedback.
 */

const CORRECT_PAUSE_MS = 800;

function listenForKeys(handler) {
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}

/** Multiple choice. Keys 1-4 choose; Enter continues after a miss. Correct answers advance by themselves. */
export function askChoice({ options, answer, onDone }) {
  let picked = null;
  let finished = false;
  let timer = 0;
  const finish = (correct) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    onDone(correct);
  };

  const buttons = options.map((option, i) =>
    h('button', { class: 'choice', onclick: () => pick(i) }, h('kbd', {}, i + 1), h('span', {}, option)));
  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });

  function pick(i) {
    if (picked !== null) return;
    picked = i;
    const correct = options[i] === answer;
    buttons.forEach((b, j) => {
      b.disabled = true;
      b.classList.toggle('right', options[j] === answer);
      b.classList.toggle('wrong', j === i && !correct);
    });
    if (correct) {
      feedback.textContent = 'Correct!';
      timer = setTimeout(() => finish(true), CORRECT_PAUSE_MS);
    } else {
      feedback.replaceChildren(
        h('button', { class: 'btn primary', autofocus: true, onclick: () => finish(false) }, 'Continue (Enter)'));
      feedback.firstChild.focus();
    }
  }

  const dispose = listenForKeys((e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (picked === null && /^[1-9]$/.test(e.key) && Number(e.key) <= options.length) pick(Number(e.key) - 1);
    else if (picked !== null && e.key === 'Enter') {
      e.preventDefault();
      finish(options[picked] === answer);
    }
  });
  return { el: h('div', { class: 'choices' }, buttons, feedback), dispose };
}

/**
 * Typed answer with forgiving matching.
 * After a miss it shows the right answer and offers "I was right" (O) or Continue (Enter).
 */
export function askWritten({ expected, onDone }) {
  let phase = 'typing'; // 'typing' | 'feedback'
  let finished = false;
  let timer = 0;
  const finish = (correct) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    onDone(correct);
  };

  const input = h('input', {
    class: 'answer-input', placeholder: 'Type the answer', autocomplete: 'off', autocapitalize: 'off',
    spellcheck: false, 'aria-label': 'Your answer',
    onkeydown: (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation(); // don't let this same keypress also trigger "Continue" below
      if (input.value.trim() !== '') submit(input.value);
    },
  });
  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const actions = h('div', { class: 'toolbar' },
    h('button', { class: 'btn', onclick: () => submit('') }, "Don't know"));

  function submit(text) {
    phase = 'feedback';
    input.readOnly = true;
    actions.remove();
    const result = grade(text, expected);
    if (result === 'correct') {
      input.classList.add('right');
      feedback.textContent = 'Correct!';
      timer = setTimeout(() => finish(true), CORRECT_PAUSE_MS);
      return;
    }
    input.classList.add('wrong');
    const cont = h('button', { class: 'btn primary', onclick: () => finish(false) }, 'Continue (Enter)');
    feedback.replaceChildren(
      h('p', {}, result === 'close' ? 'Close! Check your spelling.' : text ? 'Not quite.' : 'The answer is:'),
      h('p', { class: 'expected' }, expected),
      h('div', { class: 'toolbar' },
        h('button', { class: 'btn', onclick: () => finish(true) }, 'I was right (O)'), cont),
    );
    cont.focus();
  }

  const dispose = listenForKeys((e) => {
    if (e.repeat || phase !== 'feedback' || e.ctrlKey || e.metaKey || e.altKey) return;
    // A focused button (e.g. "I was right" reached with Tab) handles Enter itself via its own click.
    if (e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); finish(grade(input.value, expected) === 'correct'); }
    else if (e.key === 'o' || e.key === 'O') finish(true);
  });
  queueMicrotask(() => input.focus());
  return { el: h('div', { class: 'written' }, input, actions, feedback), dispose };
}

/** A panel with a title, some content and one button; Enter presses the button. */
export function continuePanel({ title, body, label = 'Continue', secondary, onContinue }) {
  const button = h('button', { class: 'btn primary', onclick: onContinue }, `${label} (Enter)`);
  const el = h('div', { class: 'panel summary' }, h('h2', {}, title), body, h('div', { class: 'toolbar' }, button, secondary));
  queueMicrotask(() => button.focus());
  return { el, dispose: () => {} }; // the focused button already handles Enter natively
}
