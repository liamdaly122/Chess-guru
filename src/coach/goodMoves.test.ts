import { Chess, type Move } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { classifyMove } from '../chess/classify'
import type { Score } from '../chess/score'
import type { PositionAnalysis } from '../engine/uciInfo'
import { buildFacts } from './facts'
import { goodFacts, writeWhy } from './goodMoves'
import { writeOpponentNote } from './notes'

function analysis(fen: string, score: Score, pv: string[], second?: { score: Score; pv: string[] }): PositionAnalysis {
  const lines = [{ multipv: 1, depth: 16, score, pv }]
  if (second) lines.push({ multipv: 2, depth: 16, ...second })
  return { fen, depth: 16, bestMove: pv[0] ?? null, lines }
}
const cp = (n: number): Score => ({ kind: 'cp', cp: n })

/** Play `san` from `fen` with the engine's view before and after, and explain why it was good. */
function why(fen: string, san: string, before: { score: Score; pv: string[]; second?: { score: Score; pv: string[] } }, after: { score: Score; pv: string[] }) {
  const move: Move = new Chess(fen).move(san)
  const b = analysis(move.before, before.score, before.pv, before.second)
  const a = analysis(move.after, after.score, after.pv)
  const j = classifyMove(b, a, move.lan)!
  const facts = goodFacts(move, j, b)
  return { facts, text: writeWhy(facts), rating: j.rating }
}

describe('why a good move was good', () => {
  it('names a loose piece won', () => {
    // Black's knight on d4 is undefended; White takes it.
    const r = why('4k3/8/8/8/3n4/8/8/3RK3 w - - 0 1', 'Rxd4', { score: cp(300), pv: ['d1d4'] }, { score: cp(-300), pv: ['e8e7'] })
    expect(r.facts[0]).toMatchObject({ type: 'wins-material', piece: { square: 'd4', type: 'n' } })
    expect(r.text).toBe('It wins the knight on d4, which was undefended.')
  })

  it('names a fork', () => {
    // Nc7+ forks the king on e8 and the rook on a8.
    const r = why('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', 'Nc7+', { score: cp(400), pv: ['b5c7'] }, { score: cp(-400), pv: ['e8d8'] })
    expect(r.text).toMatch(/^The knight attacks the king and rook on a8 at once\./)
  })

  it('notices the only good move and checkmate', () => {
    const only = why(
      '4k3/8/8/8/3n4/8/8/3RK3 w - - 0 1',
      'Rxd4',
      { score: cp(300), pv: ['d1d4'], second: { score: cp(-50), pv: ['e1e2'] } },
      { score: cp(-300), pv: ['e8e7'] },
    )
    expect(only.rating).toBe('great')
    expect(only.text).toMatch(/only good move/)
    const mate = why('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'Ra8#', { score: { kind: 'mate', moves: 1, forUs: true }, pv: ['a1a8'] }, { score: { kind: 'mate', moves: 0, forUs: false }, pv: [] })
    expect(mate.text).toBe('Checkmate.')
  })

  it('mentions castling and development on their own', () => {
    expect(why('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', 'O-O', { score: cp(30), pv: ['e1g1'] }, { score: cp(-30), pv: ['g8f6'] }).text).toMatch(/Castling/)
    expect(why('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'Nf3', { score: cp(30), pv: ['g1f3'] }, { score: cp(-30), pv: ['b8c6'] }).text).toBe('It brings your knight into play.')
  })
})

describe("your opponent's mistakes, from your side", () => {
  it('says what the mistake lets you win', () => {
    // Black (the opponent) plays Nd3+?? and White's c2 pawn takes it.
    const mv: Move = new Chess('4k3/8/8/2n5/8/8/2P5/4K3 b - - 0 1').move('Nd3+')
    const before = analysis(mv.before, cp(0), ['c5e6'])
    const after = analysis(mv.after, cp(400), ['c2d3'])
    const j = classifyMove(before, after, mv.lan)!
    const note = writeOpponentNote(buildFacts({ move: mv, judgement: j, before, after }))
    expect(j.rating === 'blunder' || j.rating === 'mistake').toBe(true)
    expect(note.text).toMatch(/their knight on d3/)
    expect(note.text).toMatch(/you can win it with cxd3/)
  })
})
