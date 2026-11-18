// Coaching settings. Change these to tune when notes, hints and special ratings appear.

export const COACH = {
  /**
   * With live coaching on, the bot waits for your move's rating before replying, so the
   * badge appears on your piece first. It never waits longer than this (slow phones).
   */
  botWaitsForRatingMs: 2500,
  /** Which ratings get a written coaching note. */
  noteRatings: ['mistake', 'blunder'] as const,
  /** A threat must be worth at least this many Win% points to be mentioned. */
  threatMinGain: 15,
}

/**
 * "Great" (!): you played the engine's best move and its second-best move was at least
 * this many Win% points worse, so it was the only good move.
 */
export const GREAT_MOVE_GAP = 10

/** "Brilliant" (!!): a best or great move that gives up material. */
export const BRILLIANT = {
  /** Material offered, in pawns. 2 means at least a piece for a pawn; pawn sacrifices don't count. */
  minSacrifice: 2,
  /** Not brilliant if you were already this far ahead (Win%), since anything wins then. */
  maxWinBefore: 97,
  /** Not brilliant if you end up worse than this (Win%). */
  minWinAfter: 40,
}

export const HINTS = {
  /**
   * Hint step 1 says "there's something here" when the best move is at least this many
   * Win% points better than the second best. Otherwise it says the position is quiet.
   */
  tacticGap: 10,
}
