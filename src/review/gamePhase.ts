import { PHASES } from '../config/phases'

export type GamePhase = 'opening' | 'middlegame' | 'endgame'

export const PHASE_LABEL: Record<GamePhase, string> = {
  opening: 'Opening',
  middlegame: 'Middlegame',
  endgame: 'Endgame',
}

/** Queens, rooks, bishops and knights of both sides, counted from the board part of a FEN. */
export function countPieces(fen: string): number {
  const board = fen.split(' ')[0]
  let n = 0
  for (const ch of board) if ('qrbnQRBN'.includes(ch)) n++
  return n
}

/**
 * Which phase a move was played in, from the position before it.
 * - Endgame: few pieces left.
 * - Opening: still in known theory, or early in the game with most pieces on the board.
 * - Middlegame: everything else.
 */
export function gamePhase(fenBefore: string, ply: number, inBook = false, rules = PHASES): GamePhase {
  const pieces = countPieces(fenBefore)
  if (pieces <= rules.endgameMaxPieces) return 'endgame'
  if (inBook) return 'opening'
  if (ply < rules.openingEndsAtPly && pieces > rules.middlegameMaxPieces) return 'opening'
  return 'middlegame'
}
