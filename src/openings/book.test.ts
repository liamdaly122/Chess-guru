import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { bookMoves, bookStatus, loadBook, positionKey } from './book'

/** Every position of a game given in standard notation, start included. */
function positions(sans: string[], startFen?: string): string[] {
  const chess = startFen ? new Chess(startFen) : new Chess()
  const out = [chess.fen()]
  for (const s of sans) {
    chess.move(s)
    out.push(chess.fen())
  }
  return out
}

describe('opening book (real Lichess data)', async () => {
  const book = await loadBook()

  it('names the Italian Game', () => {
    const s = bookStatus(book, positions(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']))
    expect(s.inBook).toEqual([true, true, true, true, true])
    expect(s.opening).toEqual({ eco: 'C50', name: 'Italian Game' })
    expect(s.leftBookAt).toBeNull()
  })

  it('reports where the game left the book', () => {
    const s = bookStatus(book, positions(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'Kf1', 'Nf6', 'Kg1']))
    expect(s.leftBookAt).not.toBeNull()
    expect(s.inBook[s.leftBookAt!]).toBe(false)
    expect(s.opening?.name).toMatch(/Italian Game/)
  })

  it('recognises a transposition into a named line', () => {
    // Sicilian reached with 1.Nf3 c5 2.e4 instead of 1.e4 c5 2.Nf3.
    const direct = bookStatus(book, positions(['e4', 'c5', 'Nf3']))
    const transposed = bookStatus(book, positions(['Nf3', 'c5', 'e4']))
    expect(transposed.inBook.every(Boolean)).toBe(true)
    expect(transposed.opening?.name).toBe(direct.opening?.name)
  })

  it('treats games from a custom position as out of book', () => {
    const s = bookStatus(book, positions(['Ra8#'], '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'))
    expect(s.inBook).toEqual([false])
    expect(s.leftBookAt).toBeNull()
  })

  it('lists book moves from the start, named ones first', () => {
    const moves = bookMoves(book, new Chess().fen())
    const sans = moves.map((m) => m.san)
    expect(sans).toEqual(expect.arrayContaining(['e4', 'd4', 'c4', 'Nf3']))
    expect(moves.find((m) => m.san === 'e4')?.opening?.name).toBe("King's Pawn Game")
  })

  it('uses position keys without move counters', () => {
    expect(positionKey('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -',
    )
  })
})
