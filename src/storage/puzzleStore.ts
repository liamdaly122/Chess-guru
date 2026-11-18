import { getDb } from './db'
import type { PuzzleAttempt } from './types'

export const puzzlesChanged = new EventTarget()
export const DEFAULT_PUZZLE_RATING = 1200

export async function getPuzzleRating(): Promise<number> {
  const row = await (await getDb()).get('meta', 'puzzleRating')
  return typeof row?.value === 'number' ? row.value : DEFAULT_PUZZLE_RATING
}

export async function setPuzzleRating(rating: number): Promise<void> {
  await (await getDb()).put('meta', { key: 'puzzleRating', value: Math.round(rating) })
  puzzlesChanged.dispatchEvent(new Event('change'))
}

/** Save an attempt and the new rating together. */
export async function recordAttempt(attempt: PuzzleAttempt): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['puzzleAttempts', 'meta'], 'readwrite')
  await tx.objectStore('puzzleAttempts').put(attempt)
  await tx.objectStore('meta').put({ key: 'puzzleRating', value: attempt.ratingAfter })
  await tx.done
  puzzlesChanged.dispatchEvent(new Event('change'))
}

/** All attempts, oldest first. */
export async function listAttempts(): Promise<PuzzleAttempt[]> {
  return (await getDb()).getAllFromIndex('puzzleAttempts', 'byAt')
}

export interface ThemeRecord {
  theme: string
  tried: number
  solved: number
}

/** Solve rate per theme, from attempts. */
export function themeRecords(attempts: PuzzleAttempt[]): ThemeRecord[] {
  const map = new Map<string, ThemeRecord>()
  for (const a of attempts) {
    for (const t of a.themes) {
      const r = map.get(t) ?? { theme: t, tried: 0, solved: 0 }
      r.tried++
      if (a.solved) r.solved++
      map.set(t, r)
    }
  }
  return [...map.values()].sort((a, b) => b.tried - a.tried)
}
