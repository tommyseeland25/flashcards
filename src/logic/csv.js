
/**
 * CSV (RFC 4180): fields may be quoted, quoted fields may contain delimiters, newlines and
 * doubled quotes (""). A hand-rolled state machine is ~30 lines and avoids a dependency.
 */
export function parseCsv(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); } // last line without newline
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

const needsQuotes = /[",\n\r]/;
const quote = (v) => (needsQuotes.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Serialize rows of strings. Lines end in CRLF, as the RFC (and Excel) expect. */
export function toCsv(rows) {
  return rows.map((r) => r.map((c) => quote(String(c))).join(',')).join('\r\n') + '\r\n';
}

export const CSV_HEADER = ['term', 'definition', 'starred'];

export function cardsToCsv(cards) {
  return toCsv([CSV_HEADER, ...cards.map((c) => [c.term, c.definition, c.starred ? 'true' : 'false'])]);
}

/** CSV text -> cards. Accepts an optional header row and an optional 3rd "starred" column. */
export function csvToCards(text) {
  const rows = parseCsv(text);
  const hasHeader = rows[0]?.[0]?.trim().toLowerCase() === 'term' && rows[0]?.[1]?.trim().toLowerCase() === 'definition';
  const cards = [];
  const skipped = [];
  rows.slice(hasHeader ? 1 : 0).forEach((r, i) => {
    const [term = '', definition = '', starred = ''] = r.map((c) => c.trim());
    const line = i + 1 + (hasHeader ? 1 : 0);
    if (!term || !definition) {
      skipped.push({ line, text: r.join(','), reason: term ? 'empty definition' : 'empty term' });
      return;
    }
    cards.push({ term, definition, starred: ['true', '1', 'yes'].includes(starred.toLowerCase()) });
  });
  return { cards, skipped };
}

/** Cards -> Quizlet-style text: "term<TAB>definition" per line. Tabs/newlines inside a field would break the format, so they become spaces. */
export function cardsToText(cards, { termSeparator = '\t', cardSeparator = '\n' } = {}) {
  const flat = (s) => s.replace(/[\t\r\n]+/g, ' ').trim();
  return cards.map((c) => flat(c.term) + termSeparator + flat(c.definition)).join(cardSeparator);
}

