import { describe, it, expect } from 'vitest';
import { parseText, resolveSeparator, detectTermSeparator } from '../src/logic/importParser.js';

describe('parseText', () => {
  it('parses Quizlet export (tab between term and definition, newline between cards)', () => {
    const text = 'hola\thello\r\nadiós\tgoodbye\n\n¿Cómo estás?\tHow are you?\n';
    expect(parseText(text).cards).toEqual([
      { term: 'hola', definition: 'hello' },
      { term: 'adiós', definition: 'goodbye' },
      { term: '¿Cómo estás?', definition: 'How are you?' },
    ]);
  });
  it('splits only on the first term separator', () => {
    const { cards } = parseText('ratio\ta, b\tc');
    expect(cards[0].definition).toBe('a, b\tc');
    expect(parseText('a, b, c', { termSeparator: ',' }).cards[0]).toEqual({ term: 'a', definition: 'b, c' });
  });
  it('supports multi-line definitions with a blank-line card separator', () => {
    const text = 'term one\tline1\nline2\n\nterm two\tdef two';
    const { cards } = parseText(text, { cardSeparator: '\n\n' });
    expect(cards).toEqual([
      { term: 'term one', definition: 'line1\nline2' },
      { term: 'term two', definition: 'def two' },
    ]);
  });
  it('reports skipped lines with reasons instead of dropping them silently', () => {
    const { cards, skipped } = parseText('good\tcard\nno separator here\n\tmissing term\nmissing def\t');
    expect(cards).toHaveLength(1);
    expect(skipped.map((s) => [s.line, s.reason])).toEqual([
      [2, 'no separator between term and definition'],
      [3, 'empty term'],
      [4, 'empty definition'],
    ]);
  });
  it('handles a byte-order mark and empty input', () => {
    expect(parseText('\uFEFFa\tb').cards).toHaveLength(1);
    expect(parseText('')).toEqual({ cards: [], skipped: [] });
  });
});

describe('separators', () => {
  it('turns typed escapes into characters', () => expect(resolveSeparator('\\t')).toBe('\t'));
  it('detects the separator', () => {
    expect(detectTermSeparator('a\tb')).toBe('\t');
    expect(detectTermSeparator('a - b')).toBe(' - ');
    expect(detectTermSeparator('a,b')).toBe(',');
  });
});
