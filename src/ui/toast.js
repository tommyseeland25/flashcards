import { h } from './dom.js';

/** Small bottom message, optionally with an action button (e.g. Undo). */
export function toast(message, { actionLabel, onAction, ms = 5000 } = {}) {
  let host = document.getElementById('toasts');
  if (!host) {
    host = h('div', { id: 'toasts', 'aria-live': 'polite' });
    document.body.append(host);
  }
  const el = h(
    'div',
    { class: 'toast' },
    h('span', {}, message),
    actionLabel &&
      h(
        'button',
        {
          class: 'btn-link',
          onclick: () => {
            onAction?.();
            el.remove();
          },
        },
        actionLabel,
      ),
  );
  host.append(el);
  setTimeout(() => el.remove(), ms);
}
