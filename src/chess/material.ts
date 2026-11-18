import type { Chess, Color, PieceSymbol } from 'chess.js'

const START: Record<Exclude<PieceSymbol, 'k'>, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 }
const VALUE: Record<Exclude<PieceSymbol, 'k'>, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }
const ORDER: Exclude<PieceSymbol, 'k'>[] = ['q', 'r', 'b', 'n', 'p']

export interface MaterialSide {
  /** Enemy pieces this side has captured, most valuable first. */
  captured: Exclude<PieceSymbol, 'k'>[]
  /** Material lead in pawns (0 if level or behind). */
  advantage: number
}

/** Captured pieces and material lead for each side, worked out from what's left on the board. */
export function materialSummary(game: Chess): Record<Color, MaterialSide> {
  const count: Record<Color, Record<string, number>> = { w: {}, b: {} }
  let points = { w: 0, b: 0 }
  for (const row of game.board()) {
    for (const p of row) {
      if (!p || p.type === 'k') continue
      count[p.color][p.type] = (count[p.color][p.type] ?? 0) + 1
      points = { ...points, [p.color]: points[p.color] + VALUE[p.type] }
    }
  }
  const capturedBy = (side: Color): Exclude<PieceSymbol, 'k'>[] => {
    const enemy: Color = side === 'w' ? 'b' : 'w'
    const out: Exclude<PieceSymbol, 'k'>[] = []
    for (const t of ORDER) {
      // Promotions can leave more pieces than at the start; never show a negative count.
      const missing = Math.max(0, START[t] - (count[enemy][t] ?? 0))
      for (let i = 0; i < missing; i++) out.push(t)
    }
    return out
  }
  const diff = points.w - points.b
  return {
    w: { captured: capturedBy('w'), advantage: Math.max(0, diff) },
    b: { captured: capturedBy('b'), advantage: Math.max(0, -diff) },
  }
}
