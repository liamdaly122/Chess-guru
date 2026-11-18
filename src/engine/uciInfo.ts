import { scoreFromUci, type Score } from '../chess/score'

/** One candidate line from the engine. Score is from the side to move. */
export interface PvLine {
  multipv: number
  depth: number
  score: Score
  /** Principal variation in UCI notation. Empty when the game is over. */
  pv: string[]
}

/** Full-strength analysis of one position. */
export interface PositionAnalysis {
  fen: string
  depth: number
  /** Candidate lines, best first. Empty only if the engine returned nothing usable. */
  lines: PvLine[]
  /** Engine's best move in UCI, or null when there are no legal moves. */
  bestMove: string | null
}

/**
 * Parse a UCI "info" line. Returns null for lines without a score (e.g. "info string",
 * "currmove") and for lowerbound/upperbound lines, which are provisional.
 */
export function parseInfoLine(line: string): PvLine | null {
  const t = line.trim().split(/\s+/)
  if (t[0] !== 'info') return null
  let depth: number | null = null
  let multipv = 1
  let score: Score | null = null
  let pv: string[] = []
  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case 'depth':
        depth = Number(t[++i])
        break
      case 'multipv':
        multipv = Number(t[++i])
        break
      case 'score': {
        const type = t[++i]
        const value = Number(t[++i])
        if (type !== 'cp' && type !== 'mate') return null
        score = scoreFromUci(type, value)
        break
      }
      case 'lowerbound':
      case 'upperbound':
        return null
      case 'pv':
        pv = t.slice(i + 1)
        i = t.length
        break
    }
  }
  if (depth === null || score === null) return null
  return { multipv, depth, score, pv }
}
