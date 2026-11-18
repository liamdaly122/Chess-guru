import type { Color, Move } from 'chess.js'
import type { PlyNote, PlyRating } from '../analysis/useGameAnalysis'
import { gameAccuracy } from '../chess/accuracy'
import { toWhitePov } from '../chess/score'
import { lineToSan } from '../coach/facts'
import { uciToSan } from '../chess/moves'
import type { PositionAnalysis } from '../engine/uciInfo'
import { buildLessons, categoryOf } from './lessons'
import type { GameReview, PlyReview } from './types'

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
): GameReview {
  const evalOf = (fen: string) => {
    const top = results.get(fen)?.lines[0]
    return top ? toWhitePov(top.score, fen.split(' ')[1] as Color) : null
  }

  let complete = results.has(startFen)
  const plies: PlyReview[] = history.map((m, i) => {
    const evalAfter = evalOf(m.after)
    if (!evalAfter) complete = false
    const p: PlyReview = { san: m.san, uci: m.lan, color: m.color, fenBefore: m.before, fenAfter: m.after, evalAfter }

    const r = ratings[i]
    if (r === 'pending') complete = false
    if (r && r !== 'pending' && m.color === userColor) {
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
    if (n && n !== 'pending') p.note = { text: n.text, tip: n.tip, category: categoryOf(n.fact?.type) }
    return p
  })

  const judged = plies.flatMap((p) => (p.judgement ? [p.judgement] : []))
  return {
    startEval: evalOf(startFen),
    plies,
    accuracy: gameAccuracy(judged),
    lessons: buildLessons(plies),
    complete,
  }
}
