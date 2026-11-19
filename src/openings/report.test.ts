import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import bookData from '../data/openings.json'
import type { PlyReview } from '../review/types'
import type { GameRecord } from '../storage/types'
import type { BookData } from './book'
import { costingAndWorking, openingGame, openingReport, openingSummary } from './report'

const book = bookData as unknown as BookData

function game(id: string, sans: string, opts: Partial<GameRecord> = {}): GameRecord {
  const c = new Chess()
  const moves = sans.split(' ').map((s) => c.move(s).lan)
  return {
    id,
    source: 'lichess',
    endedAt: Number(id.replace(/\D/g, '')) || 1,
    white: { name: 'You' },
    black: { name: 'Them' },
    userColor: 'w',
    result: '1-0',
    termination: 'resignation',
    moves,
    ...opts,
  }
}

/** A complete review where your 10th move leaves you at `win` Win%. */
function reviewAt10(color: 'w' | 'b', win: number): GameRecord['review'] {
  const plies = Array.from({ length: 20 }, (_, i): PlyReview => ({
    san: 'x',
    uci: 'a2a3',
    color: i % 2 === 0 ? 'w' : 'b',
    fenBefore: new Chess().fen(),
    fenAfter: new Chess().fen(),
    evalAfter: null,
    phase: 'opening',
    judgement: {
      rating: 'good',
      bestUci: null,
      bestSan: null,
      winBefore: win,
      winAfter: (i === 18 && color === 'w') || (i === 19 && color === 'b') ? win : 50,
      scoreBefore: { kind: 'cp', cp: 0 },
      scoreAfter: { kind: 'cp', cp: 0 },
      bestLineSan: [],
    },
  }))
  return { startEval: null, plies, accuracy: 80, lessons: [], complete: true }
}

const ITALIAN = 'e4 e5 Nf3 Nc6 Bc4 Bc5'
const games = [
  // You leave the book with 4.Kf1 and win.
  game('g1', `${ITALIAN} Kf1`, { opening: 'Italian Game: Giuoco Piano', review: reviewAt10('w', 72) }),
  // They leave it with 4...Kf8, and you lose.
  game('g2', `${ITALIAN} c3 Kf8`, { opening: 'Italian Game: Giuoco Pianissimo', result: '0-1', review: reviewAt10('w', 30) }),
  // 4.Kf1 again, a loss.
  game('g3', `${ITALIAN} Kf1`, { opening: 'Italian Game: Giuoco Piano', result: '0-1' }),
  // As Black: a Sicilian, won.
  game('g4', 'e4 c5 Nf3 d6', { opening: 'Sicilian Defense: Modern Variations', userColor: 'b', result: '0-1' }),
  // Not counted: unfinished, and from a set position.
  game('g5', ITALIAN, { opening: 'Italian Game', result: '*' }),
  game('g6', 'e4 e5', { startFen: '8/8/8/8/8/8/k7/K7 w - - 0 1' }),
]

describe('opening report', () => {
  it('reads one game: book length, who left it and the move out', () => {
    const g = openingGame(games[0], book)!
    expect(g).toMatchObject({ outcome: 'win', bookPlies: 6, leftBy: 'you', exit: '4.Kf1', winAt10: 72, fullName: 'Italian Game: Giuoco Piano' })
    expect(openingGame(games[1], book)).toMatchObject({ bookPlies: 7, leftBy: 'them', exit: null })
    expect(openingGame(games[4], book)).toBeNull()
    expect(openingGame(games[5], book)).toBeNull()
  })

  it('groups by family and colour', () => {
    const report = openingReport(games, book)
    expect(report.map((s) => [s.name, s.color, s.games])).toEqual([
      ['Italian Game', 'w', 3],
      ['Sicilian Defense', 'b', 1],
    ])
    const italian = report[0]
    expect(italian).toMatchObject({ win: 1, loss: 2, draw: 0, youLeft: 2, theyLeft: 1, exit: { move: '4.Kf1', count: 2 } })
    expect(italian.score).toBeCloseTo(1 / 3)
    expect(italian.net).toBe(-0.5)
    expect(italian.bookMoves).toBeCloseTo((6 + 7 + 6) / 3 / 2)
    expect(italian.at10).toEqual({ games: 2, average: 51, ahead: 1, level: 0, behind: 1 })
    expect(italian.variations).toEqual([
      { name: 'Italian Game: Giuoco Piano', games: 2 },
      { name: 'Italian Game: Giuoco Pianissimo', games: 1 },
    ])
    expect(italian.gameIds).toEqual(['g3', 'g2', 'g1'])
  })

  it('says which openings cost you points', () => {
    const report = openingReport(games, book)
    const { costing, working } = costingAndWorking(report)
    expect(costing.map((s) => s.name)).toEqual(['Italian Game'])
    expect(working).toEqual([]) // the Sicilian has only 1 game
    expect(openingSummary(report)).toBe(
      "You've played 2 openings in 4 games. Italian Game as White costs you the most: 1 won, 2 lost in 3 games.",
    )
    expect(openingSummary([])).toMatch(/^No finished games/)
  })
})
