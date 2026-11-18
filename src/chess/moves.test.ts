import { describe, expect, it } from 'vitest'
import { parseUci, plyToUndo, uciToSan } from './moves'

describe('parseUci', () => {
  it('parses a normal move', () => {
    expect(parseUci('e2e4')).toEqual({ from: 'e2', to: 'e4' })
  })
  it('parses a promotion', () => {
    expect(parseUci('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' })
  })
})

describe('plyToUndo', () => {
  it('does nothing at the start', () => {
    expect(plyToUndo(0, 'w', 'w')).toBe(0)
  })
  it('takes back the user move and the bot reply', () => {
    // 1. e4 e5, white to move, user is white
    expect(plyToUndo(2, 'w', 'w')).toBe(2)
  })
  it('takes back only the user move while the bot is still thinking', () => {
    expect(plyToUndo(1, 'b', 'w')).toBe(1)
  })
  it('cannot undo when only the bot has moved (user is black)', () => {
    expect(plyToUndo(1, 'b', 'b')).toBe(0)
  })
  it('takes back the user move and the bot reply when the user is black', () => {
    // 1. e4 e5 2. Nf3, black to move
    expect(plyToUndo(3, 'b', 'b')).toBe(2)
  })
})

describe('uciToSan', () => {
  it('converts moves to standard notation', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    expect(uciToSan(start, 'g1f3')).toBe('Nf3')
    expect(uciToSan('k7/4P3/8/8/8/8/8/4K3 w - - 0 1', 'e7e8q')).toBe('e8=Q+')
  })
  it('returns null for an illegal move', () => {
    expect(uciToSan('k7/4P3/8/8/8/8/8/4K3 w - - 0 1', 'e1e3')).toBeNull()
  })
})
