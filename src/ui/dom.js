/**
 * Tiny hyperscript helper: h('button', { class: 'btn', onclick: fn }, 'Save')
 * Props starting with "on" become event listeners; `class`, `dataset`, and
 * boolean attributes are handled; anything else is set as a DOM property or attribute.
 * Children may be strings, nodes, arrays, or null/false (ignored).
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key in el) el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat(Infinity).filter((c) => c != null && c !== false));
  return el;
}

/** Call `fn` at most once per `ms` of quiet. `.flush()` runs a pending call now. */
export function debounce(fn, ms) {
  let timer = null;
  let pendingArgs = null;
  const run = () => {
    timer = null;
    const args = pendingArgs;
    pendingArgs = null;
    if (args) fn(...args);
  };
  const debounced = (...args) => {
    pendingArgs = args;
    clearTimeout(timer);
    timer = setTimeout(run, ms);
  };
  debounced.flush = () => {
    clearTimeout(timer);
    run();
  };
  return debounced;
}

/** Set the browser tab / screen-reader page title. */
export function setTitle(text) {
  document.title = text ? `${text} · Flashcards` : 'Flashcards';
}
