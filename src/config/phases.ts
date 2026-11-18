// How a position is classed as opening, middlegame or endgame. Edit to tune.
//
// "Pieces" here means queens, rooks, bishops and knights of both sides (not pawns or kings).
// At the start there are 14.

export const PHASES = {
  /** Endgame once this many pieces or fewer are left. */
  endgameMaxPieces: 6,
  /** Still the opening before this half-move (move 10 for both sides)... */
  openingEndsAtPly: 20,
  /** ...unless trades have already brought the piece count down to this or fewer. */
  middlegameMaxPieces: 10,
}
