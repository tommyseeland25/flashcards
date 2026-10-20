import { h, debounce, setTitle } from '../dom.js';
import { createVirtualList } from '../virtualList.js';
import { toast } from '../toast.js';
import { downloadText, slug } from '../download.js';
import { cardsToCsv, cardsToText } from '../../logic/csv.js';
import { exportBackup } from '../../data/backup.js';
import { saveImage, loadImageUrls, imageUrl } from '../../data/images.js';
import { shrinkImage } from '../imageTools.js';
import { getDeck, updateDeck } from '../../data/decks.js';
import { listCards, addCard, newCardAfter, saveCard, deleteCard, moveCard } from '../../data/cards.js';

const ROW_HEIGHT = 64; // fits a two-line textarea; the virtual list needs fixed-height rows

export async function deckEditorView([deckId], root) {
  let deck = await getDeck(deckId);
  if (!deck) {
    root.append(h('p', { class: 'page' }, 'Deck not found. ', h('a', { href: '#/' }, 'Back to decks')));
    return;
  }
  setTitle(`Edit: ${deck.title}`);
  let cards = await listCards(deckId);
  if (cards.length === 0) cards = [await addCard(deckId, [])];
  await loadImageUrls(cards);

  // ---- saving: edits are written ~400ms after typing stops, and flushed on leave ----
  const pending = new Map(); // card.id -> card
  const flushCards = async () => {
    const batch = [...pending.values()];
    pending.clear();
    await Promise.all(batch.map(saveCard));
  };
  const queueSave = debounce(flushCards, 400);
  const edited = (card) => { pending.set(card.id, card); queueSave(); };

  const saveDeck = debounce(async () => { deck = await updateDeck(deck); }, 400);

  // ---- list ----
  const list = createVirtualList({ rowHeight: ROW_HEIGHT, renderRow, className: 'editor-list' });
  const dropLine = h('div', { class: 'drop-line', hidden: true });
  list.content.append(dropLine);
  const count = h('span', { class: 'muted' });
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite' }); // announcements for screen readers
  const announce = (text) => { live.textContent = text; };

  function renderRow(card) {
    // A textarea (not an input) so multi-line cards keep their line breaks when edited.
    // Enter adds a card; Shift+Enter inserts a new line; Alt+Up/Down moves the card.
    const field = (name, label) =>
      h('textarea', {
        value: card[name], placeholder: label, 'aria-label': label, class: 'cell', rows: 2,
        oninput: (e) => { card[name] = e.target.value; edited(card); },
        onkeydown: (e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); insertAfter(card); }
          else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault();
            moveBy(card, e.key === 'ArrowUp' ? -1 : 1, label);
          }
        },
      });

    const star = h('button', {
      class: `icon-btn star ${card.starred ? 'on' : ''}`, title: 'Star', 'aria-pressed': card.starred,
      'aria-label': 'Star card',
      onclick: () => {
        card.starred = !card.starred;
        star.classList.toggle('on', card.starred);
        star.textContent = card.starred ? '★' : '☆';
        star.setAttribute('aria-pressed', card.starred);
        edited(card);
      },
    }, card.starred ? '★' : '☆');

    // Picture button: empty -> opens the file picker; with a picture -> shows a thumbnail, click removes it.
    const picker = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: (e) => attach(e.target.files[0]) });
    const imageBtn = h('button', { class: 'icon-btn image-btn', onclick: () => (card.imageId ? detach() : picker.click()) });
    const drawImageBtn = () => {
      const src = imageUrl(card.imageId);
      imageBtn.replaceChildren(src ? h('img', { class: 'thumb', src, alt: '' }) : '🖼');
      imageBtn.setAttribute('aria-label', src ? 'Remove picture from this card' : 'Add a picture to this card');
      imageBtn.title = src ? 'Remove picture' : 'Add picture';
    };
    async function attach(file) {
      if (!file) return;
      try {
        card.imageId = await saveImage(await shrinkImage(file));
        edited(card);
        drawImageBtn();
      } catch (err) {
        toast(err.message);
      }
      picker.value = '';
    }
    function detach() {
      if (!confirm('Remove the picture from this card?')) return;
      card.imageId = null;
      edited(card);
      drawImageBtn();
    }
    drawImageBtn();

    return h('div', { class: 'card-row' },
      h('span', { class: 'handle', title: 'Drag to reorder (or Alt+↑/↓ in a field)', 'aria-hidden': 'true', onpointerdown: (e) => startDrag(e, card) }, '⋮⋮'),
      h('span', { class: 'row-num' }, ''),
      field('term', 'Term'),
      field('definition', 'Definition'),
      imageBtn, picker,
      star,
      h('button', { class: 'icon-btn', title: 'Delete card', 'aria-label': 'Delete card', onclick: () => remove(card) }, '✕'),
    );
  }

  const numberRows = () => {
    for (const row of list.content.querySelectorAll('.vlist-row')) {
      row.querySelector('.row-num').textContent = Number(row.dataset.index) + 1;
    }
  };
  const redraw = () => {
    list.setItems(cards);
    numberRows();
    count.textContent = `${cards.length} cards`;
  };
  list.el.addEventListener('scroll', () => requestAnimationFrame(numberRows), { passive: true });

  // Optimistic: the row appears and takes focus at once; the write happens in the background,
  // so fast typists never type into the wrong row.
  function insertAfter(card) {
    const index = cards.indexOf(card);
    const fresh = newCardAfter(deckId, cards, index);
    cards.splice(index + 1, 0, fresh);
    edited(fresh);
    redraw();
    list.scrollToIndex(index + 1);
    numberRows();
    list.rowFor(fresh.id)?.querySelector('textarea').focus();
  }

  /** Keyboard reorder: Alt+Up / Alt+Down in a field. Focus stays on the same field of the same card. */
  async function moveBy(card, delta, fieldLabel) {
    const from = cards.indexOf(card);
    const to = from + delta;
    if (to < 0 || to >= cards.length) return;
    const saving = moveCard(cards, from, to); // sets the new order synchronously, then saves
    cards.splice(from, 1);
    cards.splice(to, 0, card);
    redraw();
    list.scrollToIndex(to);
    numberRows();
    list.rowFor(card.id)?.querySelector(`[aria-label="${fieldLabel}"]`)?.focus();
    announce(`Card moved to position ${to + 1} of ${cards.length}`);
    await saving;
  }

  async function remove(card) {
    const index = cards.indexOf(card);
    pending.delete(card.id);
    await deleteCard(card.id);
    cards.splice(index, 1);
    redraw();
    toast('Card deleted', {
      actionLabel: 'Undo',
      onAction: async () => {
        await saveCard(card);
        cards = (await listCards(deckId));
        redraw();
      },
    });
  }

  // ---- drag to reorder (pointer events, so it works with touch too) ----
  function startDrag(e, card) {
    e.preventDefault();
    const from = cards.indexOf(card);
    let to = from;
    let lastY = e.clientY;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    dropLine.hidden = false;

    const autoScroll = () => {
      const rect = list.el.getBoundingClientRect();
      if (lastY < rect.top + 40) list.el.scrollTop -= 12;
      else if (lastY > rect.bottom - 40) list.el.scrollTop += 12;
      showLine();
      raf = requestAnimationFrame(autoScroll);
    };
    // Line sits above the target row when moving up, below it when moving down.
    const showLine = () => {
      to = list.indexAtClientY(lastY);
      dropLine.style.transform = `translateY(${(to > from ? to + 1 : to) * ROW_HEIGHT}px)`;
    };
    let raf = requestAnimationFrame(autoScroll);

    const move = (ev) => { lastY = ev.clientY; };
    const finish = async () => {
      cancelAnimationFrame(raf);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      dropLine.hidden = true;
      if (to === from) return;
      const moved = await moveCard(cards, from, to);
      cards.splice(from, 1);
      cards.splice(to, 0, moved);
      redraw();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
  }

  // ---- header fields ----
  const textField = (label, key, placeholder, extra = {}) =>
    h('input', {
      value: Array.isArray(deck[key]) ? deck[key].join(', ') : deck[key], placeholder, 'aria-label': label,
      class: `deck-${key}`, ...extra,
      oninput: (e) => {
        deck[key] = key === 'tags' ? e.target.value.split(',').map((t) => t.trim()).filter(Boolean) : e.target.value;
        saveDeck();
      },
    });

  const filled = () => cards.filter((c) => c.term.trim() || c.definition.trim());
  const exportButton = (label, ext, mime, makeText) =>
    h('button', { class: 'btn', onclick: async () => downloadText(`${slug(deck.title)}.${ext}`, await makeText(), mime) }, label);

  root.append(
    h('header', { class: 'topbar' },
      h('a', { class: 'btn', href: '#/' }, '← Decks'),
      h('div', { class: 'spacer' }),
      count,
      h('a', { class: 'btn primary', href: `#/study/${deckId}` }, 'Study'),
    ),
    h('main', { class: 'page editor' },
      textField('Deck title', 'title', 'Deck title'),
      textField('Description', 'description', 'Description (optional)'),
      textField('Tags', 'tags', 'Tags, comma separated'),
      h('div', { class: 'toolbar' },
        textField('Term language for text to speech', 'termLang', 'Term language (e.g. es-ES)', { list: 'speech-langs' }),
        textField('Definition language for text to speech', 'definitionLang', 'Definition language (e.g. en-US)', { list: 'speech-langs' }),
        h('datalist', { id: 'speech-langs' },
          ['en-US', 'en-GB', 'es-ES', 'es-MX', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'nl-NL', 'ja-JP', 'zh-CN', 'ko-KR', 'ru-RU', 'ar-SA', 'hi-IN']
            .map((code) => h('option', { value: code })))),
      list.el,
      live,
      h('button', { class: 'btn', onclick: () => insertAfter(cards[cards.length - 1]) }, '+ Add card'),
      h('div', { class: 'toolbar export-bar' },
        h('a', { class: 'btn', href: `#/import/${deckId}` }, 'Import cards…'),
        h('span', { class: 'grow' }),
        h('span', { class: 'muted' }, 'Export:'),
        exportButton('Text', 'txt', 'text/plain', () => cardsToText(filled())),
        exportButton('CSV', 'csv', 'text/csv', () => cardsToCsv(filled())),
        exportButton('JSON', 'json', 'application/json', async () => {
          queueSave.flush(); saveDeck.flush(); await flushCards(); // include edits typed a moment ago
          return JSON.stringify(await exportBackup([deckId]), null, 2); // via the data layer: includes pictures
        }),
      ),
      h('p', { class: 'muted hint' }, 'Tab: term → definition · Enter: new card · Shift+Enter: new line · Alt+↑/↓ or drag ⋮⋮ to reorder'),
    ),
  );
  redraw();
  if (cards.length === 1 && !cards[0].term) list.rowFor(cards[0].id)?.querySelector('textarea').focus();

  // Runs when navigating away: save everything, drop cards left completely empty.
  return async () => {
    saveDeck.flush();
    queueSave.flush();
    await flushCards();
    const blanks = cards.filter((c) => !c.term.trim() && !c.definition.trim());
    if (blanks.length < cards.length) await Promise.all(blanks.map((c) => deleteCard(c.id)));
  };
}

