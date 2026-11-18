import { describe, expect, it } from 'vitest'
import {
  expectedMove,
  loadPuzzles,
  revealNextMove,
  selectPuzzle,
  startPuzzle,
  tryPuzzleMove,
  updatePuzzleRating,
  type Puzzle,
} from './puzzle'

// A hand-made mate-in-1: Black plays ...Kh8 (set-up move), White mates with Ra8#.
const mateIn1: Puzzle = {
  id: 'test1',
  fen: '6k1/5ppp/8/8/8/8/8/R5K1 b - - 0 1',
  moves: ['g8h8', 'a1a8'],
  rating: 800,
  themes: ['mateIn1', 'backRankMate'],
}

// Multi-move solutions are covered by the real puzzle data tests below.

describe('puzzle play', () => {
  it('plays the set-up move and gives the user the other side', () => {
    const s = startPuzzle(mateIn1)
    expect(s.userColor).toBe('w')
    expect(s.lastMove).toEqual({ from: 'g8', to: 'h8' })
    expect(s.status).toBe('playing')
  })

  it('accepts the solution', () => {
    const { result, state } = tryPuzzleMove(startPuzzle(mateIn1), 'a1a8')
    expect(result).toBe('solved')
    expect(state.status).toBe('solved')
    expect(state.wrong).toBe(0)
  })

  it('counts a wrong try and lets the user try again', () => {
    const s0 = startPuzzle(mateIn1)
    const wrong = tryPuzzleMove(s0, 'a1a7')
    expect(wrong.result).toBe('wrong')
    expect(wrong.state.fen).toBe(s0.fen) // board unchanged
    expect(wrong.state.wrong).toBe(1)
    expect(tryPuzzleMove(wrong.state, 'a1a8').result).toBe('solved')
  })

  it('rejects illegal moves without counting them', () => {
    const r = tryPuzzleMove(startPuzzle(mateIn1), 'a1h8')
    expect(r.result).toBe('illegal')
    expect(r.state.wrong).toBe(0)
  })

  it('accepts a different move that also checkmates', () => {
    // White has two rooks; either Ra8# or Rb8# mates.
    const twoWays: Puzzle = { ...mateIn1, fen: '6k1/5ppp/8/8/8/8/8/RR4K1 b - - 0 1' }
    expect(tryPuzzleMove(startPuzzle(twoWays), 'b1b8').result).toBe('solved')
  })

  it('shows the next move and marks the puzzle as not cleanly solved', () => {
    expect(expectedMove(startPuzzle(mateIn1))).toEqual({ from: 'a1', to: 'a8' })
    const revealed = revealNextMove(startPuzzle(mateIn1))
    expect(revealed.status).toBe('solved')
    expect(revealed.wrong).toBe(1)
  })
})

describe('real puzzle data', async () => {
  const puzzles = await loadPuzzles()

  it('loads thousands of puzzles with themes', () => {
    expect(puzzles.length).toBeGreaterThan(2000)
    expect(puzzles.every((p) => p.moves.length >= 2 && p.themes.length > 0)).toBe(true)
  })

  it('every puzzle can be solved by playing its solution', () => {
    for (const p of puzzles.slice(0, 300)) {
      let s = startPuzzle(p)
      while (s.status === 'playing') {
        const { state, result } = tryPuzzleMove(s, p.moves[s.next])
        expect(result === 'correct' || result === 'solved').toBe(true)
        s = state
      }
    }
  })
})

describe('selectPuzzle', () => {
  const pool: Puzzle[] = [
    { ...mateIn1, id: 'a', rating: 900, themes: ['fork'] },
    { ...mateIn1, id: 'b', rating: 1250, themes: ['fork'] },
    { ...mateIn1, id: 'c', rating: 1200, themes: ['pin'] },
  ]

  it('picks a puzzle with the theme near the rating', () => {
    expect(selectPuzzle(pool, { rating: 1200, themes: ['fork'], random: () => 0 })?.id).toBe('b')
  })

  it('widens the rating window when needed and skips puzzles already done', () => {
    expect(selectPuzzle(pool, { rating: 1200, themes: ['fork'], exclude: new Set(['b']), random: () => 0 })?.id).toBe('a')
  })

  it('returns null when nothing fits', () => {
    expect(selectPuzzle(pool, { rating: 1200, themes: ['skewer'] })).toBeNull()
  })
})

describe('updatePuzzleRating', () => {
  it('goes up more for beating a harder puzzle', () => {
    expect(updatePuzzleRating(1200, 1200, true)).toBe(1216)
    expect(updatePuzzleRating(1200, 1600, true)).toBeGreaterThan(1216)
  })
  it('goes down when failing', () => {
    expect(updatePuzzleRating(1200, 1200, false)).toBe(1184)
  })
})
