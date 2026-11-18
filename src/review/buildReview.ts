import type { Color, Move } from 'chess.js'
import type { PlyNote, PlyRating, PlyWhy } from '../analysis/useGameAnalysis'
import { gameAccuracy } from '../chess/accuracy'
import { toWhitePov } from '../chess/score'
import { lineToSan } from '../coach/facts'
import { uciToSan } from '../chess/moves'
import type { PositionAnalysis } from '../engine/uciInfo'
import { buildLessons, categoryOf } from './lessons'
import { patternOf } from '../puzzles/patterns'
import { gamePhase } from './gamePhase'
import { REVIEW_VERSION, type GameReview, type PlyReview } from './types'

/**
 * Turn live analysis (engine results, ratings and notes) into a GameReview that can be
 * stored with the game and shown on the review screen without running the engine again.
 */
export function buildReview(
  history: Move[],
  startFen: string,
  results: ReadonlyMap<string, PositionAnalysis>,
  ratings: PlyRating[],
  notes: PlyNote[],
  userColor: Color,
  /** Reasons for good moves. Passed with both sides rated, which makes a current (version 2) review. */
  whys?: PlyWhy[],
): GameReview {
  const evalOf = (fen: string) => {
    const top = results.get(fen)?.lines[0]
    return top ? toWhitePov(top.score, fen.split(' ')[1] as Color) : null
  }

  let complete = results.has(startFen)
  const plies: PlyReview[] = history.map((m, i) => {
    const evalAfter = evalOf(m.after)
    if (!evalAfter) complete = false
    const r = ratings[i]
    const book = !!r && r !== 'pending' && r.rating === 'book'
    const p: PlyReview = {
      san: m.san,
      uci: m.lan,
      color: m.color,
      fenBefore: m.before,
      fenAfter: m.after,
      evalAfter,
      phase: gamePhase(m.before, i, book),
    }

    if (r === 'pending') complete = false
    if (r && r !== 'pending') {
      p.judgement = {
        rating: r.rating,
        bestUci: r.bestMove,
        bestSan: r.bestMove ? uciToSan(m.before, r.bestMove) : null,
        winBefore: r.winBefore,
        winAfter: r.winAfter,
        scoreBefore: r.scoreBefore,
        scoreAfter: r.scoreAfter,
        bestLineSan: lineToSan(m.before, results.get(m.before)?.lines[0]?.pv ?? []),
      }
    }

    const n = notes[i]
    if (n === 'pending') complete = false
    if (n && n !== 'pending') {
      if (m.color === userColor) p.note = { text: n.text, tip: n.tip, category: categoryOf(n.fact?.type), pattern: patternOf(n.fact) }
      else p.opponentNote = n.text
    }
    const w = whys?.[i]
    if (w === 'pending') complete = false
    if (w && w !== 'pending') p.why = w
    return p
  })

  const judged = (color: Color) => plies.flatMap((p) => (p.judgement && p.color === color ? [p.judgement] : []))
  const opponent: Color = userColor === 'w' ? 'b' : 'w'
  return {
    startEval: evalOf(startFen),
    plies,
    accuracy: gameAccuracy(judged(userColor)),
    ...(whys ? { opponentAccuracy: gameAccuracy(judged(opponent)), version: REVIEW_VERSION } : {}),
    lessons: buildLessons(plies),
    complete,
  }
}
