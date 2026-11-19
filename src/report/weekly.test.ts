import { describe, expect, it } from 'vitest'
import type { LessonCategory, PlyReview } from '../review/types'
import type { GameRecord, PuzzleAttempt } from '../storage/types'
import { nextWeek, openingResults, previousWeek, weekFromKey, weekLabel, weekOf, weeklyReport, type ReportInput } from './weekly'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const at = (d: number, h = 12) => new Date(2026, 10, d, h).getTime() // November 2026; the 16th is a Monday

function ply(phase: PlyReview['phase'], lost: number, rating: 'good' | 'mistake' | 'blunder', category?: LessonCategory, pattern?: string): PlyReview {
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
    ...(category ? { note: { text: '', tip: '', category, ...(pattern ? { pattern } : {}) } } : {}),
  }
}

function game(id: string, endedAt: number, opts: Partial<GameRecord> & { accuracy?: number; plies?: PlyReview[] } = {}): GameRecord {
  const { accuracy, plies, ...rest } = opts
  return {
    id,
    source: 'bot',
    endedAt,
    white: { name: 'You' },
    black: { name: 'Bot', rating: 1200 },
    userColor: 'w',
    result: '1-0',
    termination: 'checkmate',
    moves: [],
    botLevel: 1200,
    review: plies ? { startEval: null, plies, accuracy: accuracy ?? null, lessons: [], complete: true } : undefined,
    ...rest,
  }
}

const empty: ReportInput = { games: [], puzzleDays: {}, goalDays: [], attempts: [], threats: [] }

describe('weeks', () => {
  it('runs Monday to Sunday', () => {
    const w = weekOf(at(19)) // Thursday
    expect(w.key).toBe('2026-11-16')
    expect(weekOf(at(16, 0)).key).toBe('2026-11-16')
    expect(weekOf(at(22, 23)).key).toBe('2026-11-16') // Sunday night
    expect(weekOf(at(23, 0)).key).toBe('2026-11-23')
    expect(previousWeek(w).key).toBe('2026-11-09')
    expect(nextWeek(w).key).toBe('2026-11-23')
    expect(weekFromKey('2026-11-16')).toEqual(w)
    expect(weekFromKey('2026-11-17')).toBeNull() // not a Monday
    expect(weekLabel(w)).toBe('16 to 22 Nov')
    expect(weekLabel(weekOf(at(30)))).toBe('30 Nov to 6 Dec')
  })
})

describe('weekly report', () => {
  const w = weekOf(at(19))
  const input: ReportInput = {
    ...empty,
    games: [
      // The week before: accuracy 70.
      game('old', at(10), { accuracy: 70, plies: [ply('middlegame', 0, 'good')] }),
      game('a', at(17), {
        accuracy: 80,
        opening: 'Italian Game: Two Knights Defense',
        plies: [ply('middlegame', 20, 'blunder', 'forks', 'fork-knight'), ply('middlegame', 12, 'mistake', 'forks', 'fork-knight'), ply('endgame', 1, 'good')],
      }),
      game('b', at(18), { accuracy: 76, opening: 'Italian Game', result: '0-1', plies: [ply('opening', 2, 'good')] }),
      game('c', at(20), { opening: 'Sicilian Defense: Najdorf', userColor: 'b', result: '0-1', source: 'lichess' }),
      game('next', at(24), { accuracy: 99, plies: [] }),
    ],
    puzzleDays: { '2026-11-15': 9, '2026-11-17': 5, '2026-11-22': 3 },
    goalDays: ['2026-11-17', '2026-11-22', '2026-11-23'],
    attempts: [
      { id: '1', puzzleId: 'p1', at: at(17), solved: true, themes: [], puzzleRating: 1200, ratingBefore: 1200, ratingAfter: 1216 },
      { id: '2', puzzleId: 'p2', at: at(18), solved: false, themes: [], puzzleRating: 1200, ratingBefore: 1216, ratingAfter: 1201 },
    ] as PuzzleAttempt[],
    threats: [
      { at: at(17), kind: 'threat', verdict: 'right' },
      { at: at(18), kind: 'quiet', verdict: 'wrong' },
      { at: at(5), kind: 'threat', verdict: 'right' },
    ],
  }
  const r = weeklyReport(w, input)

  it('counts the week only', () => {
    expect(r.games).toMatchObject({ total: 3, bot: 2, lichess: 1, win: 2, draw: 0, loss: 1, reviewed: 2, unreviewed: ['c'] })
    expect(r.puzzles).toBe(8)
    expect(r.goalDays).toBe(2)
    expect(r.rated).toEqual({ tried: 2, solved: 1, from: 1200, to: 1201 })
    expect(r.threats).toEqual({ asked: 2, right: 1 })
  })

  it('compares accuracy with the week before and finds the costliest mistakes', () => {
    expect(r.accuracy).toBe(78)
    expect(r.accuracyBefore).toBe(70)
    expect(r.mistakes).toBe(1)
    expect(r.blunders).toBe(1)
    expect(r.topPattern).toMatchObject({ pattern: 'fork-knight', count: 2 })
    expect(r.costliest).toMatchObject({ category: 'forks', count: 2 })
    expect(r.summary).toBe('You played 3 games (2 wins, 1 loss) and did 8 puzzles. Your accuracy was 78%, up 8 points on the week before.')
  })

  it('suggests the lesson for the costliest kind of mistake', () => {
    expect(r.focus).toMatchObject({ kind: 'lesson', category: 'forks', title: 'Watch out for forks' })
  })

  it('groups openings by family and colour', () => {
    expect(r.openings.map((o) => [o.name, o.color, o.games, o.score])).toEqual([
      ['Italian Game', 'w', 2, 0.5],
      ['Sicilian Defense', 'b', 1, 1],
    ])
    expect(r.best?.name).toBe('Sicilian Defense')
    expect(r.worst?.name).toBe('Italian Game')
    expect(openingResults([game('x', 1, { opening: 'French Defense', result: '1/2-1/2' })])[0].score).toBe(0.5)
  })

  it('asks for games or reviews when there is nothing to learn from', () => {
    const none = weeklyReport(w, empty)
    expect(none.focus.kind).toBe('play')
    expect(none.summary).toBe('Nothing played this week.')
    const unreviewed = weeklyReport(w, { ...empty, games: [game('u', at(17))], puzzleDays: { '2026-11-18': 1 } })
    expect(unreviewed.focus.kind).toBe('review')
    expect(unreviewed.summary).toBe('You played 1 game (1 win) and did 1 puzzle.')
  })

  it('falls back to the weakest phase', () => {
    const endgame = weeklyReport(w, {
      ...empty,
      games: [game('e', at(17), { accuracy: 60, plies: [ply('endgame', 9, 'good'), ply('endgame', 8, 'good'), ply('endgame', 9, 'good'), ply('endgame', 9, 'good'), ply('endgame', 9, 'good')] })],
    })
    expect(endgame.focus.kind).toBe('endgames')
  })
})
