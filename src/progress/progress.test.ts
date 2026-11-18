import { describe, expect, it } from 'vitest'
import { countPieces, gamePhase } from '../review/gamePhase'
import type { LessonCategory, PlyReview } from '../review/types'
import type { GameRecord } from '../storage/types'
import { recommendedThemes } from '../puzzles/themes'
import { progressStats } from './stats'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const ENDGAME = '8/5k2/8/3r4/8/2B5/5K2/8 w - - 0 50'

describe('gamePhase', () => {
  it('counts queens, rooks, bishops and knights', () => {
    expect(countPieces(START)).toBe(14)
    expect(countPieces(ENDGAME)).toBe(2)
  })
  it('classes early moves as opening and late ones as middlegame', () => {
    expect(gamePhase(START, 0)).toBe('opening')
    expect(gamePhase(START, 30)).toBe('middlegame')
  })
  it('keeps book moves in the opening even after move 10', () => {
    expect(gamePhase(START, 30, true)).toBe('opening')
  })
  it('classes positions with few pieces as endgame', () => {
    expect(gamePhase(ENDGAME, 5)).toBe('endgame')
  })
  it('moves on to the middlegame early after lots of trades', () => {
    // Queens and a knight each traded by move 8: 10 pieces left.
    expect(gamePhase('r1b1kb1r/pppp1ppp/5n2/8/8/5N2/PPPP1PPP/R1B1KB1R w KQkq - 0 8', 14)).toBe('middlegame')
  })
})

/** A user (White) move with a rating, a Win% loss and optionally a mistake category. */
function ply(phase: PlyReview['phase'], lost: number, rating: 'good' | 'mistake' | 'blunder' | 'book', category?: LessonCategory): PlyReview {
  return {
    san: 'x',
    uci: 'a2a3',
    color: 'w',
    fenBefore: START,
    fenAfter: START,
    evalAfter: null,
    phase,
    judgement: {
      rating,
      bestUci: null,
      bestSan: null,
      winBefore: 50 + lost,
      winAfter: 50,
      scoreBefore: { kind: 'cp', cp: 0 },
      scoreAfter: { kind: 'cp', cp: 0 },
      bestLineSan: [],
    },
    ...(category ? { note: { text: '', tip: '', category } } : {}),
  }
}

function game(id: string, endedAt: number, accuracy: number, plies: PlyReview[], result: GameRecord['result'] = '1-0'): GameRecord {
  return {
    id,
    source: 'bot',
    endedAt,
    white: { name: 'You' },
    black: { name: 'Bot' },
    userColor: 'w',
    result,
    termination: 'checkmate',
    moves: [],
    review: { startEval: null, plies, accuracy, lessons: [], complete: true },
  }
}

describe('progressStats', () => {
  const games = [
    game('b', 2000, 80, [ply('opening', 0, 'book'), ply('middlegame', 20, 'blunder', 'forks'), ply('endgame', 2, 'good')], '0-1'),
    game('a', 1000, 60, [ply('opening', 12, 'mistake', 'loose-pieces'), ply('middlegame', 3, 'good')]),
    { ...game('c', 3000, 0, []), review: undefined }, // not reviewed: ignored for stats
  ]
  const s = progressStats(games, { minPhaseMoves: 1 })

  it('counts games, reviews and results', () => {
    expect(s.games).toBe(3)
    expect(s.reviewed).toBe(2)
    expect(s.record).toEqual({ win: 2, loss: 1, draw: 0 })
  })

  it('lists accuracy oldest first with a rolling average', () => {
    expect(s.accuracyTrend.map((p) => [p.id, p.accuracy, p.rolling])).toEqual([
      ['a', 60, 60],
      ['b', 80, 70],
    ])
    expect(s.avgAccuracy).toBe(70)
  })

  it('adds up losses by phase, ignoring book moves', () => {
    const byPhase = Object.fromEntries(s.phases.map((p) => [p.phase, p]))
    expect(byPhase.opening).toMatchObject({ moves: 1, winLost: 12, mistakes: 1 })
    expect(byPhase.middlegame).toMatchObject({ moves: 2, winLost: 23, blunders: 1, perMove: 11.5 })
    expect(byPhase.endgame).toMatchObject({ moves: 1, winLost: 2 })
    expect(s.weakestPhase).toBe('opening') // 12 per move beats 11.5
  })

  it('ranks kinds of mistake by winning chances lost', () => {
    expect(s.patterns.map((p) => [p.category, p.count, p.winLost])).toEqual([
      ['forks', 1, 20],
      ['loose-pieces', 1, 12],
    ])
  })

  it('recommends puzzle themes for the costliest mistakes first', () => {
    expect(recommendedThemes(s, 4)).toEqual(['fork', 'doubleCheck', 'hangingPiece', 'trappedPiece'])
  })

  it('has sensible defaults with no games', () => {
    const empty = progressStats([])
    expect(empty.avgAccuracy).toBeNull()
    expect(empty.weakestPhase).toBeNull()
    expect(recommendedThemes(empty, 3)).toEqual(['hangingPiece', 'fork', 'mateIn1'])
  })
})
