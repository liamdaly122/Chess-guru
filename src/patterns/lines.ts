import { Chess, type Color, type Square } from 'chess.js'
import { attackersOf, coords, other, piecesOf, toSquare, VALUE, type PlacedPiece } from './board'

export interface LineTactic {
  kind: 'pin' | 'skewer'
  /** The bishop, rook or queen doing the pinning or skewering. */
  by: PlacedPiece
  /** The enemy piece in front, on the line. */
  front: PlacedPiece
  /** The enemy piece behind it. */
  back: PlacedPiece
  /** Pin to the king: the front piece cannot legally move off the line. */
  absolute: boolean
}

const ROOK_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]
const BISHOP_DIRS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

/**
 * Pins and skewers by `color`'s bishops, rooks and queens.
 * Both are two enemy pieces on one line with nothing between them and the attacker.
 * - Pin: the front piece is worth less than the one behind (or the one behind is the king),
 *   so moving it would expose the more valuable piece.
 * - Skewer: the front piece is worth more (or is the king), so it must move and the
 *   piece behind can be taken.
 * Only counted when the piece behind is worth winning: it's the king, worth more than the
 * attacker, or undefended. Pass `only` to check a single attacker, e.g. the piece that just moved.
 */
export function findLineTactics(fen: string, color: Color, only?: Square): LineTactic[] {
  const game = new Chess(fen)
  const enemy = other(color)
  const out: LineTactic[] = []

  for (const by of piecesOf(game, color)) {
    if (only && by.square !== only) continue
    const dirs =
      by.type === 'r' ? ROOK_DIRS : by.type === 'b' ? BISHOP_DIRS : by.type === 'q' ? [...ROOK_DIRS, ...BISHOP_DIRS] : []

    for (const [df, dr] of dirs) {
      const [front, back] = firstTwoPieces(game, by.square, df, dr)
      if (!front || !back || front.color !== enemy || back.color !== enemy) continue

      const backWorthWinning =
        back.type === 'k' || VALUE[back.type] > VALUE[by.type] || attackersOf(game, back.square, enemy).length === 0

      if (front.type !== 'k' && (back.type === 'k' || VALUE[front.type] < VALUE[back.type])) {
        if (backWorthWinning) out.push({ kind: 'pin', by, front, back, absolute: back.type === 'k' })
      } else if (front.type === 'k' || VALUE[front.type] > VALUE[back.type]) {
        // Skewering a pawn is rarely worth a mention.
        if (back.type !== 'p' && back.type !== 'k' && backWorthWinning) {
          out.push({ kind: 'skewer', by, front, back, absolute: false })
        }
      }
    }
  }
  return out
}

function firstTwoPieces(game: Chess, from: Square, df: number, dr: number): (PlacedPiece | undefined)[] {
  const found: PlacedPiece[] = []
  let [f, r] = coords(from)
  for (;;) {
    f += df
    r += dr
    const sq = toSquare(f, r)
    if (!sq) break
    const p = game.get(sq)
    if (p) {
      found.push({ square: sq, type: p.type, color: p.color })
      if (found.length === 2) break
    }
  }
  return [found[0], found[1]]
}
