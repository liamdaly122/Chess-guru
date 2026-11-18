import { gamePhase, type GamePhase } from '../review/gamePhase'
import type { LessonCategory } from '../review/types'
import { outcomeOf } from '../storage/gameInfo'
import type { GameRecord } from '../storage/types'

export interface PhaseStat {
  phase: GamePhase
  /** Your rated moves in this phase (book moves excluded). */
  moves: number
  /** Total winning chances lost, in Win% points. */
  winLost: number
  /** Average Win% lost per move: the fairest way to compare phases of different lengths. */
  perMove: number
  mistakes: number
  blunders: number
}

export interface PatternStat {
  category: LessonCategory
  /** Mistakes and blunders of this kind. */
  count: number
  winLost: number
}

export interface AccuracyPoint {
  id: string
  endedAt: number
  accuracy: number
  source: GameRecord['source']
  /** Average of this game and the previous ones in the window, to smooth the line. */
  rolling: number
}

export interface ProgressStats {
  games: number
  reviewed: number
  record: { win: number; loss: number; draw: number }
  avgAccuracy: number | null
  /** Average accuracy of the last `recentWindow` reviewed games. */
  recentAccuracy: number | null
  accuracyTrend: AccuracyPoint[]
  phases: PhaseStat[]
  /** Biggest losses first. */
  patterns: PatternStat[]
  /** The phase with the highest loss per move (needs a few moves to count). */
  weakestPhase: GamePhase | null
}

const PHASES: GamePhase[] = ['opening', 'middlegame', 'endgame']

/**
 * Work out where the user loses the most and how accuracy changes, from saved games.
 * Only complete reviews count. Undone moves never reach saved games, so takebacks don't count.
 */
export function progressStats(games: GameRecord[], { recentWindow = 10, rollingWindow = 5, minPhaseMoves = 5 } = {}): ProgressStats {
  const reviewed = games.filter((g) => g.review?.complete).sort((a, b) => a.endedAt - b.endedAt)
  const record = { win: 0, loss: 0, draw: 0 }
  for (const g of games) {
    const o = outcomeOf(g)
    if (o !== 'unfinished') record[o]++
  }

  const phase = new Map<GamePhase, PhaseStat>(
    PHASES.map((p) => [p, { phase: p, moves: 0, winLost: 0, perMove: 0, mistakes: 0, blunders: 0 }]),
  )
  const pattern = new Map<LessonCategory, PatternStat>()

  for (const g of reviewed) {
    g.review!.plies.forEach((p, i) => {
      const j = p.judgement
      // Newer reviews rate both players: only your own moves count here.
      if (!j || j.rating === 'book' || p.color !== g.userColor) return
      const ph = p.phase ?? gamePhase(p.fenBefore, i)
      const lost = Math.max(0, j.winBefore - j.winAfter)
      const s = phase.get(ph)!
      s.moves++
      s.winLost += lost
      if (j.rating === 'mistake') s.mistakes++
      if (j.rating === 'blunder') s.blunders++
      if (p.note) {
        const c = pattern.get(p.note.category) ?? { category: p.note.category, count: 0, winLost: 0 }
        c.count++
        c.winLost += lost
        pattern.set(p.note.category, c)
      }
    })
  }
  for (const s of phase.values()) s.perMove = s.moves ? s.winLost / s.moves : 0

  const points = reviewed.filter((g) => g.review!.accuracy != null)
  const accuracyTrend: AccuracyPoint[] = points.map((g, i) => {
    const window = points.slice(Math.max(0, i - rollingWindow + 1), i + 1)
    return {
      id: g.id,
      endedAt: g.endedAt,
      accuracy: g.review!.accuracy!,
      source: g.source,
      rolling: avg(window.map((w) => w.review!.accuracy!))!,
    }
  })

  const phases = [...phase.values()]
  const candidates = phases.filter((p) => p.moves >= minPhaseMoves)
  const weakestPhase = candidates.length ? candidates.sort((a, b) => b.perMove - a.perMove)[0].phase : null

  return {
    games: games.length,
    reviewed: reviewed.length,
    record,
    avgAccuracy: avg(accuracyTrend.map((p) => p.accuracy)),
    recentAccuracy: avg(accuracyTrend.slice(-recentWindow).map((p) => p.accuracy)),
    accuracyTrend,
    phases: PHASES.map((p) => phase.get(p)!),
    patterns: [...pattern.values()].sort((a, b) => b.winLost - a.winLost),
    weakestPhase,
  }
}

function avg(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}
