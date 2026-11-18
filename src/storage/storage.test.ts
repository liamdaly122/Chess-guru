import 'fake-indexeddb/auto'
import { newDrill } from '../openings/drill'
import { addDrills, listDrills } from './openingStore'
import { countPuzzleDone, loadGoalData, setGoal } from '../goal/goalStore'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportAllPgn, exportBackup, importBackup } from './backup'
import { resetDbForTests } from './db'
import { deleteGame, getGame, listGames, saveGame, saveGames } from './games'
import type { GameRecord } from './types'

const game = (id: string, endedAt: number, extra: Partial<GameRecord> = {}): GameRecord => ({
  id,
  source: 'bot',
  endedAt,
  white: { name: 'You' },
  black: { name: 'Stockfish', rating: 1200 },
  userColor: 'w',
  result: '1-0',
  termination: 'checkmate',
  moves: ['f2f3', 'e7e5', 'g2g4', 'd8h4'],
  ...extra,
})

beforeEach(() => {
  // A brand new empty database for every test.
  globalThis.indexedDB = new IDBFactory()
  resetDbForTests()
})

describe('games store', () => {
  it('saves a game with its PGN and reads it back', async () => {
    await saveGame(game('a', 1))
    const g = await getGame('a')
    expect(g?.pgn).toContain('1. f3 e5 2. g4 Qh4#')
  })

  it('lists games newest first', async () => {
    await saveGame(game('old', 1000))
    await saveGame(game('new', 3000))
    await saveGame(game('mid', 2000))
    expect((await listGames()).map((g) => g.id)).toEqual(['new', 'mid', 'old'])
  })

  it('deletes a game', async () => {
    await saveGame(game('a', 1))
    await deleteGame('a')
    expect(await getGame('a')).toBeUndefined()
  })

  it('keeps an existing review when the same game is imported again', async () => {
    const review = { startEval: null, plies: [], accuracy: 90, lessons: [], complete: true }
    await saveGame(game('lichess:x', 1, { source: 'lichess', review }))
    const added = await saveGames([game('lichess:x', 1, { source: 'lichess' }), game('lichess:y', 2, { source: 'lichess' })])
    expect(added).toBe(1)
    expect((await getGame('lichess:x'))?.review?.accuracy).toBe(90)
  })
})

describe('backup', () => {
  it('round-trips all games through a backup file', async () => {
    await saveGame(game('a', 1))
    await saveGame(game('b', 2))
    const file = await exportBackup()

    globalThis.indexedDB = new IDBFactory()
    resetDbForTests()
    expect(await listGames()).toEqual([])

    expect(await importBackup(file)).toMatchObject({ restored: 2, skipped: 0 })
    expect((await listGames()).map((g) => g.id)).toEqual(['b', 'a'])
  })

  it('skips broken entries and rejects files that are not backups', async () => {
    const file = JSON.stringify({ app: 'chess-guru', version: 1, games: [game('ok', 1), { id: 3 }] })
    expect(await importBackup(file)).toMatchObject({ restored: 1, skipped: 1 })
    await expect(importBackup('{"hello":1}')).rejects.toThrow(/isn’t a Chess Guru backup/)
    await expect(importBackup('not json')).rejects.toThrow(/isn’t a Chess Guru backup/)
  })

  it('exports every game as one PGN file', async () => {
    await saveGame(game('a', 1))
    await saveGame(game('b', 2))
    const pgn = await exportAllPgn()
    expect(pgn.match(/\[Event /g)).toHaveLength(2)
  })
})

describe('puzzle store', () => {
  it('starts at the default rating and saves attempts with the new rating', async () => {
    const { getPuzzleRating, recordAttempt, listAttempts, themeRecords, DEFAULT_PUZZLE_RATING } = await import('./puzzleStore')
    expect(await getPuzzleRating()).toBe(DEFAULT_PUZZLE_RATING)
    await recordAttempt({ id: 'p1:1', puzzleId: 'p1', at: 1, solved: true, themes: ['fork', 'middlegame'], puzzleRating: 1200, ratingBefore: 1200, ratingAfter: 1216 })
    await recordAttempt({ id: 'p2:2', puzzleId: 'p2', at: 2, solved: false, themes: ['fork'], puzzleRating: 1200, ratingBefore: 1216, ratingAfter: 1199 })
    expect(await getPuzzleRating()).toBe(1199)
    const attempts = await listAttempts()
    expect(attempts.map((a) => a.puzzleId)).toEqual(['p1', 'p2'])
    expect(themeRecords(attempts)).toEqual([
      { theme: 'fork', tried: 2, solved: 1 },
      { theme: 'middlegame', tried: 1, solved: 1 },
    ])
  })
})

describe('backup version 2', () => {
  it('also saves and restores puzzle rating, attempts and mistake puzzles', async () => {
    const { recordAttempt, getPuzzleRating, listAttempts } = await import('./puzzleStore')
    const { syncMistakePuzzles, listMistakePuzzles, saveMistakePuzzle } = await import('./mistakeStore')
    const { mistakePuzzlesFromGame, schedule, MASTERED_BOX } = await import('../puzzles/mistakes')

    // A reviewed game with one blunder, which becomes a mistake puzzle.
    const reviewed = game('r', 1, {
      review: {
        startEval: null,
        accuracy: 60,
        lessons: [],
        complete: true,
        plies: [
          {
            san: 'Nd4',
            uci: 'f3d4',
            color: 'w',
            fenBefore: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
            fenAfter: '',
            evalAfter: null,
            judgement: {
              rating: 'blunder',
              bestUci: 'f1b5',
              bestSan: 'Bb5',
              winBefore: 55,
              winAfter: 10,
              scoreBefore: { kind: 'cp', cp: 30 },
              scoreAfter: { kind: 'cp', cp: -300 },
              bestLineSan: [],
            },
            note: { text: 'Loose knight.', tip: 'Check pieces.', category: 'loose-pieces' },
          },
        ],
      },
    })
    await saveGame(reviewed)
    expect(await syncMistakePuzzles([reviewed], 0)).toBe(1)
    expect(await syncMistakePuzzles([reviewed], 0)).toBe(0) // not added twice
    // Master it, so its "never due" time must survive JSON.
    let p = mistakePuzzlesFromGame(reviewed, 0)[0]
    for (let i = 0; i < MASTERED_BOX; i++) p = schedule(p, 'solved', 0)
    await saveMistakePuzzle(p)
    await setGoal({ games: 2, puzzles: 10 })
    await countPuzzleDone(Date.now())
    await addDrills([newDrill({ id: 'e4 e5 Nf3', eco: 'C40', name: "King's Knight Opening", san: ['e4', 'e5', 'Nf3'] }, 'w', 5)])
    await recordAttempt({ id: 'x:1', puzzleId: 'x', at: 1, solved: true, themes: ['fork'], puzzleRating: 1200, ratingBefore: 1200, ratingAfter: 1216 })

    const file = await exportBackup()
    globalThis.indexedDB = new IDBFactory()
    resetDbForTests()

    expect(await importBackup(file)).toEqual({ restored: 1, skipped: 0, puzzles: 2, openings: 1 })
    expect((await listDrills()).map((d) => [d.id, d.uci.join(' ')])).toEqual([['w:e4 e5 Nf3', 'e2e4 e7e5 g1f3']])
    const goal = await loadGoalData()
    expect(goal.goal).toEqual({ games: 2, puzzles: 10 })
    expect(Object.values(goal.puzzleDays)).toEqual([1])
    expect(await getPuzzleRating()).toBe(1216)
    expect((await listAttempts()).map((a) => a.id)).toEqual(['x:1'])
    const [restored] = await listMistakePuzzles()
    expect(restored.box).toBe(MASTERED_BOX)
    expect(restored.dueAt).toBe(p.dueAt)
  })

  it('still restores an old games-only backup', async () => {
    const old = JSON.stringify({ app: 'chess-guru', version: 1, exportedAt: 1, games: [game('old', 1)] })
    expect(await importBackup(old)).toEqual({ restored: 1, skipped: 0, puzzles: 0, openings: 0 })
  })
})
