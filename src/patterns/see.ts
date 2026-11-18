import { Chess, type Color, type Square } from 'chess.js'
import { attackersOf, other, VALUE } from './board'

/**
 * Static exchange evaluation: if `attacker` starts capturing on `square` and both sides keep
 * recapturing with their cheapest piece (stopping whenever it pays to stop), how much material
 * does `attacker` win, in pawns? Positive means the piece on `square` can be won.
 *
 * This is better than counting attackers and defenders: a queen defended twice still loses
 * material to a pawn. Pieces lined up behind each other (x-rays) are found because each
 * capturing piece is removed from the board before looking for the next attacker.
 * Like most SEE implementations it ignores pins.
 */
export function see(fen: string, square: Square, attacker: Color): number {
  const game = new Chess(fen)
  const target = game.get(square)
  if (!target || target.color === attacker || target.type === 'k') return 0

  let side = attacker
  let from = cheapestAttacker(game, square, side)
  if (!from) return 0

  const gains: number[] = [VALUE[target.type]]
  let depth = 0

  for (;;) {
    const piece = game.get(from)!
    // A king may only capture if nothing defends the square afterwards.
    if (piece.type === 'k' && attackersOf(game, square, other(side)).length > 0) {
      if (depth === 0) return 0
      // This capture can't happen; drop it from the sequence.
      depth--
      break
    }
    game.remove(from)
    game.remove(square)
    game.put({ type: piece.type, color: piece.color }, square)

    side = other(side)
    const next = cheapestAttacker(game, square, side)
    if (!next) break
    depth++
    // Value of the piece now on the square, minus what the other side had gained so far.
    gains[depth] = VALUE[piece.type] - gains[depth - 1]
    from = next
  }

  // Work back: each side can choose to stop capturing if continuing loses material.
  while (depth > 0) {
    gains[depth - 1] = -Math.max(-gains[depth - 1], gains[depth])
    depth--
  }
  return gains[0] + 0 // normalise -0 to 0
}

function cheapestAttacker(game: Chess, square: Square, color: Color): Square | null {
  const list = attackersOf(game, square, color)
  if (list.length === 0) return null
  list.sort((a, b) => VALUE[a.type] - VALUE[b.type])
  return list[0].square
}
