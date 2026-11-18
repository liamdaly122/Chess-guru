import { describe, expect, it } from 'vitest'
import { formatScore, negate, scoreFromUci, toWhitePov, winPercent, winningChances, type Score } from './score'

const cp = (n: number): Score => ({ kind: 'cp', cp: n })
const mate = (moves: number, forUs: boolean): Score => ({ kind: 'mate', moves, forUs })

describe('scoreFromUci', () => {
  it('reads centipawns', () => expect(scoreFromUci('cp', -35)).toEqual(cp(-35)))
  it('reads a mate for the side to move', () => expect(scoreFromUci('mate', 3)).toEqual(mate(3, true)))
  it('reads a mate against the side to move', () => expect(scoreFromUci('mate', -2)).toEqual(mate(2, false)))
  it('reads "mate 0" as the side to move being checkmated', () => expect(scoreFromUci('mate', 0)).toEqual(mate(0, false)))
})

describe('negate and toWhitePov', () => {
  it('flips centipawns', () => expect(negate(cp(120))).toEqual(cp(-120)))
  it('flips who is mating, including mate 0', () => {
    expect(negate(mate(0, false))).toEqual(mate(0, true))
    expect(negate(mate(4, true))).toEqual(mate(4, false))
  })
  it('converts to White point of view', () => {
    expect(toWhitePov(cp(50), 'w')).toEqual(cp(50))
    expect(toWhitePov(cp(50), 'b')).toEqual(cp(-50))
  })
})

describe('winningChances (Lichess formula)', () => {
  it('is 0 for a level position', () => expect(winningChances(cp(0))).toBe(0))
  it('matches the Lichess curve at +1 pawn', () => {
    // 2 / (1 + e^(-0.368208)) - 1
    expect(winningChances(cp(100))).toBeCloseTo(0.18203, 4)
    expect(winPercent(cp(100))).toBeCloseTo(59.1, 1)
  })
  it('is symmetrical', () => expect(winningChances(cp(-300))).toBeCloseTo(-winningChances(cp(300)), 10))
  it('caps centipawns at 1000', () => expect(winningChances(cp(5000))).toBe(winningChances(cp(1000))))
  it('ranks any mate above any centipawn score', () => {
    expect(winningChances(mate(10, true))).toBeGreaterThan(winningChances(cp(5000)))
    expect(winningChances(mate(25, true))).toBe(winningChances(mate(10, true)))
  })
  it('ranks shorter mates higher', () => {
    expect(winningChances(mate(1, true))).toBeGreaterThan(winningChances(mate(5, true)))
  })
  it('treats being checkmated as a near-certain loss', () => {
    expect(winPercent(mate(0, false))).toBeLessThan(0.1)
    expect(winPercent(mate(0, true))).toBeGreaterThan(99.9)
  })
})

describe('formatScore', () => {
  it('formats pawns', () => {
    expect(formatScore(cp(43))).toBe('+0.4')
    expect(formatScore(cp(-210))).toBe('-2.1')
    expect(formatScore(cp(0))).toBe('0.0')
    expect(formatScore(cp(1234))).toBe('+12')
  })
  it('formats mates', () => {
    expect(formatScore(mate(3, true))).toBe('M3')
    expect(formatScore(mate(2, false))).toBe('-M2')
    expect(formatScore(mate(0, true))).toBe('#')
  })
})
