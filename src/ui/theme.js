/**
 * Light / dark / system theme. The choice lives in localStorage (not IndexedDB) because it must be
 * known synchronously, before first paint; index.html applies it with a tiny inline script so
 * there is no flash of the wrong theme. "system" = no data-theme attribute, so the CSS follows
 * the OS setting via prefers-color-scheme.
 */
const KEY = 'flashcards-theme';
const ORDER = ['system', 'light', 'dark'];
export const THEME_LABELS = { system: 'System', light: 'Light', dark: 'Dark' };

export function getTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    return ORDER.includes(saved) ? saved : 'system';
  } catch {
    return 'system'; // storage blocked (private mode etc.): still works, just not remembered
  }
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = theme;
}

/** Advance system -> light -> dark -> system, apply and remember it. Returns the new theme. */
export function cycleTheme() {
  const next = ORDER[(ORDER.indexOf(getTheme()) + 1) % ORDER.length];
  applyTheme(next);
  try { localStorage.setItem(KEY, next); } catch { /* not remembered, fine */ }
  return next;
}
