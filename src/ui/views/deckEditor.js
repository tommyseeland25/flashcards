import { h, debounce } from '../dom.js';
import { createVirtualList } from '../virtualList.js';
import { toast } from '../toast.js';
import { getDeck, updateDeck } from '../../data/decks.js';
import { listCards, addCard, newCardAfter, saveCard, deleteCard, moveCard } from '../../data/cards.js';

const ROW_HEIGHT = 60;

export async function deckEditorView([deckId], root) {
  let deck = await getDeck(deckId);
  if (!deck) {
    root.append(h('p', { class: 'page' }, 'Deck not found. ', h('a', { href: '#/' }, 'Back to decks')));
    return;
  }
  let cards = await listCards(deckId);
  if (cards.length === 0) cards = [await addCard(deckId, [])];

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

  function renderRow(card) {
    const field = (name, label) =>
      h('input', {
        value: card[name], placeholder: label, 'aria-label': label, class: 'cell',
        oninput: (e) => { card[name] = e.target.value; edited(card); },
        onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); insertAfter(card); } },
      });

    const star = h('button', {
      class: `icon-btn star ${card.starred ? 'on' : ''}`, title: 'Star', 'aria-pressed': card.starred,
      'aria-label': 'Star card',
      onclick: () => {
        card.starred = !card.starred;
        star.classList.toggle('on', card.starred);
        star.setAttribute('aria-pressed', card.starred);
        edited(card);
      },
    }, '★');

    return h('div', { class: 'card-row' },
      h('span', { class: 'handle', title: 'Drag to reorder', onpointerdown: (e) => startDrag(e, card) }, '⋮⋮'),
      h('span', { class: 'row-num' }, ''),
      field('term', 'Term'),
      field('definition', 'Definition'),
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
    list.rowFor(fresh.id)?.querySelector('input').focus();
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
  const textField = (label, key, placeholder) =>
    h('input', {
      value: Array.isArray(deck[key]) ? deck[key].join(', ') : deck[key], placeholder, 'aria-label': label,
      class: `deck-${key}`,
      oninput: (e) => {
        deck[key] = key === 'tags' ? e.target.value.split(',').map((t) => t.trim()).filter(Boolean) : e.target.value;
        saveDeck();
      },
    });

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
      list.el,
      h('button', { class: 'btn', onclick: () => insertAfter(cards[cards.length - 1]) }, '+ Add card'),
      h('p', { class: 'muted hint' }, 'Tab: term → definition · Enter: new card below · Drag ⋮⋮ to reorder'),
    ),
  );
  redraw();
  if (cards.length === 1 && !cards[0].term) list.rowFor(cards[0].id)?.querySelector('input').focus();

  // Runs when navigating away: save everything, drop cards left completely empty.
  return async () => {
    saveDeck.flush();
    queueSave.flush();
    await flushCards();
    const blanks = cards.filter((c) => !c.term.trim() && !c.definition.trim());
    if (blanks.length < cards.length) await Promise.all(blanks.map((c) => deleteCard(c.id)));
  };
}

