import { describe, it, expect } from 'vitest';
import { normalize, grade, isCorrect, acceptedAnswers, levenshtein } from '../src/logic/matching.js';

describe('normalize', () => {
  it('ignores case, whitespace and punctuation', () => {
    expect(normalize('  Hello,   WORLD! ')).toBe('hello world');
    expect(normalize('Well-Known')).toBe('well known');
  });
  it('removes apostrophes instead of splitting words', () => {
    expect(normalize("Don't")).toBe('dont');
    expect(normalize('don’t')).toBe('dont');
  });
  it('keeps symbols and accents', () => {
    expect(normalize('C++')).toBe('c++');
    expect(normalize('adiós')).not.toBe(normalize('adios'));
  });
  it('treats composed and decomposed accents as equal', () => {
    expect(normalize('é')).toBe(normalize('é'));
  });
});

describe('grade', () => {
  it('accepts forgiving matches', () => {
    expect(isCorrect('dont', "Don't!")).toBe(true);
    expect(isCorrect('THE  cat', 'the cat.')).toBe(true);
  });
  it('accepts any listed alternative and optional parentheses', () => {
    expect(isCorrect('large', 'big / large')).toBe(true);
    expect(isCorrect('automobile', 'car; automobile')).toBe(true);
    expect(isCorrect('to run', 'to run (quickly)')).toBe(true);
    expect(isCorrect('big / large', 'big / large')).toBe(true);
  });
  it('rejects wrong and empty answers', () => {
    expect(grade('dog', 'cat')).toBe('wrong');
    expect(grade('   ', 'cat')).toBe('wrong');
  });
  it('flags one-typo answers on longer words as close, not correct', () => {
    expect(grade('mitochondira', 'mitochondria')).toBe('wrong'); // two edits (transposition)
    expect(grade('mitochondrai', 'mitochondria')).toBe('wrong');
    expect(grade('mitochondia', 'mitochondria')).toBe('close');
    expect(grade('cta', 'cat')).toBe('wrong'); // too short to be lenient
  });
  it('compares raw text when the answer is only punctuation', () => {
    expect(grade('?!', '?!')).toBe('correct');
    expect(grade('?', '?!')).toBe('wrong');
  });
  it('exposes accepted variants and edit distance', () => {
    expect(acceptedAnswers('a/b')).toEqual(['a b', 'a', 'b']);
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});
