// Play it out: positions from your games to play on against the bot. Edit to tune.

export const PLAY_IT_OUT = {
  /** "Win it": you were clearly winning (your Win% at least this, about +3) and didn't win. */
  winningFrom: 75,
  /** "Hold it": you were worse but not lost (your Win% in this range) and lost. */
  holdFrom: 20,
  holdTo: 45,
  /** Ignore positions before this half-move (opening theory, gambits). */
  minPly: 8,
  /** "Claim the win" appears once your winning chances reach this (overwhelmingly winning). */
  claimWinAt: 97,
  /** "Count it as held" appears after this many of your moves with winning chances at least... */
  holdMoves: 20,
  /** ...this. */
  holdAtLeast: 35,
  /** Positions listed, newest games first. */
  maxPositions: 30,
}
