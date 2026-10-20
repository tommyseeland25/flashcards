/**
 * Parse pasted text into cards.
 *
 * Quizlet's export is: term <TAB> definition, one card per line (its defaults). Other tools
 * use commas, dashes, or blank lines between cards, so both separators are configurable.
 */

/** Typed escapes like "\t" and "\n" become the real characters (people can't type a literal Tab in a text box). */
export function resolveSeparator(input) {
  return input.replace(/\\t/g, '\t').replace(/\\n/g, '\n').replace(/\\r/g, '\r');
}

/**
 * Split `text` into cards. Returns { cards: [{term, definition}], skipped: [{line, text, reason}] }.
 * Only the FIRST term separator on a card splits it, so definitions may contain the separator
 * (e.g. "ratio, n.<TAB>a comparison, usually as a fraction").
 */
export function parseText(text, { termSeparator = '\t', cardSeparator = '\n' } = {}) {
  const cards = [];
  const skipped = [];
  if (!termSeparator || !cardSeparator) return { cards, skipped };

  const normalized = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  normalized.split(cardSeparator).forEach((chunk, i) => {
    if (chunk.trim() === '') return; // blank lines are not errors
    const at = chunk.indexOf(termSeparator);
    if (at < 0) {
      skipped.push({ line: i + 1, text: chunk, reason: 'no separator between term and definition' });
      return;
    }
    const term = chunk.slice(0, at).trim();
    const definition = chunk.slice(at + termSeparator.length).trim();
    if (!term || !definition) {
      skipped.push({ line: i + 1, text: chunk, reason: term ? 'empty definition' : 'empty term' });
      return;
    }
    cards.push({ term, definition });
  });
  return { cards, skipped };
}

/** Best guess at the term separator, used to pre-fill the setting after a paste. */
export function detectTermSeparator(text) {
  if (text.includes('\t')) return '\t';
  const sample = text.split('\n').find((l) => l.trim()) ?? '';
  if (sample.includes(' - ')) return ' - ';
  if (sample.includes(',')) return ',';
  return '\t';
}
