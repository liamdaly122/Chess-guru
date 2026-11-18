import { describe, expect, it } from 'vitest'
import type { GameRecord } from '../storage/types'
import { nextLevelRating } from './adaptive'
import { countsForRating, lichessRatings, performanceRating, puzzleStartRating, ratingSummary, suggestedLevel } from './estimate'

let n = 0
const bot = (level: number, outcome: 'win' | 'loss' | 'draw', extra: Partial<GameRecord> = {}): GameRecord => ({
  id: `g${++n}`,
  source: 'bot',
  endedAt: n * 1000,
  white: { name: 'You' },
  black: { name: 'Maia', rating: level },
  userColor: 'w',
  result: outcome === 'win' ? '1-0' : outcome === 'loss' ? '0-1' : '1/2-1/2',
  termination: 'checkmate',
  moves: ['e2e4'],
  botLevel: level,
  ...extra,
})

describe('performance rating', () => {
  it('equals the opponent level for an even score', () => {
    const r = performanceRating([
      { opp: 1200, score: 1 },
      { opp: 1200, score: 0 },
    ])
    expect(r).toMatchObject({ rating: 1200, games: 2, wins: 1, losses: 1 })
  })

  it('is higher after wins, lower after losses, and finite for a clean sweep', () => {
    const wins = performanceRating([1, 1, 1, 1, 1].map(() => ({ opp: 1200, score: 1 })))!
    // 5.5 out of 6 with the imaginary draw: 1200 + 400 * log10(5.5 / 0.5) = about 1617.
    expect(wins.rating).toBe(1620)
    const losses = performanceRating([0, 0, 0].map(() => ({ opp: 1200, score: 0 })))!
    expect(losses.rating).toBeLessThan(1200)
  })

  it('gets more certain with more games', () => {
    const few = performanceRating([{ opp: 1000, score: 1 }, { opp: 1200, score: 0 }])!
    const many = performanceRating(Array.from({ length: 20 }, (_, i) => ({ opp: 1100, score: i % 2 })))!
    expect(many.plusMinus).toBeLessThan(few.plusMinus)
  })
})

describe('rating summary', () => {
  it("only counts bot games with no takebacks or hints from the normal start", () => {
    expect(countsForRating(bot(1200, 'win'))).toBe(true)
    expect(countsForRating(bot(1200, 'win', { takebacks: 1 }))).toBe(false)
    expect(countsForRating(bot(1200, 'win', { hintedPlies: [4] }))).toBe(false)
    expect(countsForRating(bot(1200, 'win', { startFen: '8/8/8/8/8/8/8/K6k w - - 0 1' }))).toBe(false)
    expect(countsForRating({ ...bot(1200, 'win'), source: 'lichess' })).toBe(false)
  })

  it('needs a few games, then estimates and shows the trend', () => {
    expect(ratingSummary([bot(1200, 'win'), bot(1200, 'win')])).toEqual({ estimate: null, counted: 2, trend: null })
    // Ten losses at 1200, then ten wins at 1200: the estimate has gone up.
    const games = [...Array.from({ length: 10 }, () => bot(1200, 'loss')), ...Array.from({ length: 10 }, () => bot(1200, 'win'))]
    const s = ratingSummary(games)
    expect(s.estimate?.rating).toBe(1200)
    expect(s.trend).toBeGreaterThan(100)
  })

  it('suggests the nearest bot level', () => {
    expect(suggestedLevel(1150).rating).toBe(1200)
    expect(suggestedLevel(1100).rating).toBe(1200)
    expect(suggestedLevel(1080).rating).toBe(1000)
    expect(suggestedLevel(100).rating).toBe(400)
  })

  it('reads your latest Lichess rating per speed', () => {
    const lichess = (speed: string, rating: number, endedAt: number): GameRecord => ({
      ...bot(0, 'win'),
      source: 'lichess',
      speed,
      endedAt,
      white: { name: 'Liam', rating },
      botLevel: undefined,
    })
    expect(lichessRatings([lichess('rapid', 1500, 1), lichess('blitz', 1400, 2), lichess('blitz', 1450, 3)])).toEqual([
      { speed: 'blitz', rating: 1450 },
      { speed: 'rapid', rating: 1500 },
    ])
  })

  it('starts the puzzle rating at your estimate before your first puzzle', () => {
    const est = performanceRating([{ opp: 1000, score: 0.5 }])
    expect(puzzleStartRating(1200, 0, est)).toBe(1000)
    expect(puzzleStartRating(1200, 3, est)).toBe(1200)
    expect(puzzleStartRating(1200, 0, null)).toBe(1200)
  })
})

describe('adaptive bot', () => {
  it('moves up after a win, down after a loss, stays after a draw', () => {
    expect(nextLevelRating(1200, 'win')).toBe(1400)
    expect(nextLevelRating(1200, 'loss')).toBe(1000)
    expect(nextLevelRating(1200, 'draw')).toBe(1200)
  })

  it('keeps the level after a win with takebacks, and stays within the levels', () => {
    expect(nextLevelRating(1200, 'win', 2)).toBe(1200)
    expect(nextLevelRating(400, 'loss')).toBe(400)
    expect(nextLevelRating(3190, 'win')).toBe(3190)
  })
})
