import { shuffle } from './shuffle.js';
import { isComplete } from './studyQueue.js';
import { makeChoiceOptions } from './testGenerator.js';

/**
 * Learn mode: adaptive rounds that repeat missed cards until mastered.
 *
 * Each card has a level 0..target.
 *  - correct answer: level + 1 (reaching `target` = mastered)
 *  - wrong answer:   level back to 0, and the card comes back a few questions later in the SAME round
 * Level 0 cards are asked as multiple choice (recognition, easier); higher levels are typed
 * (recall, harder). With target 2 a card is mastered after one correct choice and one correct typed answer.
 *
 * A round is up to `roundSize` unmastered cards. When the round's queue empties, the next round
 * starts with whatever is still unmastered; when nothing is left, the session is done.
 * No DOM, no storage: the view just asks "what is the question?" and reports "right/wrong".
 */
const RETRY_GAP = 3;

export class LearnSession {
  constructor(cards, { roundSize = 7, target = 2, random = Math.random } = {}) {
    this.cards = cards.filter(isComplete);
    this.roundSize = roundSize;
    this.target = target;
    this.random = random;
    this.levels = new Map(this.cards.map((c) => [c.id, 0]));
    this.round = 0;
    this.answers = 0;
    this.correctAnswers = 0;
    this.queue = [];
    this.cachedQuestion = null;
    this.#startRound();
  }

  #startRound() {
    const open = this.cards.filter((c) => this.levels.get(c.id) < this.target);
    this.queue = shuffle(open, this.random).slice(0, this.roundSize);
    this.round += this.queue.length ? 1 : 0;
  }

  get done() {
    return this.queue.length === 0;
  }

  /** The current question, or null when finished. Stable until `answer()` is called. */
  question() {
    const card = this.queue[0];
    if (!card) return null;
    if (this.cachedQuestion?.cardId !== card.id) {
      const canChoose = this.cards.length >= 2;
      const mode = this.levels.get(card.id) === 0 && canChoose ? 'choice' : 'write';
      this.cachedQuestion = {
        cardId: card.id,
        mode,
        prompt: card.term,
        answer: card.definition,
        options: mode === 'choice' ? makeChoiceOptions(card, this.cards, this.random) : null,
      };
    }
    return this.cachedQuestion;
  }

  /** Record the result for the current question. Returns { roundEnded, done }. */
  answer(correct) {
    const card = this.queue.shift();
    this.cachedQuestion = null;
    this.answers++;
    if (correct) {
      this.correctAnswers++;
      this.levels.set(card.id, Math.min(this.target, this.levels.get(card.id) + 1));
    } else {
      this.levels.set(card.id, 0);
      // Not straight away (it would just be answered from short-term memory), but soon.
      this.queue.splice(Math.min(RETRY_GAP, this.queue.length), 0, card);
    }
    const roundEnded = this.queue.length === 0;
    if (roundEnded) this.#startRound();
    return { roundEnded, done: this.done };
  }

  /** `fraction` counts partial credit (a card at level 1 is half done) so the bar moves smoothly. */
  progress() {
    const total = this.cards.length;
    let points = 0;
    let mastered = 0;
    for (const level of this.levels.values()) {
      points += level;
      if (level >= this.target) mastered++;
    }
    return { mastered, total, fraction: total ? points / (total * this.target) : 1 };
  }
}
