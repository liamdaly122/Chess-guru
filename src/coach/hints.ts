import { Chess, type PieceSymbol, type Square } from 'chess.js'
import { parseUci } from '../chess/moves'
import { winPercent } from '../chess/score'
import { HINTS } from '../config/coach'
import type { PositionAnalysis } from '../engine/uciInfo'
import { PIECE_NAME } from '../patterns/board'

export interface Hint {
  /** mate: a forced mate exists. tactic: the best move stands out. quiet: no tactic, just a good move. */
  kind: 'mate' | 'tactic' | 'quiet'
  /** Step 1: whether there's something here. */
  nudge: string
  /** Step 2: which piece to look at. */
  pieceText: string
  pieceSquare: Square
  pieceType: PieceSymbol
  /** Step 3: the move itself. */
  moveText: string
  moveFrom: Square
  moveTo: Square
}

/**
 * Build a three-step hint from the engine's analysis of the current position (side to move
 * is the user). Step 1 only says "there's something here" when the best move is clearly
 * better than the second best, so it actually tells you something.
 */
export function buildHint(analysis: PositionAnalysis, tacticGap = HINTS.tacticGap): Hint | null {
  const top = analysis.lines[0]
  if (!top || !analysis.bestMove) return null

  const game = new Chess(analysis.fen)
  let move
  try {
    move = game.move(parseUci(analysis.bestMove))
  } catch {
    return null
  }

  const second = analysis.lines[1]
  let kind: Hint['kind']
  if (top.score.kind === 'mate' && top.score.forUs) kind = 'mate'
  else if (!second || winPercent(top.score) - winPercent(second.score) >= tacticGap) kind = 'tactic'
  else kind = 'quiet'

  const nudge =
    kind === 'mate'
      ? `There's a forced mate in ${top.score.kind === 'mate' ? top.score.moves : ''} here. Look at every check.`
      : kind === 'tactic'
        ? "There's a strong move here. Look for checks, captures and threats."
        : 'Nothing tactical right now. Look for a move that improves your position.'

  return {
    kind,
    nudge,
    pieceText: `Look at your ${PIECE_NAME[move.piece]} on ${move.from}.`,
    pieceSquare: move.from,
    pieceType: move.piece,
    moveText: `Play ${move.san}.`,
    moveFrom: move.from,
    moveTo: move.to,
  }
}
