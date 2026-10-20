/**
 * Fold one answer into a card's running stats.
 * `streak` is the number of correct answers in a row, reset by any miss.
 */
export function applyAnswer(stat, cardId, correct, now = Date.now()) {
  const s = stat ?? { cardId, correct: 0, incorrect: 0, lastStudied: null, streak: 0 };
  return {
    cardId,
    correct: s.correct + (correct ? 1 : 0),
    incorrect: s.incorrect + (correct ? 0 : 1),
    lastStudied: now,
    streak: correct ? s.streak + 1 : 0,
  };
}
