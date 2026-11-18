import { Chess, type Move } from 'chess.js'
import type { GameReview } from './types'

/** Play a line given in standard notation from a position, stopping at the first illegal move. */
export function lineMoves(fen: string, sans: string[]): Move[] {
  const chess = new Chess(fen)
  const out: Move[] = []
  for (const san of sans) {
    try {
      out.push(chess.move(san))
    } catch {
      break
    }
  }
  return out
}

/** "12. Nxe5 Qg5 13. d4" or "12... Qg5 13. d4", numbered from the position. */
export function numberedLine(fen: string, sans: string[]): string {
  const parts = fen.split(' ')
  let white = parts[1] === 'w'
  let n = Number(parts[5]) || 1
  return sans
    .map((san, i) => {
      const label = white ? `${n}. ${san}` : i === 0 ? `${n}... ${san}` : san
      if (!white) n++
      white = !white
      return label
    })
    .join(' ')
}

export interface FollowUp {
  /** Position the line starts from. */
  fen: string
  sans: string[]
  /** "instead" = the engine's line instead of the move played; "after" = what follows the move. */
  kind: 'instead' | 'after'
}

/**
 * The engine line to play out for a half-move: for a move that wasn't the best, the line starting
 * with the best move instead; otherwise what the engine expects to follow the move (from the
 * next half-move's analysis).
 */
export function followUpFor(review: GameReview, ply: number, insteadOfPlayed: boolean): FollowUp | null {
  const p = review.plies[ply]
  if (!p) return null
  if (insteadOfPlayed) {
    const sans = p.judgement?.bestLineSan ?? []
    return sans.length ? { fen: p.fenBefore, sans, kind: 'instead' } : null
  }
  const next = review.plies[ply + 1]
  const sans = next?.judgement?.bestLineSan ?? []
  return sans.length ? { fen: p.fenAfter, sans, kind: 'after' } : null
}
