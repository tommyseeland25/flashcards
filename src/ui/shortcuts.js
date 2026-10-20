import { h } from './dom.js';

const SECTIONS = [
  ['Everywhere', [['?', 'Show this help'], ['Tab / Shift+Tab', 'Move between controls']]],
  ['Card editor', [
    ['Tab', 'Term → definition → next card'],
    ['Enter', 'New card below'],
    ['Shift+Enter', 'New line inside a term or definition'],
    ['Alt+↑ / Alt+↓', 'Move the card up or down'],
  ]],
  ['Flashcards', [
    ['Space, Enter, ↑, ↓', 'Flip the card'], ['← / →', 'Previous / next card'],
    ['S', 'Star or unstar'], ['L', 'Listen (text to speech)'],
  ]],
  ['Review', [
    ['Space', 'Show answer, then rate Good'], ['1 / 2 / 3 / 4', 'Again / Hard / Good / Easy'], ['L', 'Listen'],
  ]],
  ['Learn and Write', [
    ['1 – 4', 'Pick a multiple-choice option'], ['Enter', 'Submit your answer, then continue'], ['O', '“I was right” after a miss'],
  ]],
  ['Test and Match', [['Tab, arrows, Enter, Space', 'Choose answers and select tiles']]],
];

let dialog;

function build() {
  const close = h('button', { class: 'btn', onclick: () => dialog.close() }, 'Close (Esc)');
  dialog = h('dialog', { class: 'shortcuts', 'aria-labelledby': 'shortcuts-title' },
    h('h2', { id: 'shortcuts-title' }, 'Keyboard shortcuts'),
    SECTIONS.map(([title, rows]) => h('section', {},
      h('h3', {}, title),
      h('dl', {}, rows.map(([keys, what]) => [h('dt', {}, h('kbd', {}, keys)), h('dd', {}, what)])))),
    close);
  // Keys pressed inside the dialog shouldn't reach a study view behind it (Space would flip a card).
  dialog.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // click on the backdrop
  document.body.append(dialog);
}

export function showShortcuts() {
  if (!dialog) build();
  if (!dialog.open) dialog.showModal();
}

/** Press "?" anywhere (outside a text field) to open the help. */
export function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    dialog?.open ? dialog.close() : showShortcuts();
  });
}
