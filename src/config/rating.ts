// Rating estimate and adaptive bot. Edit to tune.

export const RATING = {
  /** The estimate uses your most recent games against the bot, up to this many. */
  window: 20,
  /** Fewest games needed before showing an estimate. */
  minGames: 3,
  /**
   * The estimate starts from one imaginary draw against the average level you played, so a
   * run of only wins or only losses still gives a sensible number.
   */
  priorDraws: 1,
  /** The trend compares with the estimate this many games ago. */
  trendGames: 10,
  /** Starting puzzle rating from the estimate, kept within these limits. */
  puzzleStartMin: 600,
  puzzleStartMax: 2400,
}

export const ADAPTIVE = {
  /** Levels to move after a win, a loss, a draw. */
  win: 1,
  loss: -1,
  draw: 0,
  /** A win with takebacks keeps the level the same. */
  takebackWinsCount: false,
}
