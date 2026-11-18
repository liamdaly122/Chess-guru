import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { gameAccuracy, moveAccuracy } from '../chess/accuracy'
import { classifyMove } from '../chess/classify'
import type { Score } from '../chess/score'
import type { PositionAnalysis } from '../engine/uciInfo'
import { buildFacts } from '../coach/facts'
import { writeNote } from '../coach/notes'
import { buildReview } from './buildReview'
import { buildLessons, categoryOf } from './lessons'
import type { PlyReview } from './types'

const cp = (n: number): Score => ({ kind: 'cp', cp: n })

describe('accuracy (Lichess formula)', () => {
  it('is 100 for a move that loses nothing', () => {
    expect(moveAccuracy(55, 55)).toBe(100)
    expect(moveAccuracy(40, 60)).toBe(100)
  })
  it('drops with the Win% lost', () => {
    expect(moveAccuracy(60, 50)).toBeCloseTo(64.58, 2)
    expect(moveAccuracy(80, 50)).toBeCloseTo(25.77, 2)
  })
  it('averages move accuracies for a game', () => {
    expect(gameAccuracy([])).toBeNull()
    expect(gameAccuracy([{ winBefore: 50, winAfter: 50 }, { winBefore: 60, winAfter: 50 }])).toBeCloseTo(82.29, 2)
  })
})

type Category = NonNullable<PlyReview['note']>['category']

/** One of the user's (White's) moves with a note. */
function ply(i: number, category: Category, lost: number): PlyReview {
  return {
    san: `m${i}`,
    uci: 'a2a3',
    color: 'w',
    fenBefore: '',
    fenAfter: '',
    evalAfter: null,
    judgement: {
      rating: 'mistake',
      bestUci: 'b2b3',
      bestSan: 'b3',
      winBefore: 50 + lost,
      winAfter: 50,
      scoreBefore: cp(0),
      scoreAfter: cp(0),
      bestLineSan: [],
    },
    note: { text: 'x', tip: 'y', category },
  }
}

/** An opponent move with no rating or note. */
function opp(i: number): PlyReview {
  return { san: `o${i}`, uci: 'a7a6', color: 'b', fenBefore: '', fenAfter: '', evalAfter: null }
}

describe('buildLessons', () => {
  it('groups mistakes by kind and ranks by winning chances lost', () => {
    // Array position = half-move index: White's moves are 0, 2, 4, 6.
    const plies = [ply(0, 'forks', 20), opp(1), ply(2, 'loose-pieces', 15), opp(3), ply(4, 'loose-pieces', 15), opp(5), ply(6, 'threats', 5)]
    const lessons = buildLessons(plies, 2)
    expect(lessons.map((l) => l.category)).toEqual(['loose-pieces', 'forks'])
    expect(lessons[0].text).toBe('You left a piece where it could be taken 2 times (2. m2, 3. m4).')
    expect(lessons[0].winLost).toBe(30)
    expect(lessons[1].text).toBe('You allowed a fork once (1. m0).')
  })

  it('returns nothing when there were no mistakes', () => {
    expect(buildLessons([])).toEqual([])
  })

  it('maps coaching facts to lesson categories', () => {
    expect(categoryOf('piece-lost')).toBe('loose-pieces')
    expect(categoryOf('missed-fork')).toBe('missed-tactics')
    expect(categoryOf(undefined)).toBe('general')
  })
})

describe('buildReview', () => {
  it('collects evals, ratings, notes, accuracy and lessons for a game', () => {
    // 1.e4 e5 2.Nf3 Nc6 3.Nd4?? exd4, user is White.
    const game = new Chess()
    for (const m of ['e4', 'e5', 'Nf3', 'Nc6', 'Nd4', 'exd4']) game.move(m)
    const history = game.history({ verbose: true })
    const start = history[0].before

    // Fake engine results for every position (score from the side to move).
    const results = new Map<string, PositionAnalysis>()
    const put = (fen: string, score: Score, pv: string[]) =>
      results.set(fen, { fen, depth: 16, bestMove: pv[0] ?? null, lines: [{ multipv: 1, depth: 16, score, pv }] })
    put(start, cp(30), ['e2e4'])
    put(history[0].after, cp(-30), ['e7e5'])
    put(history[1].after, cp(30), ['g1f3'])
    put(history[2].after, cp(-30), ['b8c6'])
    put(history[3].after, cp(30), ['f1b5', 'a7a6'])
    put(history[4].after, cp(300), ['e5d4'])
    put(history[5].after, cp(-300), ['c2c3'])

    const ratings = history.map((m) =>
      m.color === 'w' ? classifyMove(results.get(m.before), results.get(m.after), m.lan) : null,
    )
    const notes = history.map((m, i) => {
      const r = ratings[i]
      if (!r || (r.rating !== 'mistake' && r.rating !== 'blunder')) return null
      const facts = buildFacts({ move: m, judgement: r, before: results.get(m.before)!, after: results.get(m.after)! })
      return writeNote(facts, m.color)
    })

    const review = buildReview(history, start, results, ratings, notes, 'w')
    expect(review.complete).toBe(true)
    expect(review.startEval).toEqual(cp(30))
    expect(review.plies[1].evalAfter).toEqual(cp(30)) // after 1...e5, white to move, +0.3
    expect(review.plies[4].judgement?.rating).toBe('blunder')
    expect(review.plies[4].judgement?.bestSan).toBe('Bb5')
    expect(review.plies[4].judgement?.bestLineSan).toEqual(['Bb5', 'a6'])
    expect(review.plies[4].note?.category).toBe('loose-pieces')
    expect(review.plies[5].judgement).toBeUndefined() // Black's moves are not rated
    expect(review.accuracy).not.toBeNull()
    expect(review.lessons[0].category).toBe('loose-pieces')
  })

  it('is incomplete while ratings are pending', () => {
    const game = new Chess()
    game.move('e4')
    const history = game.history({ verbose: true })
    const review = buildReview(history, history[0].before, new Map(), ['pending'], ['pending'], 'w')
    expect(review.complete).toBe(false)
  })
})
