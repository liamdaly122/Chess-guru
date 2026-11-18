import { describe, expect, it } from 'vitest'
import type { GameRecord } from '../storage/types'
import { DAY, NEVER } from '../training/srs'
import { loadBook } from './book'
import {
  drillStats,
  dueDrills,
  expectedMove,
  fenAt,
  isDone,
  MASTERED_BOX,
  newDrill,
  opponentToMove,
  playReply,
  runResult,
  scheduleDrill,
  startRun,
  tryMove,
} from './drill'
import { suggestionsFromGames } from './fromGames'
import { family, lineContinuing, lineText, loadLines, movesFor, searchLines, type OpeningLine } from './lines'

const italian: OpeningLine = { id: 'e4 e5 Nf3 Nc6 Bc4', eco: 'C50', name: 'Italian Game', san: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] }

describe('opening lines (real Lichess data)', async () => {
  const lines = await loadLines()

  it('loads every named line with unique ids', () => {
    expect(lines.length).toBeGreaterThan(3000)
    expect(new Set(lines.map((l) => l.id)).size).toBe(lines.length)
    expect(lines.find((l) => l.id === italian.id)?.name).toBe('Italian Game')
  })

  it('finds lines by words in their name, main line first', () => {
    const hits = searchLines(lines, 'italian', 10)
    expect(hits[0].name).toBe('Italian Game')
    expect(searchLines(lines, 'najdorf english', 5).every((l) => /Najdorf/.test(l.name) && /English/.test(l.name))).toBe(true)
    expect(searchLines(lines, '   ', 5)).toEqual([])
  })

  it('finds the book line that continues from a position', () => {
    const next = lineContinuing(lines, ['e4', 'e5', 'Nf3', 'Nc6'])
    expect(next?.san.slice(0, 4)).toEqual(['e4', 'e5', 'Nf3', 'Nc6'])
    expect(next!.san.length).toBeGreaterThan(4)
  })

  it('formats and counts moves', () => {
    expect(family('Sicilian Defense: Najdorf Variation')).toBe('Sicilian Defense')
    expect(lineText(italian.san)).toBe('1. e4 e5 2. Nf3 Nc6 3. Bc4')
    expect(movesFor(italian, 'w')).toBe(3)
    expect(movesFor(italian, 'b')).toBe(2)
  })
})

describe('drilling a line', async () => {
  const book = await loadBook()

  it('as White: you play your moves, the app plays the replies', () => {
    let run = startRun({ ...newDrill(italian, 'w', 0), learned: true })
    expect(opponentToMove(run)).toBe(false)
    expect(expectedMove(run)).toBe('e2e4')
    const r = tryMove(run, 'e2e4', book)
    expect(r.kind).toBe('correct')
    run = (r as { run: typeof run }).run
    expect(opponentToMove(run)).toBe(true)
    run = playReply(run)
    expect(expectedMove(run)).toBe('g1f3')
  })

  it('a different book move is not counted as wrong, a non-book move is', () => {
    const run = startRun({ ...newDrill(italian, 'w', 0), learned: true })
    const d4 = tryMove(run, 'd2d4', book)
    expect(d4).toMatchObject({ kind: 'other-book', san: 'd4' })
    const h4 = tryMove(run, 'h2h4', book)
    // 1.h4 is named (Kádas Opening), so try a move that is in no line at all.
    expect(h4.kind).toBe('other-book')
    const later = { ...run, ply: 2 }
    // After 1.e4 e5, 2.a4 is in no line (even 2.Ke2 is: the Bongcloud).
    const bad = tryMove(later, 'a2a4', book)
    expect(bad).toMatchObject({ kind: 'wrong', san: 'a4' })
    expect((bad as { run: typeof run }).run.wrong).toBe(1)
    expect(tryMove(run, 'e2e5', book).kind).toBe('illegal')
  })

  it("doesn't count slips while the moves are being shown", () => {
    const run = { ...startRun(newDrill(italian, 'w', 0)), ply: 2 }
    expect((tryMove(run, 'a2a4', book) as { run: typeof run }).run.wrong).toBe(0)
  })

  it('as Black: the line ends after your last move or the final reply', () => {
    let run = startRun({ ...newDrill(italian, 'b', 0), learned: true })
    expect(opponentToMove(run)).toBe(true)
    run = playReply(run)
    expect(expectedMove(run)).toBe('e7e5')
    run = { ...run, ply: 4 }
    run = playReply(run)
    expect(isDone(run)).toBe(true)
    expect(fenAt(run.drill, 5)).toMatch(/^r1bqkbnr\/pppp1ppp\/2n5\/4p3\/2B1P3\/5N2/)
  })

  it('rates the run', () => {
    const run = startRun(newDrill(italian, 'w', 0))
    expect(runResult(run)).toBe('solved')
    expect(runResult({ ...run, wrong: 1 })).toBe('helped')
    expect(runResult({ ...run, helped: true })).toBe('helped')
    expect(runResult({ ...run, shown: true })).toBe('failed')
  })
})

describe('opening schedule', () => {
  it('a first run only marks the line as learned, then reviews use the boxes', () => {
    let d = newDrill(italian, 'w', 0)
    expect(dueDrills([d], 0)).toHaveLength(1)
    d = scheduleDrill(d, 'helped', 10)
    expect(d).toMatchObject({ learned: true, box: 0, dueAt: 10, attempts: 0 })
    d = scheduleDrill(d, 'solved', 10)
    expect(d).toMatchObject({ box: 1, dueAt: 10 + DAY })
    for (let i = 0; i < MASTERED_BOX; i++) d = scheduleDrill(d, 'solved', 20)
    expect(d.dueAt).toBe(NEVER)
    expect(drillStats([d], 30)).toMatchObject({ mastered: 1, due: 0 })
  })

  it('lists due reviews before new lines', () => {
    const fresh = newDrill(italian, 'b', 5)
    const review = { ...newDrill(italian, 'w', 0), learned: true, dueAt: 50 }
    const later = { ...newDrill({ ...italian, id: 'e4 e5' }, 'w', 0), learned: true, dueAt: 500 }
    expect(dueDrills([fresh, later, review], 100).map((d) => d.id)).toEqual([review.id, fresh.id])
    expect(drillStats([fresh, later, review], 100)).toMatchObject({ due: 1, fresh: 1, learning: 2, nextDueAt: null })
  })
})

describe('lines to learn from your games', async () => {
  const book = await loadBook()
  const lines = await loadLines()
  const game = (id: string, moves: string[], userColor: 'w' | 'b', endedAt = 1): GameRecord => ({
    id,
    source: 'bot',
    endedAt,
    white: { name: 'W' },
    black: { name: 'B' },
    userColor,
    result: '1-0',
    termination: 'checkmate',
    moves,
  })
  // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.Kf1 (4.Kf1 leaves the book)
  const trap = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'e1f1']
  // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nd4 4.Nxe5: the book has no more moves here, so nothing to learn.
  const endOfBook = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'c6d4', 'f3e5']

  it('suggests the line where you left the book, counted across games', () => {
    const s = suggestionsFromGames([game('a', trap, 'w', 1), game('b', trap, 'w', 2)], book, lines, 5)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ side: 'w', games: 2, moveNumber: 4, played: 'Kf1' })
    expect(s[0].line.san.slice(0, 6)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'])
    expect(s[0].bookSans).toEqual(expect.arrayContaining(['c3', 'O-O']))
    expect(s[0].bookSans).toContain(s[0].line.san[6])
  })

  it("ignores games where your opponent left the book first, and lines you're already learning", () => {
    expect(suggestionsFromGames([game('a', trap, 'b')], book, lines, 5)).toEqual([])
    expect(suggestionsFromGames([game('a', trap, 'w')], book, lines, 5, () => true)).toEqual([])
    expect(suggestionsFromGames([game('a', endOfBook, 'w')], book, lines, 5)).toEqual([])
  })
})
