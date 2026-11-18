import { describe, expect, it } from 'vitest'
import { parseUci, plyToUndo } from './moves'

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
