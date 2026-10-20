import { h, setTitle } from '../dom.js';
import { toast } from '../toast.js';
import { downloadText } from '../download.js';
import { exportBackup, restoreBackup } from '../../data/backup.js';
import { validateBackup } from '../../logic/backup.js';

const today = () => new Date().toISOString().slice(0, 10);

/** Full backup and restore for everything in the app. */
export async function dataView(_params, root) {
  setTitle('Backup & restore');
  let mode = 'merge';
  let backup = null;
  const status = h('div', { class: 'preview' });
  const restoreBtn = h('button', { class: 'btn primary', disabled: true, onclick: () => restore() }, 'Restore');

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const result = validateBackup(await file.text());
    backup = result.backup ?? null;
    restoreBtn.disabled = !backup;
    const cardCount = backup?.decks.reduce((n, d) => n + d.cards.length, 0);
    status.replaceChildren(
      ...(result.errors ?? []).map((m) => h('p', { class: 'error', role: 'alert' }, m)),
      backup && h('p', {}, `Backup from ${new Date(backup.exportedAt).toLocaleString()}: ${backup.decks.length} decks, ${cardCount} cards.`),
    );
  }

  async function restore() {
    if (mode === 'replace' && !confirm('Replace ALL current decks with this backup? Decks not in the backup will be deleted.')) return;
    restoreBtn.disabled = true;
    try {
      const written = await restoreBackup(backup, mode);
      toast(`Restored ${written} deck${written === 1 ? '' : 's'}.`);
      status.replaceChildren();
    } catch (err) {
      toast(`Restore failed: ${err.message}`);
    }
    restoreBtn.disabled = false;
  }

  const radio = (value, label) =>
    h('label', { class: 'toggle' }, h('input', { type: 'radio', name: 'mode', checked: value === mode, onchange: () => { mode = value; } }), label);

  root.append(
    h('header', { class: 'topbar' }, h('a', { class: 'btn', href: '#/' }, '← Decks'), h('h1', {}, 'Backup & restore')),
    h('main', { class: 'page' },
      h('section', { class: 'panel' },
        h('h2', {}, 'Back up'),
        h('p', { class: 'muted' }, 'Downloads every deck, card and progress record as one JSON file. Your data never leaves this device unless you move the file yourself.'),
        h('button', {
          class: 'btn primary',
          onclick: async () => downloadText(`flashcards-backup-${today()}.json`, JSON.stringify(await exportBackup(), null, 2), 'application/json'),
        }, 'Download backup'),
      ),
      h('section', { class: 'panel' },
        h('h2', {}, 'Restore'),
        h('label', { class: 'btn' }, 'Choose backup file…', h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: onFile })),
        status,
        radio('merge', 'Merge: add missing decks, keep whichever copy of a deck is newer'),
        radio('replace', 'Replace: delete everything here first, then restore'),
        restoreBtn,
      ),
    ),
  );
}
