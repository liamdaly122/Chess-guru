import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { randomLegalMove } from './StockfishOpponent'

describe('randomLegalMove', () => {
  it('returns a legal move in UCI notation', () => {
    const fen = new Chess().fen()
    for (const r of [0, 0.3, 0.999]) {
      const uci = randomLegalMove(fen, () => r)!
      const game = new Chess(fen)
      expect(() => game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) })).not.toThrow()
    }
  })

  it('includes the promotion piece', () => {
    // Only legal moves are king moves and the pawn promotions.
    const uci = randomLegalMove('8/P7/8/8/8/8/8/k6K w - - 0 1', () => 0)
    expect(uci).toMatch(/^(a7a8[qrbn]|h1\w\d)$/)
  })

  it('returns null when there are no legal moves', () => {
    expect(randomLegalMove('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).toBeNull()
  })
})
