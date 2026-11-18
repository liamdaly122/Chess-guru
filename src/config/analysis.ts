// Settings for the full-strength analysis engine and the move ratings.
// Change these to tune how deep the engine looks and how strict the ratings are.

export const ANALYSIS = {
  /** Search depth in plies for every position. Higher is more accurate but slower. */
  depth: 16,
  /** Stop searching a position after this long, even if the depth isn't reached (helps on phones). */
  maxTimeMs: 4000,
  /** How many candidate moves the engine reports. 2 lets Phase 3 hints compare best and second best. */
  multiPv: 2,
}

/**
 * Move rating thresholds, as a drop in the mover's winning chances (Win%, 0 to 100).
 * These match Lichess, which uses 0.1 / 0.2 / 0.3 on its -1 to +1 scale.
 * A drop smaller than `inaccuracy` is rated "good" (or "best" if it was the engine's top move).
 */
export const RATING_THRESHOLDS = {
  inaccuracy: 5,
  mistake: 10,
  blunder: 15,
}

/**
 * Extra rules for forced mates, matching Lichess's server analysis.
 * Allowing a forced mate: inaccuracy if you were already below -inaccuracyCp, mistake if
 * below -mistakeCp, otherwise blunder. Missing a forced mate you had: inaccuracy if you are
 * still above +inaccuracyCp afterwards, mistake if above +mistakeCp, otherwise blunder.
 */
export const MATE_RULES = {
  inaccuracyCp: 999,
  mistakeCp: 700,
}
