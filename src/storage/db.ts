import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { MistakePuzzle } from '../puzzles/mistakes'
import type { GameRecord, PuzzleAttempt } from './types'

/**
 * Local database in the browser (IndexedDB). Nothing leaves the device.
 * Bump DB_VERSION and add a step in `upgrade` whenever the stores change.
 */
interface GuruDB extends DBSchema {
  games: {
    key: string
    value: GameRecord
    indexes: { byEndedAt: number }
  }
  puzzleAttempts: {
    key: string
    value: PuzzleAttempt
    indexes: { byAt: number }
  }
  /** Puzzles made from your own mistakes, with their review schedule. */
  mistakePuzzles: {
    key: string
    value: MistakePuzzle
    indexes: { byDue: number }
  }
  /** Small settings that must survive, e.g. the puzzle rating. */
  meta: {
    key: string
    value: { key: string; value: unknown }
  }
}

const DB_NAME = 'chess-guru'
const DB_VERSION = 3

let dbPromise: Promise<IDBPDatabase<GuruDB>> | null = null

export function getDb(): Promise<IDBPDatabase<GuruDB>> {
  dbPromise ??= openDB<GuruDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const games = db.createObjectStore('games', { keyPath: 'id' })
        games.createIndex('byEndedAt', 'endedAt')
      }
      if (oldVersion < 2) {
        const attempts = db.createObjectStore('puzzleAttempts', { keyPath: 'id' })
        attempts.createIndex('byAt', 'at')
        db.createObjectStore('meta', { keyPath: 'key' })
      }
      if (oldVersion < 3) {
        const mistakes = db.createObjectStore('mistakePuzzles', { keyPath: 'id' })
        mistakes.createIndex('byDue', 'dueAt')
      }
    },
  })
  return dbPromise
}

/** For tests: forget the open connection so a fresh fake database is used. */
export function resetDbForTests(): void {
  dbPromise = null
}
