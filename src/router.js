import { setTitle } from './ui/dom.js';

/**
 * Minimal hash router. A route maps a URL pattern to a "view":
 *   async (params, root) => optional destroy() function
 * The previous view's destroy() runs before the next view renders, so views can
 * remove their own listeners and flush pending saves.
 */
export function startRouter(root, routes) {
  let destroy = null;
  let navigation = 0;

  async function navigate() {
    const id = ++navigation;
    await destroy?.();
    destroy = null;
    root.replaceChildren();
    setTitle(''); // views set a more specific title

    const path = location.hash.slice(1) || '/';
    for (const [pattern, view] of routes) {
      const match = pattern.exec(path);
      if (!match) continue;
      // Optional regex groups (e.g. #/review vs #/review/:id) stay undefined instead of the string "undefined".
      const params = match.slice(1).map((part) => (part === undefined ? undefined : decodeURIComponent(part)));
      const cleanup = await view(params, root);
      // If the user navigated again while this view was loading, discard it.
      if (id !== navigation) await cleanup?.();
      else {
        destroy = cleanup ?? null;
        focusContent(root);
      }
      return;
    }
    root.textContent = 'Page not found.';
  }

  addEventListener('hashchange', navigate);
  navigate();
}

/**
 * After a page change, move keyboard/screen-reader focus to the new page's content, as a browser
 * does after a real page load. Skipped if the view already focused something (e.g. a text field).
 */
function focusContent(root) {
  if (document.activeElement && document.activeElement !== document.body) return;
  const target = root.querySelector('main') ?? root;
  target.tabIndex = -1;
  target.focus({ preventScroll: true });
}
