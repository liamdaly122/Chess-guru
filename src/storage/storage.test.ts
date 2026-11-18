import 'fake-indexeddb/auto'
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

    expect(await importBackup(file)).toEqual({ restored: 2, skipped: 0 })
    expect((await listGames()).map((g) => g.id)).toEqual(['b', 'a'])
  })

  it('skips broken entries and rejects files that are not backups', async () => {
    const file = JSON.stringify({ app: 'chess-guru', version: 1, games: [game('ok', 1), { id: 3 }] })
    expect(await importBackup(file)).toEqual({ restored: 1, skipped: 1 })
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
