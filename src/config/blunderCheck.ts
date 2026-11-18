// Blunder check: in bot games, the coach stops you once when your move is a blunder. Edit to tune.

export const BLUNDER_CHECK = {
  /** Ratings that make the coach ask "Are you sure?". */
  ratings: ['blunder'] as readonly string[],
  /** Don't ask when you were already clearly lost (your winning chances at or below this before the move). */
  minWinBefore: 10,
  /** How long the bot waits for your move to be rated before replying anyway. */
  waitForRatingMs: 6000,
}
