// Puzzles made from your own mistakes. Edit to tune.

export const MISTAKE_PUZZLES = {
  /** Which of your move ratings become puzzles. */
  ratings: ['mistake', 'blunder'] as const,
  /**
   * Only mistakes that mattered: skip moves made when you were already clearly lost (your
   * winning chances at or below this before the move)...
   */
  minWinBefore: 15,
  /** ...or when you were still clearly winning afterwards. */
  maxWinAfter: 85,
  /** At most this many puzzles per game: the costliest mistakes. */
  perGame: 3,
  /** Today's set: this many positions a day, from your most common patterns first. */
  dailyLimit: 5,
  /** Positions in one "Solve" set for a pattern. */
  patternSet: 5,
  /** Pattern counts on the list cover this many days. */
  patternWindowDays: 60,
  /** A pattern shows as "improving" when this share of its positions is in box 2 or higher. */
  improvingShare: 0.6,
  /**
   * Spaced repetition: after a clean solve, a puzzle moves up a box and comes back after this
   * many days (box 1 = 1 day, box 2 = 3 days, ...). Solving it cleanly from the last box
   * marks it as mastered.
   */
  intervalsDays: [1, 3, 7, 14],
  /** After a wrong answer or showing the solution, ask again this many minutes later. */
  retryMinutes: 10,
  /** Solved with a hint: stay in the same box and come back after this many days. */
  helpedDays: 1,
  /**
   * A different move from the engine's counts as correct if it loses fewer than this many
   * Win% points compared with the best move (the "inaccuracy" threshold).
   */
  alternativeTolerance: 5,
  /** Engine settings for checking an alternative move. */
  checkDepth: 14,
  checkTimeMs: 3000,
}
