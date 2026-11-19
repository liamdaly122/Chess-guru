import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { Chess } from 'chess.js'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Puzzle } from '../puzzles/puzzle'
import { resetDbForTests } from '../storage/db'
import { attackedPieces, checksFor, checkVision, makeQuestion, makeSet, movesText, undefendedPieces } from './drills'
import { formatTime, getVisionRecords, recordVisionSet } from './visionStore'

const START = new Chess().fen()
const fenAfter = (sans: string[]) => {
  const g = new Chess()
  for (const s of sans) g.move(s)
  return g.fen()
}

// 1.e4 e5 2.Bc4 Nc6 3.Qh5, then Black's set-up move 3...Nf6?? and White's 4.Qxf7#.
const scholar: Puzzle = { id: 'sch', fen: fenAfter(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5']), moves: ['g8f6', 'h5f7'], rating: 600, themes: [] }
// 1.e4 e5 2.Nf3 Nc6 3.Bc4, set-up 3...Nd4, then 4.Nxe5 Qg5.
const line: Puzzle = { id: 'line', fen: fenAfter(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']), moves: ['c6d4', 'f3e5', 'd8g5'], rating: 1200, themes: [] }

describe('board vision answers', () => {
  it('finds undefended and attacked pieces', () => {
    expect(undefendedPieces(START, 'w')).toEqual(['a1', 'h1'])
    // After 1.e4 d5 the e4 pawn is attacked; nothing of Black's is.
    const fen = fenAfter(['e4', 'd5'])
    expect(attackedPieces(fen, 'w')).toEqual(['e4'])
    expect(attackedPieces(fen, 'b')).toEqual(['d5'])
  })

  it('lists checks', () => {
    const fen = fenAfter(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6'])
    expect(checksFor(fen)).toEqual(['Bxf7+', 'Qxe5+', 'Qxf7#'])
  })

  it('writes moves with numbers', () => {
    expect(movesText(line.fen, line.moves)?.text).toBe('3...Nd4 4.Nxe5 Qg5')
  })
})

describe('board vision questions', () => {
  it('counts the checks', () => {
    const q = makeQuestion('checks', scholar)!
    expect(q.color).toBe('w')
    expect(q.answer).toEqual({ kind: 'count', count: 3, list: ['Bxf7+', 'Qxe5+', 'Qxf7#'] })
    expect(checkVision(q, 3)).toMatchObject({ correct: true, text: 'Right: White has 3 checks: Bxf7+, Qxe5+, Qxf7#.' })
    expect(checkVision(q, 2).correct).toBe(false)
  })

  it('asks where a piece can go', () => {
    const q = makeQuestion('moves', scholar, () => 0)!
    expect(q.focus).toBeDefined()
    const expected = new Chess(q.fen).moves({ square: q.focus!, verbose: true }).map((m) => m.to).sort()
    expect(q.answer).toEqual({ kind: 'squares', squares: expected })
  })

  it('asks for attacked pieces after imagined moves', () => {
    const q = makeQuestion('imagine', line)!
    expect(q.fen).toBe(line.fen)
    expect(q.moves).toBe('3...Nd4 4.Nxe5 Qg5')
    expect(q.color).toBe('w')
    // The queen on g5 attacks the knight on e5 and the pawn on g2; the d4 knight attacks c2 and f3... c2 only.
    expect(q.answer).toEqual({ kind: 'squares', squares: attackedPieces(q.finalFen!, 'w') })
    expect((q.answer as { squares: string[] }).squares).toContain('e5')
  })

  it('checks tapped squares and explains what was missed', () => {
    const q = makeQuestion('imagine', line)!
    const squares = (q.answer as { squares: ('e5' | 'g2')[] }).squares
    const r = checkVision(q, [squares[0], 'a2'])
    expect(r.correct).toBe(false)
    expect(r.right).toEqual([squares[0]])
    expect(r.wrong).toEqual(['a2'])
    expect(r.missed).toEqual(squares.slice(1))
    expect(r.text).toContain('Not attacked: the pawn on a2.')
    expect(checkVision(q, squares).correct).toBe(true)
  })

  it('builds a set without repeating a position', () => {
    const puzzles: Puzzle[] = Array.from({ length: 6 }, (_, i) => ({ ...line, id: `p${i}` }))
    let seed = 1
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const set = makeSet('imagine', puzzles, 4, random)
    expect(set).toHaveLength(4)
    expect(new Set(set.map((q) => q.id)).size).toBe(4)
  })
})

describe('board vision records', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory()
    resetDbForTests()
  })

  it('keeps the best set: most right, then fastest', async () => {
    expect(await recordVisionSet('loose', 7, 90_000, 1)).toBe(true)
    expect(await recordVisionSet('loose', 6, 50_000, 2)).toBe(false)
    expect(await recordVisionSet('loose', 7, 80_000, 3)).toBe(true)
    expect((await getVisionRecords()).loose).toEqual({ sets: 3, best: 7, bestMs: 80_000, last: 7, lastAt: 3 })
    expect(formatTime(102_000)).toBe('1:42')
  })
})
