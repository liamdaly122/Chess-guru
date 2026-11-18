import { describe, expect, it } from 'vitest'
import type { PositionAnalysis } from '../engine/uciInfo'
import { classifyMove } from './classify'
import type { Score } from './score'

const cp = (n: number): Score => ({ kind: 'cp', cp: n })
const mate = (moves: number, forUs: boolean): Score => ({ kind: 'mate', moves, forUs })

/** An analysis with one line. `score` is from the side to move in that position. */
function analysis(score: Score, bestMove: string | null = 'a2a3'): PositionAnalysis {
  return { fen: 'x', depth: 16, bestMove, lines: [{ multipv: 1, depth: 16, score, pv: bestMove ? [bestMove] : [] }] }
}

/**
 * Rate a move given the mover's eval before and after (both from the mover's side).
 * The "after" analysis is stored from the opponent's side, as the engine would report it.
 */
function rate(before: Score, afterForMover: Score, played = 'h2h3', best = 'a2a3') {
  const flip = (s: Score): Score => (s.kind === 'cp' ? cp(-s.cp) : { ...s, forUs: !s.forUs })
  return classifyMove(analysis(before, best), analysis(flip(afterForMover)), played)!
}

describe('classifyMove', () => {
  it('rates the engine top move as best', () => {
    expect(rate(cp(30), cp(-200), 'a2a3', 'a2a3').rating).toBe('best')
  })

  it('rates a small drop as good', () => {
    const j = rate(cp(30), cp(10))
    expect(j.rating).toBe('good')
    expect(j.drop).toBeLessThan(5)
  })

  it('rates a drop just under 5 Win% points as good', () => {
    expect(rate(cp(0), cp(-50)).rating).toBe('good') // drop about 4.6
  })

  it('rates inaccuracy, mistake and blunder by Win% drop', () => {
    expect(rate(cp(0), cp(-70)).rating).toBe('inaccuracy') // drop about 6.4
    expect(rate(cp(0), cp(-120)).rating).toBe('mistake') // drop about 10.9
    expect(rate(cp(0), cp(-300)).rating).toBe('blunder') // drop about 25
  })

  it('does not punish losing centipawns when the position is already winning', () => {
    // +10 to +8 is still completely winning, so Win% barely moves (about 2.6 points).
    expect(rate(cp(1000), cp(800)).rating).toBe('good')
  })

  it('reports a drop of zero when the move improves the evaluation', () => {
    expect(rate(cp(0), cp(50)).drop).toBe(0)
  })

  it('rates allowing a forced mate from a normal position as a blunder', () => {
    const j = rate(cp(20), mate(3, false))
    expect(j.rating).toBe('blunder')
    expect(j.mateRule).toBe('allowed-mate')
  })

  it('rates allowing mate when already lost as an inaccuracy (Lichess rule)', () => {
    expect(rate(cp(-1200), mate(5, false)).rating).toBe('inaccuracy')
    expect(rate(cp(-800), mate(5, false)).rating).toBe('mistake')
  })

  it('rates missing a forced mate but staying totally winning as an inaccuracy', () => {
    const j = rate(mate(2, true), cp(1500))
    expect(j.rating).toBe('inaccuracy')
    expect(j.mateRule).toBe('missed-mate')
  })

  it('rates missing a forced mate and letting the advantage go as a blunder', () => {
    expect(rate(mate(2, true), cp(150)).rating).toBe('blunder')
    expect(rate(mate(2, true), cp(800)).rating).toBe('mistake')
  })

  it('rates a slower mate as good, not as a missed mate', () => {
    expect(rate(mate(2, true), mate(4, true)).rating).toBe('good')
  })

  it('rates delivering checkmate as best even if the engine preferred another mate', () => {
    expect(rate(mate(1, true), mate(0, true)).rating).toBe('best')
  })

  it('returns null when an analysis is missing', () => {
    expect(classifyMove(undefined, analysis(cp(0)), 'e2e4')).toBeNull()
  })
})
