import { describe, it, expect } from 'vitest';
import { parseCsv, toCsv, cardsToCsv, csvToCards, cardsToText } from '../src/logic/csv.js';
import { parseText } from '../src/logic/importParser.js';

describe('csv', () => {
  it('parses quotes, embedded commas/newlines and doubled quotes', () => {
    const rows = parseCsv('a,"b, c","say ""hi"""\r\n"line1\nline2",x\r\n');
    expect(rows).toEqual([['a', 'b, c', 'say "hi"'], ['line1\nline2', 'x']]);
  });
  it('handles a final line without newline and ignores blank lines', () => {
    expect(parseCsv('a,b\n\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });
  it('round-trips awkward cards', () => {
    const cards = [
      { term: 'plain', definition: 'text', starred: false },
      { term: 'comma, here', definition: 'quote " and\nnewline', starred: true },
    ];
    expect(csvToCards(cardsToCsv(cards)).cards).toEqual(cards);
  });
  it('accepts headerless two-column files and reports bad rows', () => {
    const { cards, skipped } = csvToCards('a,b\nonly\n');
    expect(cards).toEqual([{ term: 'a', definition: 'b', starred: false }]);
    expect(skipped[0].reason).toBe('empty definition');
  });
  it('toCsv quotes only when needed', () => expect(toCsv([['a', 'b c']])).toBe('a,b c\r\n'));
});

describe('text export', () => {
  it('round-trips through the Quizlet-style import', () => {
    const cards = [{ term: 'a', definition: 'b' }, { term: 'multi\nline', definition: 'x\ty' }];
    const text = cardsToText(cards);
    expect(parseText(text).cards).toEqual([{ term: 'a', definition: 'b' }, { term: 'multi line', definition: 'x y' }]);
  });
});
