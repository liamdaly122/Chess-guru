import type { Color, Move } from 'chess.js'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { classifyMove, type MoveJudgement } from '../chess/classify'
import { toWhitePov, type Score } from '../chess/score'
import { AnalysisQueue, type AnalysisSnapshot } from './AnalysisQueue'

const EMPTY: AnalysisSnapshot = { results: new Map(), live: null, ready: false }
const noopSubscribe = () => () => {}

/** Per half-move rating: a judgement, 'pending' while the engine works, or null if not rated. */
export type PlyRating = MoveJudgement | 'pending' | null

/**
 * Runs the full-strength analyser over every position in `positions` and rates the
 * moves played by `ratedColor`.
 */
export function useGameAnalysis(positions: string[], history: Move[], ratedColor: Color) {
  const [queue, setQueue] = useState<AnalysisQueue | null>(null)

  useEffect(() => {
    const q = new AnalysisQueue()
    // The analyser is an external system (a Web Worker), so creating it here is intended.
    // oxlint-disable-next-line react/set-state-in-effect
    setQueue(q)
    return () => q.dispose()
  }, [])

  useEffect(() => {
    queue?.setPositions(positions)
  }, [queue, positions])

  const snapshot = useSyncExternalStore(queue?.subscribe ?? noopSubscribe, queue?.getSnapshot ?? (() => EMPTY))

  const ratings = useMemo<PlyRating[]>(
    () =>
      history.map((m) => {
        if (m.color !== ratedColor) return null
        const before = snapshot.results.get(m.before)
        const after = snapshot.results.get(m.after)
        if (!before || !after) return 'pending'
        return classifyMove(before, after, m.from + m.to + (m.promotion ?? ''))
      }),
    [history, ratedColor, snapshot.results],
  )

  return { snapshot, ratings }
}

/**
 * The evaluation to show for the latest position, from White's point of view.
 * Uses the finished result if there is one, otherwise the engine's progress on it,
 * otherwise the most recent earlier position, so the bar doesn't jump back to level.
 */
export function latestEval(snapshot: AnalysisSnapshot, positions: string[]): Score | null {
  for (let i = positions.length - 1; i >= 0; i--) {
    const fen = positions[i]
    const done = snapshot.results.get(fen)?.lines[0]
    const line = done ?? (snapshot.live?.fen === fen ? snapshot.live.line : undefined)
    if (line) return toWhitePov(line.score, fen.split(' ')[1] as Color)
  }
  return null
}
