import { fitHeight } from '../logic/layout.js';

/**
 * Make a <textarea> grow and shrink to fit its text, with no inner scrollbar:
 *
 *     autoGrow(textarea);   // call once, right after creating it
 *
 * Two strategies, chosen once at load:
 *
 *  1. NATIVE: browsers that support the CSS property `field-sizing: content` size the box to its
 *     text by themselves. We only add a class (see `.autogrow-native` in components.css); no JS runs
 *     while you type. This is the cheap, robust path.
 *
 *  2. FALLBACK (older browsers, notably some iPhone Safari versions): measure the text and set an
 *     explicit height. The usual trick, `height = 'auto'` then `height = scrollHeight`, makes the box
 *     collapse for an instant, which can make the page jump and (on iOS) move the cursor. Instead we
 *     measure a hidden "ghost" copy of the textarea, so the real one is never collapsed.
 *     It re-measures when: the text changes (typing, paste, undo), it is first shown (including
 *     boxes created by an import or by opening an existing deck), and its width changes (window
 *     resize, phone rotation), because wrapping changes the number of lines.
 *
 * Minimum height and "no manual resize / no scrollbar" live in the CSS (`.autogrow`).
 */

export const supportsFieldSizing = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('field-sizing', 'content');

export function autoGrow(textarea) {
  textarea.classList.add('autogrow');
  if (supportsFieldSizing) {
    textarea.classList.add('autogrow-native');
    return;
  }
  textarea.addEventListener('input', () => fit(textarea));
  widthObserver().observe(textarea); // also handles the first size, once it is on screen
  // The caller usually attaches the textarea to the page right after creating it; this runs after
  // that but before the browser paints, so there is no flash of a wrongly sized box.
  queueMicrotask(() => fit(textarea));
}

// ---- fallback internals ----

const lastWidth = new WeakMap(); // textarea -> width we last measured at
let observer;
let ghost;

/** One shared ResizeObserver for all textareas, created on first use. */
function widthObserver() {
  observer ??= new ResizeObserver((entries) => {
    for (const { target } of entries) {
      if (!target.isConnected) observer.unobserve(target); // removed from the page (e.g. scrolled out of the list)
      // Re-fit on the NEXT frame, not inside this callback: changing the size of an observed element
      // while being notified about it makes browsers report a "ResizeObserver loop" error.
      else if (lastWidth.get(target) !== target.clientWidth) requestAnimationFrame(() => fit(target));
    }
  });
  return observer;
}

// The properties that change how many lines text wraps onto. The ghost must match all of them.
const COPIED_STYLES = [
  'boxSizing', 'width', 'borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth',
  'borderStyle', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'fontFamily', 'fontSize',
  'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing', 'textIndent', 'textTransform',
  'tabSize', 'whiteSpace', 'wordBreak', 'overflowWrap',
];

function getGhost() {
  if (!ghost) {
    ghost = document.createElement('textarea');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.tabIndex = -1;
    ghost.readOnly = true;
    Object.assign(ghost.style, {
      position: 'absolute', top: '0', left: '-9999px', visibility: 'hidden', pointerEvents: 'none',
      height: '0', minHeight: '0', overflow: 'hidden',
    });
    document.body.append(ghost);
  }
  return ghost;
}

/** Height (px) that shows all of `textarea`'s text, measured on the ghost. */
function measure(textarea) {
  const style = getComputedStyle(textarea);
  const g = getGhost();
  for (const prop of COPIED_STYLES) g.style[prop] = style[prop];
  g.value = textarea.value;
  return fitHeight({
    scrollHeight: g.scrollHeight,
    borderTop: parseFloat(style.borderTopWidth) || 0,
    borderBottom: parseFloat(style.borderBottomWidth) || 0,
    boxSizing: style.boxSizing,
  });
}

function fit(textarea) {
  if (!textarea.isConnected || textarea.clientWidth === 0) return; // not on screen yet; the observer will call us back
  lastWidth.set(textarea, textarea.clientWidth);
  const height = `${measure(textarea)}px`;
  if (textarea.style.height !== height) textarea.style.height = height; // skip no-op writes
}
