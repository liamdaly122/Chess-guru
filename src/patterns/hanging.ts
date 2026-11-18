import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import { attackersOf, other, piecesOf } from './board'
import { see } from './see'

export interface HangingPiece {
  square: Square
  type: PieceSymbol
  color: Color
  /** How many enemy pieces attack it. */
  attackers: number
  /** How many of its own pieces defend it. */
  defenders: number
  /** Material the opponent wins by capturing on this square, in pawns (always > 0). */
  loss: number
}

/**
 * Pieces of `color` that the opponent can win material from right now: either undefended
 * and attacked, or attacked more times (or by cheaper pieces) than they are defended.
 * Uses the static exchange evaluation, so "attacked twice, defended twice" only counts
 * when the exchange really loses material. Kings are never included.
 */
export function findHangingPieces(fen: string, color: Color): HangingPiece[] {
  const game = new Chess(fen)
  const enemy = other(color)
  const out: HangingPiece[] = []
  for (const p of piecesOf(game, color)) {
    if (p.type === 'k') continue
    const attackers = attackersOf(game, p.square, enemy)
    if (attackers.length === 0) continue
    const loss = see(fen, p.square, enemy)
    if (loss <= 0) continue
    out.push({
      square: p.square,
      type: p.type,
      color,
      attackers: attackers.length,
      defenders: attackersOf(game, p.square, color).length,
      loss,
    })
  }
  return out.sort((a, b) => b.loss - a.loss)
}
