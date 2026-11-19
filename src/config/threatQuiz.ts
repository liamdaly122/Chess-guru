// Threat quiz settings: how often the coach asks "What does your opponent want?" in bot games.

export const THREAT_QUIZ = {
  /**
   * A real threat: if you passed, the opponent's best move would raise their winning chances
   * by at least this many Win% points. Same bar as the coaching notes' "threat ignored".
   */
  minGain: 15,
  /** A quiet position: passing would cost you less than this. Positions in between aren't asked. */
  quietBelow: 4,
  /** Not before move number N (the opening is mostly book). Counted from the position, so set positions work too. */
  fromMove: 5,
  /** At least this many of your moves since the last quiz before asking about a real threat. */
  threatEvery: 3,
  /** Quiet positions are asked less often, so the answer isn't always "No threat". */
  quietEvery: 8,
  /** Don't ask when the game is already decided: your Win% outside this range. */
  minWin: 8,
  maxWin: 92,
  /** Quick searches of the position and the null-move position (on a separate engine). */
  depth: 12,
  maxTimeMs: 1500,
  /** Results kept for the "lately" score. */
  keep: 50,
}
