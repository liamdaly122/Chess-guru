import { describe, expect, it } from 'vitest'
import { see } from './see'

describe('see (static exchange evaluation)', () => {
  it('wins an undefended piece', () => {
    // White pawn e4 can take the black knight on d5.
    expect(see('4k3/8/8/3n4/4P3/8/8/4K3 w - - 0 1', 'd5', 'w')).toBe(3)
  })

  it('is zero for an even pawn trade', () => {
    expect(see('4k3/8/2p5/3p4/4P3/8/8/4K3 w - - 0 1', 'd5', 'w')).toBe(0)
  })

  it('is negative when the only capture loses material', () => {
    // Knight takes a pawn defended by a pawn: wins 1, loses 3.
    expect(see('4k3/8/2p5/3p4/8/4N3/8/4K3 w - - 0 1', 'd5', 'w')).toBe(-2)
  })

  it('sees that a defended queen still loses to a pawn', () => {
    // Black queen d5 defended by the rook on d8 and the knight on f6; white pawn e4 attacks it.
    expect(see('3rk3/8/5n2/3q4/4P3/8/8/4K3 w - - 0 1', 'd5', 'w')).toBe(8)
  })

  it('counts pieces lined up behind each other (x-rays)', () => {
    // Doubled white rooks against a black rook defended once by a rook behind it.
    // Rxd5 Rxd5 Rxd5: White wins rook + rook for one rook = +5.
    expect(see('3rk3/8/8/3r4/8/8/3R4/3RK3 w - - 0 1', 'd5', 'w')).toBe(5)
  })

  it('stops capturing when continuing would lose material', () => {
    // Queen takes a defended pawn: the sequence stops, so the result is pawn minus queen.
    expect(see('4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1', 'd5', 'w')).toBe(-8)
  })

  it('does not let a king capture into a defended square', () => {
    // White king on e4 next to a black pawn on d5 defended by c6.
    expect(see('4k3/8/2p5/3p4/4K3/8/8/8 w - - 0 1', 'd5', 'w')).toBe(0)
  })

  it('lets a king take an undefended piece', () => {
    expect(see('4k3/8/8/3p4/4K3/8/8/8 w - - 0 1', 'd5', 'w')).toBe(1)
  })

  it('returns 0 when nothing attacks the square', () => {
    expect(see('4k3/8/8/3p4/8/8/8/4K3 w - - 0 1', 'd5', 'w')).toBe(0)
  })
})
