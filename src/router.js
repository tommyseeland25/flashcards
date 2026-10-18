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

    const path = location.hash.slice(1) || '/';
    for (const [pattern, view] of routes) {
      const match = pattern.exec(path);
      if (!match) continue;
      const cleanup = await view(match.slice(1).map(decodeURIComponent), root);
      // If the user navigated again while this view was loading, discard it.
      if (id !== navigation) await cleanup?.();
      else destroy = cleanup ?? null;
      return;
    }
    root.textContent = 'Page not found.';
  }

  addEventListener('hashchange', navigate);
  navigate();
}
