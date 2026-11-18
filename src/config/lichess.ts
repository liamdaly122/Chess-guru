// Automatic Lichess import. Edit to tune.

export const LICHESS_SYNC = {
  /** First automatic check for a username: this many recent games. */
  firstImport: 20,
  /** Later checks: at most this many new games at a time. */
  maxPerCheck: 100,
  /** Check at most this often (when the app opens or comes back on screen). */
  minMinutesBetweenChecks: 15,
  /**
   * Lichess filters by when a game started, and a long game can finish after a newer one has
   * started, so each check looks back this far. Games already here are skipped.
   */
  overlapDays: 3,
  /** With automatic review on, review at most this many unreviewed Lichess games per session. */
  maxAutoReviews: 20,
}
