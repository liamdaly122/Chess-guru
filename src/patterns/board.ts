import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'

/** Standard piece values in pawns. The king's value only matters for ordering. */
export const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }

export const PIECE_NAME: Record<PieceSymbol, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}

export const COLOR_NAME: Record<Color, string> = { w: 'White', b: 'Black' }

export interface PlacedPiece {
  square: Square
  type: PieceSymbol
  color: Color
}

export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w')

/** All pieces on the board, optionally only one colour. */
export function piecesOf(game: Chess, color?: Color): PlacedPiece[] {
  const out: PlacedPiece[] = []
  for (const row of game.board()) {
    for (const p of row) {
      if (p && (!color || p.color === color)) out.push({ square: p.square, type: p.type, color: p.color })
    }
  }
  return out
}

/** Pieces of `color` that attack `square` (pins are ignored, like most tactics counting). */
export function attackersOf(game: Chess, square: Square, color: Color): PlacedPiece[] {
  return game.attackers(square, color).map((sq) => {
    const p = game.get(sq)!
    return { square: sq, type: p.type, color: p.color }
  })
}

/** File and rank as numbers 0 to 7. */
export function coords(square: Square): [number, number] {
  return [square.charCodeAt(0) - 97, Number(square[1]) - 1]
}

export function toSquare(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null
  return (String.fromCharCode(97 + file) + (rank + 1)) as Square
}

/** "the knight on e5" */
export function describe(p: { type: PieceSymbol; square: Square }): string {
  return `the ${PIECE_NAME[p.type]} on ${p.square}`
}
