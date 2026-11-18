import { describe, expect, it } from 'vitest'
import { lineMoves, numberedLine } from './followUp'

describe('follow-up lines', () => {
  it('numbers a line from White or Black to move', () => {
    expect(numberedLine('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ['e4', 'e5', 'Nf3'])).toBe('1. e4 e5 2. Nf3')
    expect(numberedLine('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', ['e5', 'Nf3', 'Nc6'])).toBe('1... e5 2. Nf3 Nc6')
  })

  it('stops at the first illegal move', () => {
    expect(lineMoves('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ['e4', 'Ke2', 'e5']).map((m) => m.san)).toEqual(['e4'])
  })
})
