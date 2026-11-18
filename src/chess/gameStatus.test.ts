import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { describeStatus, getGameStatus } from './gameStatus'

describe('getGameStatus', () => {
  it('reports an ongoing game with the side to move', () => {
    expect(getGameStatus(new Chess())).toEqual({ over: false, turn: 'w', inCheck: false })
  })

  it('detects check', () => {
    const game = new Chess('4k3/8/8/8/8/8/8/4K2R w K - 0 1')
    game.move('Rh8+')
    expect(getGameStatus(game)).toEqual({ over: false, turn: 'b', inCheck: true })
  })

  it("detects checkmate (fool's mate)", () => {
    const game = new Chess()
    for (const m of ['f3', 'e5', 'g4', 'Qh4#']) game.move(m)
    expect(getGameStatus(game)).toEqual({ over: true, result: '0-1', reason: 'checkmate', winner: 'b' })
  })

  it('detects stalemate', () => {
    const game = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')
    expect(getGameStatus(game)).toMatchObject({ over: true, result: '1/2-1/2', reason: 'stalemate' })
  })

  it('detects insufficient material', () => {
    const game = new Chess('8/8/4k3/8/8/4K3/8/8 w - - 0 1')
    expect(getGameStatus(game)).toMatchObject({ over: true, reason: 'insufficient material' })
  })

  it('detects threefold repetition', () => {
    const game = new Chess()
    for (const m of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) game.move(m)
    expect(getGameStatus(game)).toMatchObject({ over: true, reason: 'threefold repetition' })
  })

  it('detects the fifty-move rule', () => {
    const game = new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 100 80')
    expect(getGameStatus(game)).toMatchObject({ over: true, reason: 'fifty-move rule' })
  })
})

describe('describeStatus', () => {
  it('describes a win and a loss from the user point of view', () => {
    const game = new Chess()
    for (const m of ['f3', 'e5', 'g4', 'Qh4#']) game.move(m)
    const status = getGameStatus(game)
    expect(describeStatus(status, 'b')).toBe('Checkmate. You win!')
    expect(describeStatus(status, 'w')).toBe('Checkmate. The bot wins.')
  })
})
