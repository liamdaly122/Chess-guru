import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { GameRecord } from './types'

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
}

const DB_NAME = 'chess-guru'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<GuruDB>> | null = null

export function getDb(): Promise<IDBPDatabase<GuruDB>> {
  dbPromise ??= openDB<GuruDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const games = db.createObjectStore('games', { keyPath: 'id' })
        games.createIndex('byEndedAt', 'endedAt')
      }
    },
  })
  return dbPromise
}

/** For tests: forget the open connection so a fresh fake database is used. */
export function resetDbForTests(): void {
  dbPromise = null
}
