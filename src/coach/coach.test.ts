import { Chess, type Move } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { classifyMove } from '../chess/classify'
import type { Score } from '../chess/score'
import type { PositionAnalysis } from '../engine/uciInfo'
import { buildFacts, lineToSan } from './facts'
import { buildHint } from './hints'
import { writeNote } from './notes'

/** A fake engine result. `score` is from the side to move in `fen`. */
function analysis(fen: string, score: Score, pv: string[], second?: { score: Score; pv: string[] }): PositionAnalysis {
  const lines = [{ multipv: 1, depth: 16, score, pv }]
  if (second) lines.push({ multipv: 2, depth: 16, ...second })
  return { fen, depth: 16, bestMove: pv[0] ?? null, lines }
}

/** Play `san` from `fen` and build the coaching facts and note, given the engine's view. */
function coach(
  fen: string,
  san: string,
  before: { score: Score; pv: string[] },
  after: { score: Score; pv: string[] },
  nullMove?: { fen: string; score: Score; pv: string[] },
) {
  const game = new Chess(fen)
  const move: Move = game.move(san)
  const b = analysis(move.before, before.score, before.pv)
  const a = analysis(move.after, after.score, after.pv)
  const judgement = classifyMove(b, a, move.from + move.to + (move.promotion ?? ''))!
  const facts = buildFacts({
    move,
    judgement,
    before: b,
    after: a,
    nullMove: nullMove ? analysis(nullMove.fen, nullMove.score, nullMove.pv) : undefined,
  })
  return { judgement, facts, note: writeNote(facts, move.color) }
}

const cp = (n: number): Score => ({ kind: 'cp', cp: n })

describe('coaching facts and notes', () => {
  it('explains a piece left hanging and taken', () => {
    // After 1.e4 e5 2.Nf3 Nc6, White plays Nd4?? and the e5 pawn takes it.
    const { judgement, facts, note } = coach(
      'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      'Nd4',
      { score: cp(30), pv: ['f1b5', 'a7a6'] },
      { score: cp(300), pv: ['e5d4', 'c2c3'] },
    )
    expect(judgement.rating).toBe('blunder')
    expect(facts.facts[0]).toMatchObject({ type: 'piece-lost', captureSan: 'exd4', piece: { square: 'd4', type: 'n' } })
    expect(note.text).toBe('This leaves your knight on d4 with no defender, so Black can win it with exd4.')
    expect(note.tip).toMatch(/attacked/)
  })

  it('explains an allowed knight fork', () => {
    // White plays h3 and Black replies Nc2+, forking the king on e1 and the rook on a1.
    const { facts, note } = coach(
      '4k3/8/8/8/1n6/8/7P/R3K3 w - - 0 1',
      'h3',
      { score: cp(150), pv: ['a1a4'] },
      { score: cp(200), pv: ['b4c2', 'e1d2', 'c2a1'] },
    )
    expect(facts.facts[0]).toMatchObject({ type: 'allowed-fork', replySan: 'Nc2+' })
    expect(note.text).toBe('This allows Nc2+, and the knight forks your king on e1 and rook on a1.')
    expect(note.tip).toMatch(/knight/)
  })

  it('explains a missed capture of an undefended piece', () => {
    // The black queen on d5 is undefended and the rook on d1 attacks it. White plays Kf2 instead,
    // which also leaves the rook undefended against the queen.
    const { facts, note } = coach(
      '4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1',
      'Kf2',
      { score: cp(900), pv: ['d1d5'] },
      { score: cp(-900), pv: ['d5d1'] },
    )
    const missed = facts.facts.find((f) => f.type === 'missed-capture')
    expect(missed).toMatchObject({ bestSan: 'Rxd5', piece: { square: 'd5', type: 'q' } })
    // The reply takes the rook, which is the bigger problem, so it comes first.
    expect(note.text).toContain('Qxd1')
  })

  it('explains a missed forced mate', () => {
    const { note } = coach(
      '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
      'Ra7',
      { score: { kind: 'mate', moves: 1, forUs: true }, pv: ['a1a8'] },
      { score: cp(-410), pv: ['h7h6'] },
    )
    expect(note.text).toBe('You had a forced mate in 1, starting with Ra8#.')
  })

  it('explains an allowed forced mate', () => {
    // White plays a2a3, ignoring the back rank; Black mates with Re1#.
    const { note } = coach(
      '4r1k1/5ppp/8/8/8/8/P4PPP/6K1 w - - 0 1',
      'a3',
      { score: cp(-500), pv: ['g1f1'] },
      { score: { kind: 'mate', moves: 1, forUs: true }, pv: ['e8e1'] },
    )
    expect(note.text).toBe('This lets Black force checkmate in 1, starting with Re1#.')
  })

  it('explains a threat the move ignored', () => {
    // Black's rook on e8 threatens Re1# (back-rank mate). The position is level if White makes
    // luft with g3, but White plays a3 instead. The null-move analysis shows Re1# as the threat.
    const { facts } = coach(
      '4r1k1/5ppp/8/8/8/8/P4PPP/6K1 w - - 0 1',
      'a3',
      { score: cp(0), pv: ['g2g3'] },
      { score: { kind: 'mate', moves: 1, forUs: true }, pv: ['e8e1'] },
      { fen: '4r1k1/5ppp/8/8/8/8/P4PPP/6K1 b - - 0 1', score: { kind: 'mate', moves: 1, forUs: true }, pv: ['e8e1'] },
    )
    expect(facts.facts.map((f) => f.type)).toContain('threat-ignored')
  })

  it('falls back to a general note when no pattern is found', () => {
    const { note } = coach(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'g4',
      { score: cp(30), pv: ['e2e4', 'e7e5', 'g1f3'] },
      { score: cp(120), pv: ['d7d5'] },
    )
    expect(note.text).toBe(
      'The engine preferred e4 (e4 e5 Nf3), and this move dropped your winning chances from 53% to 39%.',
    )
  })

  it('converts engine lines to standard notation and stops at an illegal move', () => {
    const start = new Chess().fen()
    expect(lineToSan(start, ['e2e4', 'e7e5', 'g1f3'])).toEqual(['e4', 'e5', 'Nf3'])
    expect(lineToSan(start, ['e2e4', 'e2e4'])).toEqual(['e4'])
  })
})

describe('buildHint', () => {
  const fen = '4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1'

  it('says there is something here when the best move stands out', () => {
    const hint = buildHint(analysis(fen, cp(900), ['d1d5'], { score: cp(0), pv: ['e1e2'] }))!
    expect(hint.kind).toBe('tactic')
    expect(hint.pieceText).toBe('Look at your rook on d1.')
    expect(hint.moveText).toBe('Play Rxd5.')
  })

  it('says the position is quiet when the top moves are close', () => {
    const hint = buildHint(analysis(fen, cp(20), ['e1e2'], { score: cp(10), pv: ['e1f2'] }))!
    expect(hint.kind).toBe('quiet')
  })

  it('announces a forced mate', () => {
    const hint = buildHint(
      analysis('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', { kind: 'mate', moves: 1, forUs: true }, ['a1a8'], {
        score: cp(500),
        pv: ['a1a7'],
      }),
    )!
    expect(hint.kind).toBe('mate')
    expect(hint.nudge).toBe("There's a forced mate in 1 here. Look at every check.")
  })
})
