import type { Color, Move } from 'chess.js'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { buildFacts } from '../coach/facts'
import { buildHint, type Hint } from '../coach/hints'
import { writeNote, type CoachNote } from '../coach/notes'
import { classifyMove, type MoveJudgement } from '../chess/classify'
import { toWhitePov, type Score } from '../chess/score'
import { COACH } from '../config/coach'
import { sacrificedMaterial } from '../patterns/sacrifice'
import { nullMoveFen } from '../patterns/threats'
import { AnalysisQueue, type AnalysisSnapshot } from './AnalysisQueue'

const EMPTY: AnalysisSnapshot = { results: new Map(), live: null, ready: false }
const noopSubscribe = () => () => {}
const emptySnapshot = () => EMPTY

/** Per half-move rating: a judgement, 'pending' while the engine works, or null if not rated. */
export type PlyRating = MoveJudgement | 'pending' | null

/** Per half-move coaching note: only for mistakes and blunders. */
export type PlyNote = CoachNote | 'pending' | null

const NOTE_RATINGS: readonly string[] = COACH.noteRatings

// Material given up by a move. A pure calculation, but not free, so results are remembered.
const sacrificeCache = new Map<string, number>()
function sacrificeOf(m: Move): number {
  const key = `${m.before}|${m.lan}`
  let v = sacrificeCache.get(key)
  if (v === undefined) {
    if (sacrificeCache.size > 2000) sacrificeCache.clear()
    v = sacrificedMaterial(m.before, m.lan)
    sacrificeCache.set(key, v)
  }
  return v
}

/**
 * Runs the full-strength analyser over every position in `positions`, rates the moves played
 * by `ratedColor`, writes coaching notes for their mistakes and blunders, and builds a hint
 * for the current position.
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

  const snapshot = useSyncExternalStore(queue?.subscribe ?? noopSubscribe, queue?.getSnapshot ?? emptySnapshot)

  const ratings = useMemo<PlyRating[]>(
    () =>
      history.map((m) => {
        if (m.color !== ratedColor) return null
        const before = snapshot.results.get(m.before)
        const after = snapshot.results.get(m.after)
        if (!before || !after) return 'pending'
        return classifyMove(before, after, m.lan, { sacrifice: sacrificeOf(m) })
      }),
    [history, ratedColor, snapshot.results],
  )

  // Mistakes and blunders need the null-move position analysed too, to find ignored threats.
  const nullFens = useMemo(
    () =>
      history.map((m, i) => {
        const r = ratings[i]
        if (!r || r === 'pending' || !NOTE_RATINGS.includes(r.rating)) return null
        return nullMoveFen(m.before)
      }),
    [history, ratings],
  )

  useEffect(() => {
    for (const f of nullFens) if (f) queue?.request(f)
  }, [queue, nullFens])

  const notes = useMemo<PlyNote[]>(
    () =>
      history.map((m, i) => {
        const r = ratings[i]
        if (!r) return null
        if (r === 'pending') return 'pending'
        if (!NOTE_RATINGS.includes(r.rating)) return null
        const nullFen = nullFens[i]
        const nullMove = nullFen ? snapshot.results.get(nullFen) : undefined
        if (nullFen && !nullMove) return 'pending'
        const facts = buildFacts({
          move: m,
          judgement: r,
          before: snapshot.results.get(m.before)!,
          after: snapshot.results.get(m.after)!,
          nullMove,
        })
        return writeNote(facts, m.color)
      }),
    [history, ratings, nullFens, snapshot.results],
  )

  const currentFen = positions[positions.length - 1]
  const hint = useMemo<Hint | null>(() => {
    const a = snapshot.results.get(currentFen)
    return a ? buildHint(a) : null
  }, [snapshot.results, currentFen])

  return { snapshot, ratings, notes, hint }
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
