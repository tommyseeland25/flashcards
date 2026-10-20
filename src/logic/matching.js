/**
 * Forgiving answer checking for Write, Learn and Test modes.
 *
 * Rules (so typing "Dont" for "Don't!" or "well known" for "Well-Known" isn't marked wrong):
 *  - case, extra whitespace and punctuation are ignored
 *  - apostrophes are REMOVED (don't -> dont) but other punctuation becomes a space (well-known -> well known)
 *  - symbols such as + = ° $ are kept, so "C++" is not the same as "C"
 *  - accents are kept: "adiós" vs "adios" matters when you are learning Spanish
 *  - a definition may list alternatives ("big / large", "car; automobile") and any one is accepted
 *  - text in (parentheses) is optional: "to run (quickly)" accepts "to run"
 */

const APOSTROPHES = /['’‘`´]/g;
const PUNCTUATION = /\p{P}/gu;

export function normalize(text) {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(APOSTROPHES, '')
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** All normalized strings that count as a correct answer for `expected`. */
export function acceptedAnswers(expected) {
  const withoutParens = (s) => s.replace(/\([^)]*\)/g, ' ');
  const parts = expected.split(/[;/]/);
  const candidates = [expected, withoutParens(expected), ...parts, ...parts.map(withoutParens)];
  return [...new Set(candidates.map(normalize).filter(Boolean))];
}

/** Edit distance (insert / delete / substitute), used to spot near-miss typos. */
export function levenshtein(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * 'correct' | 'close' | 'wrong'.
 * 'close' = one typo away on an answer of 5+ characters. It is NOT counted as correct,
 * but the UI can say "Close!" and offer the "I was right" override.
 */
export function grade(answer, expected) {
  const given = normalize(answer);
  const accepted = acceptedAnswers(expected);
  // An expected answer made only of punctuation (e.g. "?!") normalizes to nothing: compare raw text.
  if (accepted.length === 0) return answer.trim() === expected.trim() ? 'correct' : 'wrong';
  if (given === '') return 'wrong';
  if (accepted.includes(given)) return 'correct';
  if (accepted.some((a) => a.length >= 5 && levenshtein(given, a) <= 1)) return 'close';
  return 'wrong';
}

export const isCorrect = (answer, expected) => grade(answer, expected) === 'correct';
