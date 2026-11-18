import type { Color } from 'chess.js'

/**
 * An engine evaluation from one side's point of view ("us").
 * - cp: centipawns, positive is good for us.
 * - mate: a forced mate in `moves` moves. `forUs` says who delivers it.
 *   moves = 0 means the game is already over by checkmate.
 */
export type Score = { kind: 'cp'; cp: number } | { kind: 'mate'; moves: number; forUs: boolean }

/** Convert the UCI "score cp X" / "score mate N" pair. UCI scores are from the side to move. */
export function scoreFromUci(type: 'cp' | 'mate', value: number): Score {
  if (type === 'cp') return { kind: 'cp', cp: value }
  // "mate 0" means the side to move has been checkmated.
  return { kind: 'mate', moves: Math.abs(value), forUs: value > 0 }
}

/** The same evaluation from the other side's point of view. */
export function negate(s: Score): Score {
  return s.kind === 'cp' ? { kind: 'cp', cp: -s.cp } : { ...s, forUs: !s.forUs }
}

/** Turn a side-to-move score into White's point of view. */
export function toWhitePov(s: Score, sideToMove: Color): Score {
  return sideToMove === 'w' ? s : negate(s)
}

/**
 * Lichess's winning chances, from -1 (certain loss) to +1 (certain win).
 * Centipawns are capped at +/-1000. A mate in N counts as (21 - min(N, 10)) * 100 centipawns,
 * so mates always rank above any centipawn score and shorter mates rank higher.
 * Source: lichess-org/lila, ui/lib/src/ceval/winningChances.ts
 */
export function winningChances(s: Score): number {
  let cp: number
  if (s.kind === 'cp') {
    cp = Math.max(-1000, Math.min(1000, s.cp))
  } else {
    cp = (21 - Math.min(10, s.moves)) * 100 * (s.forUs ? 1 : -1)
  }
  return 2 / (1 + Math.exp(-0.00368208 * cp)) - 1
}

/** Winning chances as a percentage, 0 to 100. */
export function winPercent(s: Score): number {
  return 50 + 50 * winningChances(s)
}

/** Short text like "+0.4", "-2.1", "M3", "-M2" or "#" (game over), from the given point of view. */
export function formatScore(s: Score): string {
  if (s.kind === 'cp') {
    const pawns = s.cp / 100
    const text = Math.abs(pawns) >= 10 ? pawns.toFixed(0) : pawns.toFixed(1)
    return pawns > 0 ? `+${text}` : pawns === 0 ? '0.0' : text
  }
  if (s.moves === 0) return '#'
  return s.forUs ? `M${s.moves}` : `-M${s.moves}`
}
