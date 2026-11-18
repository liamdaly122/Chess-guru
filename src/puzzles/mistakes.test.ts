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
  groupByPosition,
  mergePuzzle,
  patternSet,
  patternStats,
  todaysSet,
  type MistakePuzzle,
} from './mistakes'
import { mainPattern, patternOf } from './patterns'
import type { PlyReview } from '../review/types'

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
      id: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -', // the position, without move counters
      fen: FEN,
      pattern: 'loose-piece', // from the category, as this older note has no pattern
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
    const later = { ...base, id: 'b', ply: 12 }
    const earlier = { ...base, id: 'a', ply: 4 }
    expect(duePuzzles([later, earlier], 10).map((p) => p.ply)).toEqual([4, 12])
  })
})

/** A reviewed game with one of your moves per entry: [winBefore, winAfter, pattern, fen]. */
function gameWith(id: string, endedAt: number, moves: [number, number, string, string][]): GameRecord {
  const plies: PlyReview[] = moves.map(([winBefore, winAfter, pattern, fen], i) => ({
    san: `m${i}`,
    uci: 'e2e4',
    color: 'w',
    fenBefore: `${fen} w - - 0 1`,
    fenAfter: '',
    evalAfter: null,
    judgement: {
      rating: winBefore - winAfter >= 15 ? 'blunder' : 'mistake',
      bestUci: 'd2d4',
      bestSan: 'd4',
      winBefore,
      winAfter,
      scoreBefore: { kind: 'cp', cp: 0 },
      scoreAfter: { kind: 'cp', cp: 0 },
      bestLineSan: [],
    },
    note: { text: `note ${i}`, tip: 'tip', category: 'general', pattern },
  }))
  return { ...game(), id, endedAt, review: { startEval: null, accuracy: 50, lessons: [], complete: true, plies } }
}

describe('only the mistakes that matter', () => {
  it('skips moves when already lost or still clearly winning, and keeps the 3 costliest per game', () => {
    const g = gameWith('g', 1, [
      [10, 0, 'fork-knight', 'lost'], // already lost
      [99, 88, 'fork-knight', 'won'], // still winning
      [60, 50, 'loose-piece', 'a'], // loses 10
      [60, 20, 'fork-knight', 'b'], // loses 40
      [50, 35, 'missed-mate', 'c'], // loses 15
      [55, 30, 'ignored-threat', 'd'], // loses 25
    ])
    const ps = mistakePuzzlesFromGame(g, 5)
    expect(ps.map((p) => p.fen.split(' ')[0])).toEqual(['b', 'c', 'd']) // costliest 3, in move order
    expect(ps.map((p) => p.pattern)).toEqual(['fork-knight', 'missed-mate', 'ignored-threat'])
  })

  it('makes one puzzle for the same position across games', () => {
    const a = mistakePuzzlesFromGame(gameWith('g1', 100, [[60, 20, 'fork-knight', 'same']]), 0)
    const b = mistakePuzzlesFromGame(gameWith('g2', 200, [[60, 25, 'fork-knight', 'same']]), 0)
    const merged = groupByPosition([...a, ...b], 300)
    expect(merged.size).toBe(1)
    const p = [...merged.values()][0]
    expect(p.occurrences.map((o) => o.gameId)).toEqual(['g1', 'g2'])
    expect(p.gameId).toBe('g2') // latest shown
  })

  it('takes the more precise pattern when an older game is re-analysed', () => {
    const old = mistakePuzzlesFromGame(gameWith('g1', 100, [[60, 20, 'fork', 'p']]), 0)[0]
    const redone = mistakePuzzlesFromGame(gameWith('g1', 100, [[60, 20, 'fork-knight', 'p']]), 0)[0]
    expect(mergePuzzle({ ...old, box: 2 }, redone, 1000)).toMatchObject({ pattern: 'fork-knight', box: 2 })
  })

  it('starts the puzzle again if you make the same mistake after practising it', () => {
    const first = { ...mistakePuzzlesFromGame(gameWith('g1', 100, [[60, 20, 'loose-piece', 'p']]), 0)[0], box: 3, attempts: 3, lastAt: 500, dueAt: 9000 }
    const again = mistakePuzzlesFromGame(gameWith('g2', 800, [[60, 20, 'loose-piece', 'p']]), 0)[0]
    expect(mergePuzzle(first, again, 1000)).toMatchObject({ box: 0, dueAt: 800, attempts: 3 })
    // The same game again changes nothing.
    expect(mergePuzzle(first, mistakePuzzlesFromGame(gameWith('g1', 100, [[60, 20, 'loose-piece', 'p']]), 0)[0], 1000)).toBe(first)
  })
})

describe('patterns and daily sets', () => {
  const now = 100 * DAY
  const make = (gameId: string, pattern: string, fen: string, extra: Partial<MistakePuzzle> = {}) => ({
    ...mistakePuzzlesFromGame(gameWith(gameId, now - DAY, [[60, 20, pattern, fen]]), now)[0],
    ...extra,
  })
  const puzzles = [
    make('g1', 'fork-knight', 'a'),
    make('g2', 'fork-knight', 'b'),
    make('g3', 'fork-knight', 'c'),
    make('g1', 'loose-piece', 'd'),
    make('g2', 'loose-piece', 'e'),
    make('g3', 'missed-mate', 'f'),
    make('g4', 'missed-mate', 'g', { box: 2, attempts: 2, dueAt: now + DAY }),
  ]

  it('ranks patterns by how often they happen', () => {
    const stats = patternStats(puzzles, now)
    expect(stats.map((s) => [s.pattern, s.times, s.games])).toEqual([
      ['fork-knight', 3, 3],
      ['loose-piece', 2, 2],
      ['missed-mate', 2, 2],
    ])
    expect(stats[0].label).toBe('Walking into knight forks')
    expect(stats.find((s) => s.pattern === 'missed-mate')).toMatchObject({ due: 1, improving: false })
  })

  it("serves today's set from the most common patterns, up to the daily limit", () => {
    const set = todaysSet(puzzles, now)
    expect(set.queue.map((p) => p.pattern)).toEqual(['fork-knight', 'fork-knight', 'fork-knight', 'loose-piece', 'loose-piece'])
    expect(set.waiting).toBe(1)
    // Two done today: three left.
    const done = puzzles.map((p, i) => (i < 2 ? { ...p, lastAt: now, dueAt: now + DAY } : p))
    expect(todaysSet(done, now)).toMatchObject({ doneToday: 2 })
    expect(todaysSet(done, now).queue).toHaveLength(3)
  })

  it('builds a solve set for one pattern, due positions first', () => {
    expect(patternSet(puzzles, 'missed-mate', now).map((p) => p.fen[0])).toEqual(['f', 'g'])
  })

  it('reads the pattern from the coaching fact', () => {
    const piece = (type: 'n' | 'q' | 'p' | 'b') => ({ square: 'e5' as const, type, color: 'b' as const })
    expect(patternOf({ type: 'allowed-fork', replySan: 'Nc7', forker: piece('n'), targets: [] })).toBe('fork-knight')
    expect(patternOf({ type: 'allowed-fork', replySan: 'Bd5', forker: piece('b'), targets: [] })).toBe('fork')
    expect(patternOf({ type: 'missed-mate', mateIn: 2, bestSan: 'Qh7+' })).toBe('missed-mate')
    expect(patternOf(undefined)).toBe('general')
  })
})

describe("a game's main mistake", () => {
  it('is the most common pattern among its notes', () => {
    const knight = { square: 'e5' as const, type: 'n' as const, color: 'b' as const }
    const fork = { fact: { type: 'allowed-fork' as const, replySan: 'Nc7', forker: knight, targets: [] } }
    expect(mainPattern([null, fork, 'pending', { fact: undefined }, fork])).toEqual({ pattern: 'fork-knight', count: 2 })
    expect(mainPattern([null, 'pending'])).toBeNull()
  })
})
