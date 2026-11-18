import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { materialSummary } from './material'

describe('materialSummary', () => {
  it('is level at the start', () => {
    expect(materialSummary(new Chess())).toEqual({
      w: { captured: [], advantage: 0 },
      b: { captured: [], advantage: 0 },
    })
  })

  it('lists captures and the material lead', () => {
    // Black is missing the b8 knight, White is missing the a2 pawn.
    const g = new Chess('r1bqkbnr/pppppppp/8/8/8/8/1PPPPPPP/RNBQKBNR w KQkq - 0 1')
    const m = materialSummary(g)
    expect(m.w).toEqual({ captured: ['n'], advantage: 2 })
    expect(m.b).toEqual({ captured: ['p'], advantage: 0 })
  })
})
