import { describe, expect, it } from 'vitest'
import type { PositionAnalysis } from '../engine/uciInfo'
import type { GameRecord } from '../storage/types'
import {
  checkAttempt,
  duePuzzles,
  isGoodAlternative,
  isMastered,
  MASTERED_BOX,
  mistakePuzzlesFromGame,
  mistakeStats,
  NEVER,
  schedule,
  whenText,
  type MistakePuzzle,
} from './mistakes'

const DAY = 86_400_000
const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'

function game(extra: Partial<GameRecord> = {}): GameRecord {
  return {
    id: 'g1',
    source: 'bot',
    endedAt: 1000,
    white: { name: 'You' },
    black: { name: 'Maia 1200', rating: 1200 },
    userColor: 'w',
    result: '0-1',
    termination: 'checkmate',
    moves: [],
    review: {
      startEval: null,
      accuracy: 70,
      lessons: [],
      complete: true,
      plies: [
        {
          san: 'Nd4',
          uci: 'f3d4',
          color: 'w',
          fenBefore: FEN,
          fenAfter: '',
          evalAfter: null,
          phase: 'opening',
          judgement: {
            rating: 'blunder',
            bestUci: 'f1b5',
            bestSan: 'Bb5',
            winBefore: 55,
            winAfter: 10,
            scoreBefore: { kind: 'cp', cp: 30 },
            scoreAfter: { kind: 'cp', cp: -300 },
            bestLineSan: ['Bb5'],
          },
          note: { text: 'This leaves your knight on d4 with no defender.', tip: 'Check your pieces.', category: 'loose-pieces' },
        },
        { san: 'exd4', uci: 'e5d4', color: 'b', fenBefore: '', fenAfter: '', evalAfter: null },
        {
          san: 'c3',
          uci: 'c2c3',
          color: 'w',
          fenBefore: FEN,
          fenAfter: '',
          evalAfter: null,
          judgement: {
            rating: 'inaccuracy',
            bestUci: 'd2d3',
            bestSan: 'd3',
            winBefore: 20,
            winAfter: 14,
            scoreBefore: { kind: 'cp', cp: 0 },
            scoreAfter: { kind: 'cp', cp: 0 },
            bestLineSan: [],
          },
        },
      ],
    },
    ...extra,
  }
}

describe('mistakePuzzlesFromGame', () => {
  it('turns your mistakes and blunders into puzzles', () => {
    const [p, ...rest] = mistakePuzzlesFromGame(game(), 5000)
    expect(rest).toEqual([]) // the inaccuracy and the opponent's move are skipped
    expect(p).toMatchObject({
      id: 'g1:0',
      fen: FEN,
      solution: 'f1b5',
      solutionSan: 'Bb5',
      playedSan: 'Nd4',
      rating: 'blunder',
      category: 'loose-pieces',
      opponent: 'Maia 1200',
      box: 0,
      dueAt: 1000, // due from when the game ended
    })
  })

  it('ignores games that are not fully reviewed', () => {
    expect(mistakePuzzlesFromGame(game({ review: undefined }))).toEqual([])
  })
})

describe('spaced repetition', () => {
  const fresh = mistakePuzzlesFromGame(game(), 0)[0]

  it('moves up a box after a clean solve, with growing gaps', () => {
    const a = schedule(fresh, 'solved', 0)
    expect(a.box).toBe(1)
    expect(a.dueAt).toBe(1 * DAY)
    const b = schedule(a, 'solved', a.dueAt)
    expect(b.box).toBe(2)
    expect(b.dueAt - a.dueAt).toBe(3 * DAY)
  })

  it('is mastered after a clean solve from the last box', () => {
    let p: MistakePuzzle = fresh
    for (let i = 0; i < MASTERED_BOX; i++) p = schedule(p, 'solved', 0)
    expect(isMastered(p)).toBe(true)
    expect(duePuzzles([p], 10 * 365 * DAY)).toEqual([])
  })

  it('starts again and comes back soon after a fail', () => {
    const p = schedule(schedule(fresh, 'solved', 0), 'failed', DAY)
    expect(p.box).toBe(0)
    expect(p.dueAt).toBe(DAY + 10 * 60_000)
  })

  it('stays in its box and comes back tomorrow when solved with help', () => {
    const p = schedule(schedule(fresh, 'solved', 0), 'helped', DAY)
    expect(p.box).toBe(1)
    expect(p.dueAt).toBe(2 * DAY)
  })

  it('lists due puzzles, longest waiting first, and counts them', () => {
    const a = { ...fresh, id: 'a', dueAt: 100 }
    const b = { ...fresh, id: 'b', dueAt: 50 }
    const later = { ...fresh, id: 'c', dueAt: 5000 }
    expect(duePuzzles([a, b, later], 200).map((p) => p.id)).toEqual(['b', 'a'])
    expect(mistakeStats([a, b, later], 200)).toMatchObject({ total: 3, due: 2, learning: 3, mastered: 0, nextDueAt: null })
    expect(mistakeStats([later], 200).nextDueAt).toBe(5000)
  })

  it('describes when a puzzle is due', () => {
    expect(whenText(10 * 60_000, 0)).toBe('in 10 minutes')
    expect(whenText(60_000, 0)).toBe('in 1 minute')
    expect(whenText(DAY, 0)).toBe('tomorrow')
    expect(whenText(DAY - 60_000, 0)).toBe('tomorrow')
    expect(whenText(5 * 3_600_000, 0)).toBe('in 5 hours')
    expect(whenText(3 * DAY, 0)).toBe('in 3 days')
    expect(whenText(NEVER, 0)).toBe('never (mastered)')
  })
})

describe('checking answers', () => {
  const p = mistakePuzzlesFromGame(game(), 0)[0]

  it('accepts the engine move straight away', () => {
    expect(checkAttempt(p, 'f1b5')).toEqual({ verdict: 'correct' })
  })

  it('sends other legal moves to the engine and rejects illegal ones', () => {
    expect(checkAttempt(p, 'd2d4').verdict).toBe('needs-engine')
    expect(checkAttempt(p, 'a1a8').verdict).toBe('illegal')
  })

  it('accepts any checkmate', () => {
    const mate = { ...p, fen: '6k1/5ppp/8/8/8/8/8/RR4K1 w - - 0 1', solution: 'a1a8' }
    expect(checkAttempt(mate, 'b1b8')).toEqual({ verdict: 'correct' })
  })

  it('judges an alternative by the winning chances it keeps', () => {
    const after = (cp: number): PositionAnalysis => ({
      fen: '',
      depth: 14,
      bestMove: null,
      // Opponent to move after your move, so the score is from their side.
      lines: [{ multipv: 1, depth: 14, score: { kind: 'cp', cp: -cp }, pv: [] }],
    })
    // Best keeps 55%. +0.20 for you is about 54.6%: just as good. -1.00 is about 41%: not.
    expect(isGoodAlternative(p, after(20))).toBe(true)
    expect(isGoodAlternative(p, after(-100))).toBe(false)
  })
})

describe('ordering', () => {
  it('keeps puzzles from one game in move order when they are due together', () => {
    const base = mistakePuzzlesFromGame(game(), 0)[0]
    const later = { ...base, id: 'g1:12' }
    const earlier = { ...base, id: 'g1:4' }
    expect(duePuzzles([later, earlier], 10).map((p) => p.id)).toEqual(['g1:4', 'g1:12'])
  })
})
