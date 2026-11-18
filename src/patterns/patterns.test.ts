import { describe, expect, it } from 'vitest'
import { findForks } from './forks'
import { findHangingPieces } from './hanging'
import { findLineTactics } from './lines'
import { sacrificedMaterial } from './sacrifice'
import { findUnansweredThreat, nullMoveFen } from './threats'

describe('findHangingPieces', () => {
  it('finds an undefended piece that is attacked', () => {
    // White bishop on c4 attacked by the knight on d6, no defenders.
    const hanging = findHangingPieces('4k3/8/3n4/8/2B5/8/8/4K3 w - - 0 1', 'w')
    expect(hanging).toEqual([{ square: 'c4', type: 'b', color: 'w', attackers: 1, defenders: 0, loss: 3 }])
  })

  it('finds a piece attacked more times than it is defended', () => {
    // White knight e5 is attacked by the rook on e8 and the bishop on c7, defended once by
    // the d4 pawn. Bxe5 dxe5 Rxe5 wins knight and pawn for a bishop: +1 for Black.
    const hanging = findHangingPieces('4r1k1/2b5/8/4N3/3P4/8/8/4K3 w - - 0 1', 'w')
    expect(hanging.map((h) => [h.square, h.attackers, h.defenders])).toEqual([['e5', 2, 1]])
  })

  it('ignores a piece that is attacked but adequately defended', () => {
    // Knight e5 attacked by a rook, defended by a pawn.
    expect(findHangingPieces('4r1k1/8/8/4N3/3P4/8/8/4K3 w - - 0 1', 'w')).toEqual([])
  })

  it('flags a defended queen attacked by a pawn', () => {
    // White queen d4 is attacked by the c5 pawn.
    const [q] = findHangingPieces('4k3/8/8/2p5/3Q4/8/8/4K3 b - - 0 1', 'w')
    expect(q).toMatchObject({ square: 'd4', type: 'q' })
  })

  it('never includes the king', () => {
    expect(findHangingPieces('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1', 'w')).toEqual([])
  })
})

describe('findForks', () => {
  it('finds a knight fork of king and rook', () => {
    // White knight on c7 checks the king on e8 and attacks the rook on a8.
    const forks = findForks('r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1', 'w')
    expect(forks).toHaveLength(1)
    expect(forks[0].forker).toMatchObject({ square: 'c7', type: 'n' })
    expect(forks[0].targets.map((t) => t.square).sort()).toEqual(['a8', 'e8'])
  })

  it('finds a pawn fork of two minor pieces', () => {
    // Pawn on e5 attacks knights on d6 and f6 (both worth more than a pawn).
    const forks = findForks('4k3/8/3n1n2/4P3/8/8/8/4K3 b - - 0 1', 'w', 'e5')
    expect(forks).toHaveLength(1)
  })

  it('ignores a "fork" when the forking piece can simply be taken', () => {
    // Knight c7 forks king and rook but the queen on d8 takes it.
    expect(findForks('r2qk3/2N5/8/8/8/8/8/4K3 b - - 0 1', 'w')).toEqual([])
  })

  it('ignores attacks on defended pieces of equal value', () => {
    // Knight attacks two defended knights: not a fork.
    expect(findForks('4k3/8/2n1n3/1p3p2/3N4/8/8/4K3 b - - 0 1', 'w')).toEqual([])
  })
})

describe('findLineTactics', () => {
  it('finds an absolute pin', () => {
    // White bishop b5 pins the knight on c6 to the king on e8.
    const [t] = findLineTactics('4k3/8/2n5/1B6/8/8/8/4K3 b - - 0 1', 'w')
    expect(t).toMatchObject({ kind: 'pin', absolute: true, front: { square: 'c6' }, back: { square: 'e8' } })
  })

  it('finds a relative pin to the queen', () => {
    // White bishop g5 pins the knight on f6 to the queen on d8.
    const [t] = findLineTactics('3qk3/8/5n2/6B1/8/8/8/4K3 b - - 0 1', 'w')
    expect(t).toMatchObject({ kind: 'pin', absolute: false, front: { type: 'n' }, back: { type: 'q' } })
  })

  it('finds a skewer of king and rook', () => {
    // White rook h1 checks the king on h5, and the black rook on h8 is behind it.
    const [t] = findLineTactics('7r/8/8/7k/8/8/8/4K2R b - - 0 1', 'w')
    expect(t).toMatchObject({ kind: 'skewer', front: { type: 'k' }, back: { square: 'h8' } })
  })

  it('ignores a line blocked by its own piece', () => {
    // White's own knight on c6 sits between the bishop and the black king.
    expect(findLineTactics('4k3/8/2N5/1B6/8/8/8/4K3 b - - 0 1', 'w')).toEqual([])
  })

  it('ignores two pieces of equal value', () => {
    expect(findLineTactics('8/8/8/r6r/8/8/8/R3K2k w - - 0 1', 'w')).toEqual([])
  })
})

describe('threats', () => {
  it('builds a null-move FEN with the other side to move', () => {
    expect(nullMoveFen('4k3/8/8/8/8/8/8/4K2R w K - 3 20')).toBe('4k3/8/8/8/8/8/8/4K2R b K - 3 20')
  })

  it('refuses a null move while in check', () => {
    expect(nullMoveFen('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1')).toBeNull()
  })

  it('reports a threat the move ignored', () => {
    const t = findUnansweredThreat({ kind: 'cp', cp: 0 }, { kind: 'cp', cp: 400 }, 'd8h4', 'd8h4', 15)
    expect(t?.move).toBe('d8h4')
    expect(t!.gain).toBeGreaterThan(15)
  })

  it('does not report a threat the move dealt with', () => {
    expect(findUnansweredThreat({ kind: 'cp', cp: 0 }, { kind: 'cp', cp: 400 }, 'd8h4', 'b8c6', 15)).toBeNull()
  })

  it('does not report small threats', () => {
    expect(findUnansweredThreat({ kind: 'cp', cp: 0 }, { kind: 'cp', cp: 30 }, 'd8h4', 'd8h4', 15)).toBeNull()
  })
})

describe('sacrificedMaterial', () => {
  it('measures a piece left to be taken', () => {
    // Bxf7+ in a position where the king recaptures: bishop (3) for pawn (1) = 2.
    expect(sacrificedMaterial('rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', 'c4f7')).toBe(2)
  })

  it('is zero for a safe move', () => {
    expect(sacrificedMaterial('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2e4')).toBe(0)
  })

  it('is zero for an even trade', () => {
    // Bxc6 dxc6: bishop for knight.
    expect(sacrificedMaterial('r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1', 'b5c6')).toBe(0)
  })
})
