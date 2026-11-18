import { Chess, type Color, type Square } from 'chess.js'
import { attackersOf, other, piecesOf, VALUE, type PlacedPiece } from './board'
import { see } from './see'

export interface Fork {
  forker: PlacedPiece
  /** The pieces it attacks that are worth attacking (king, more valuable, or undefended). */
  targets: PlacedPiece[]
}

/**
 * Forks by pieces of `color`: one piece attacking two or more enemy targets at once.
 * A target counts if it is the king (check), worth more than the forking piece, or undefended.
 * The forking piece must not simply be lost (the opponent can't win it by capturing).
 * Pass `only` to check a single piece, e.g. the piece that just moved.
 */
export function findForks(fen: string, color: Color, only?: Square): Fork[] {
  const game = new Chess(fen)
  const enemy = other(color)
  const enemies = piecesOf(game, enemy)
  const out: Fork[] = []

  for (const forker of piecesOf(game, color)) {
    if (only && forker.square !== only) continue
    const targets = enemies.filter((t) => {
      if (!game.attackers(t.square, color).includes(forker.square)) return false
      if (t.type === 'k') return true
      if (VALUE[t.type] > VALUE[forker.type]) return true
      return attackersOf(game, t.square, enemy).length === 0
    })
    if (targets.length < 2) continue
    // If the opponent can just win the forking piece, it isn't a real fork.
    if (see(fen, forker.square, enemy) > 0) continue
    out.push({ forker, targets: targets.sort((a, b) => VALUE[b.type] - VALUE[a.type]) })
  }
  return out
}
