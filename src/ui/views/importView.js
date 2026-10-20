import { h, setTitle } from '../dom.js';
import { toast } from '../toast.js';
import { parseText, resolveSeparator, detectTermSeparator } from '../../logic/importParser.js';
import { csvToCards } from '../../logic/csv.js';
import { validateBackup } from '../../logic/backup.js';
import { createDeckWithCards, getDeck } from '../../data/decks.js';
import { appendCards } from '../../data/cards.js';
import { importAsNewDecks } from '../../data/backup.js';

const TERM_SEPS = { '\t': 'Tab', ',': 'Comma', ' - ': 'Dash ( - )', ';': 'Semicolon', custom: 'Custom…' };
const CARD_SEPS = { '\n': 'New line', '\n\n': 'Blank line', ';': 'Semicolon', custom: 'Custom…' };
const FORMATS = { text: 'Pasted text', csv: 'CSV', json: 'JSON (Flashcards backup)' };

/** #/import creates new decks; #/import/:deckId adds the cards to an existing deck. */
export async function importView([targetId], root) {
  setTitle('Import');
  const target = targetId ? await getDeck(targetId) : null;
  const s = { format: 'text', text: '', termSep: '\t', termCustom: '', cardSep: '\n', cardCustom: '', title: '', touchedSep: false };

  const select = (options, value, onChange, label) =>
    h('select', { 'aria-label': label, onchange: (e) => onChange(e.target.value) },
      Object.entries(options).map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
  const customInput = (key, label) =>
    h('input', { placeholder: 'e.g. \\t or ::', 'aria-label': label, oninput: (e) => { s[key] = e.target.value; update(); } });

  const termCustom = customInput('termCustom', 'Custom term separator');
  const cardCustom = customInput('cardCustom', 'Custom card separator');
  const textarea = h('textarea', {
    rows: 10, 'aria-label': 'Paste your cards here', placeholder: 'Paste from Quizlet: term, then a Tab, then the definition — one card per line.',
    oninput: (e) => {
      s.text = e.target.value;
      if (s.format === 'text' && !s.touchedSep && s.termSep !== 'custom') s.termSep = detectTermSeparator(s.text);
      update();
    },
  });
  const titleInput = h('input', { placeholder: 'Deck title', 'aria-label': 'New deck title', oninput: (e) => { s.title = e.target.value; update(); } });
  const preview = h('div', { class: 'preview' });
  const importBtn = h('button', { class: 'btn primary', onclick: () => doImport() }, 'Import');
  const delimiters = h('div', { class: 'delimiters' });

  function drawDelimiters() {
    delimiters.replaceChildren(
      h('label', {}, 'Between term and definition ',
        select(TERM_SEPS, s.termSep, (v) => { s.termSep = v; s.touchedSep = true; drawDelimiters(); update(); }, 'Term separator'),
        s.termSep === 'custom' && termCustom),
      h('label', {}, 'Between cards ',
        select(CARD_SEPS, s.cardSep, (v) => { s.cardSep = v; drawDelimiters(); update(); }, 'Card separator'),
        s.cardSep === 'custom' && cardCustom),
    );
  }

  /** Run the right parser for the chosen format -> { cards, skipped, decks, errors } */
  function parse() {
    if (!s.text.trim()) return { cards: [], skipped: [], errors: [] };
    if (s.format === 'json') {
      const { backup, errors } = validateBackup(s.text);
      if (errors) return { cards: [], skipped: [], errors };
      return { cards: backup.decks.flatMap((d) => d.cards), skipped: [], decks: backup, errors: [] };
    }
    if (s.format === 'csv') return { ...csvToCards(s.text), errors: [] };
    return {
      ...parseText(s.text, {
        termSeparator: resolveSeparator(s.termSep === 'custom' ? s.termCustom : s.termSep),
        cardSeparator: resolveSeparator(s.cardSep === 'custom' ? s.cardCustom : s.cardSep),
      }),
      errors: [],
    };
  }

  let parsed = parse();
  function update() {
    parsed = parse();
    const { cards, skipped, errors, decks } = parsed;
    const n = cards.length;
    const deckCount = decks?.decks.length;
    preview.replaceChildren(
      ...errors.map((e) => h('p', { class: 'error', role: 'alert' }, e)),
      n > 0 && h('p', {}, h('strong', {}, `${n} card${n === 1 ? '' : 's'} found`),
        deckCount > 1 && !target ? ` in ${deckCount} decks` : ''),
      n > 0 && h('table', { class: 'preview-table' },
        cards.slice(0, 5).map((c) => h('tr', {}, h('td', {}, c.term), h('td', {}, c.definition))),
        n > 5 && h('tr', {}, h('td', { colSpan: 2, class: 'muted' }, `…and ${n - 5} more`))),
      skipped.length > 0 && h('details', {}, h('summary', { class: 'warn' }, `${skipped.length} line${skipped.length === 1 ? '' : 's'} skipped`),
        h('ul', {}, skipped.slice(0, 20).map((k) => h('li', {}, `Line ${k.line}: ${k.reason} — `, h('code', {}, k.text.slice(0, 60)))))),
    );
    importBtn.disabled = n === 0;
    importBtn.textContent = target ? `Add ${n} card${n === 1 ? '' : 's'}` : s.format === 'json' && deckCount > 1 ? `Import ${deckCount} decks` : `Import ${n} card${n === 1 ? '' : 's'}`;
  }

  async function doImport() {
    const { cards, decks } = parsed;
    importBtn.disabled = true;
    try {
      if (target) {
        await appendCards(target.id, cards);
        location.hash = `#/deck/${target.id}`;
      } else if (decks) {
        const created = await importAsNewDecks(decks);
        location.hash = created.length === 1 ? `#/deck/${created[0].id}` : '#/';
      } else {
        const deck = await createDeckWithCards(s.title.trim() || 'Imported deck', '', cards);
        location.hash = `#/deck/${deck.id}`;
      }
    } catch (err) {
      toast(`Import failed: ${err.message}`);
      importBtn.disabled = false;
    }
  }

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    s.format = ext === 'json' ? 'json' : ext === 'csv' ? 'csv' : 'text';
    s.text = await file.text();
    if (!s.title) s.title = file.name.replace(/\.[^.]+$/, '');
    textarea.value = s.text;
    titleInput.value = s.title;
    formatSelect.value = s.format;
    syncFormat();
    update();
  }

  const formatSelect = select(FORMATS, s.format, (v) => { s.format = v; syncFormat(); update(); }, 'Format');
  function syncFormat() {
    delimiters.hidden = s.format !== 'text';
    drawDelimiters();
  }

  root.append(
    h('header', { class: 'topbar' },
      h('a', { class: 'btn', href: target ? `#/deck/${target.id}` : '#/' }, '← Back'),
      h('h1', { class: 'grow' }, target ? `Import into "${target.title}"` : 'Import cards'),
    ),
    h('main', { class: 'page' },
      h('div', { class: 'toolbar' }, formatSelect,
        h('label', { class: 'btn' }, 'Choose file…', h('input', { type: 'file', accept: '.txt,.csv,.json,text/plain', hidden: true, onchange: onFile }))),
      textarea,
      delimiters,
      !target && h('div', { class: 'toolbar' }, titleInput),
      preview,
      h('div', { class: 'toolbar' }, importBtn),
    ),
  );
  syncFormat();
  update();
}
