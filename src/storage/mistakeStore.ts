import { mistakePuzzlesFromGame, type MistakePuzzle } from '../puzzles/mistakes'
import { getDb } from './db'
import type { GameRecord } from './types'

export const mistakesChanged = new EventTarget()

function notify() {
  mistakesChanged.dispatchEvent(new Event('change'))
}

export async function listMistakePuzzles(): Promise<MistakePuzzle[]> {
  return (await getDb()).getAll('mistakePuzzles')
}

export async function saveMistakePuzzle(p: MistakePuzzle): Promise<void> {
  await (await getDb()).put('mistakePuzzles', p)
  notify()
}

/**
 * Add puzzles for mistakes in reviewed games that don't have one yet. Existing puzzles keep
 * their schedule. Returns how many were added.
 */
export async function syncMistakePuzzles(games: GameRecord[], now = Date.now()): Promise<number> {
  const candidates = games.flatMap((g) => mistakePuzzlesFromGame(g, now))
  if (candidates.length === 0) return 0
  const db = await getDb()
  const tx = db.transaction('mistakePuzzles', 'readwrite')
  let added = 0
  for (const p of candidates) {
    if (await tx.store.getKey(p.id)) continue
    await tx.store.put(p)
    added++
  }
  await tx.done
  if (added) notify()
  return added
}
