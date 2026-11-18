import { describe, expect, it } from 'vitest'
import { parseInfoLine } from './uciInfo'

describe('parseInfoLine', () => {
  it('reads depth, multipv, score and pv', () => {
    expect(
      parseInfoLine('info depth 16 seldepth 22 multipv 2 score cp -31 nodes 12345 nps 900000 time 400 pv e7e5 g1f3 b8c6'),
    ).toEqual({ multipv: 2, depth: 16, score: { kind: 'cp', cp: -31 }, pv: ['e7e5', 'g1f3', 'b8c6'] })
  })

  it('reads mate scores', () => {
    expect(parseInfoLine('info depth 20 multipv 1 score mate -3 pv h7h6 d1h5')?.score).toEqual({
      kind: 'mate',
      moves: 3,
      forUs: false,
    })
  })

  it('reads the game-over line Stockfish sends for a mated position', () => {
    expect(parseInfoLine('info depth 0 score mate 0')).toEqual({
      multipv: 1,
      depth: 0,
      score: { kind: 'mate', moves: 0, forUs: false },
      pv: [],
    })
  })

  it('ignores provisional bound lines and lines without a score', () => {
    expect(parseInfoLine('info depth 12 multipv 1 score cp 40 lowerbound pv e2e4')).toBeNull()
    expect(parseInfoLine('info depth 12 currmove e2e4 currmovenumber 1')).toBeNull()
    expect(parseInfoLine('info string NNUE evaluation using nn-small.nnue')).toBeNull()
  })
})
