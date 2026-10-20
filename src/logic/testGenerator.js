import { shuffle } from './shuffle.js';
import { isComplete } from './studyQueue.js';
import { isCorrect, normalize } from './matching.js';

export const QUESTION_TYPES = ['choice', 'truefalse', 'written'];

/**
 * Up to `n` answer options for `card`: its definition plus distractors taken from other cards.
 * Distractors are de-duplicated and never equal to the right answer (after normalizing),
 * so there is always exactly one correct option. May return fewer than `n` for tiny decks.
 */
export function makeChoiceOptions(card, allCards, random = Math.random, n = 4) {
  const seen = new Set([normalize(card.definition)]);
  const distractors = [];
  for (const other of shuffle(allCards, random)) {
    const key = normalize(other.definition);
    if (other.id === card.id || !key || seen.has(key)) continue;
    seen.add(key);
    distractors.push(other.definition);
    if (distractors.length === n - 1) break;
  }
  return shuffle([card.definition, ...distractors], random);
}

/** A false statement for true/false: this term with a different card's definition. */
function wrongDefinition(card, allCards, random) {
  const key = normalize(card.definition);
  const others = allCards.filter((c) => c.id !== card.id && normalize(c.definition) !== key);
  return others.length ? others[Math.floor(random() * others.length)].definition : null;
}

function buildQuestion(card, type, allCards, random) {
  const base = { cardId: card.id, prompt: card.term, imageId: card.imageId ?? null, definition: card.definition };
  if (type === 'choice') {
    const options = makeChoiceOptions(card, allCards, random);
    if (options.length >= 2) return { ...base, type, answer: card.definition, options };
  }
  if (type === 'truefalse') {
    const wrong = random() < 0.5 ? wrongDefinition(card, allCards, random) : null;
    return { ...base, type, shown: wrong ?? card.definition, answer: wrong === null };
  }
  // 'written', and the fallback when a deck is too small for multiple choice.
  return { ...base, type: 'written', answer: card.definition };
}

/**
 * Build a test from `cards`. Question types are dealt out evenly (so choosing 2 types and 10
 * questions gives 5 of each), then shuffled so the order isn't predictable.
 */
export function generateTest(cards, { types = QUESTION_TYPES, count = 20, random = Math.random } = {}) {
  const usable = cards.filter(isComplete);
  const enabled = types.length ? types : ['written'];
  const picked = shuffle(usable, random).slice(0, Math.max(0, count));
  const questions = picked.map((card, i) => buildQuestion(card, enabled[i % enabled.length], usable, random));
  return shuffle(questions, random);
}

/**
 * Score a test. `responses[i]` is the option string (choice), boolean (true/false) or typed text
 * (written); missing = unanswered = wrong. `overrides` is a Set of question indexes the user
 * said they got right ("I was right" for a typed answer the matcher rejected).
 */
export function gradeTest(questions, responses, overrides = new Set()) {
  const results = questions.map((question, i) => {
    const response = responses[i];
    let correct;
    if (question.type === 'written') correct = typeof response === 'string' && isCorrect(response, question.answer);
    else correct = response === question.answer;
    const overridden = !correct && overrides.has(i);
    return { question, response, correct: correct || overridden, overridden };
  });
  const score = results.filter((r) => r.correct).length;
  const total = questions.length;
  return { results, score, total, percent: total ? Math.round((score / total) * 100) : 0 };
}
