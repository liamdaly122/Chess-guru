import { groupByPosition, mergePuzzle, mistakePuzzlesFromGame, type MistakePuzzle } from '../puzzles/mistakes'
import { positionKey } from '../openings/book'
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

/** A puzzle saved before puzzles were grouped by position (one per game and move). */
function isOldFormat(p: MistakePuzzle): boolean {
  return !Array.isArray((p as Partial<MistakePuzzle>).occurrences)
}

/**
 * Bring the stored puzzles in line with your reviewed games: one puzzle per position, only the
 * mistakes that mattered, at most a few per game. New occurrences are merged in and existing
 * schedules kept. Puzzles from before this grouping are replaced: their progress moves to the
 * puzzle for the same position if there is one, and the rest are dropped.
 * Returns how many puzzles were added.
 */
export async function syncMistakePuzzles(games: GameRecord[], now = Date.now()): Promise<number> {
  const candidates = groupByPosition(games.flatMap((g) => mistakePuzzlesFromGame(g, now)), now)
  const db = await getDb()
  const tx = db.transaction('mistakePuzzles', 'readwrite')
  const stored = await tx.store.getAll()
  const old = stored.filter(isOldFormat)
  const current = new Map(stored.filter((p) => !isOldFormat(p)).map((p) => [p.id, p]))
  let added = 0
  let changed = old.length > 0

  for (const [id, fresh] of candidates) {
    let next = mergePuzzle(current.get(id), fresh, now)
    if (!current.has(id)) {
      added++
      // Carry over the furthest progress from the old puzzles for this position.
      const before = old.filter((o) => positionKey(o.fen) === id && o.attempts > 0).sort((a, b) => b.box - a.box || b.attempts - a.attempts)[0]
      if (before) {
        next = { ...next, box: before.box, dueAt: before.dueAt, attempts: before.attempts, cleanSolves: before.cleanSolves, lastResult: before.lastResult, lastAt: before.lastAt }
        added--
      }
    }
    if (next !== current.get(id)) {
      await tx.store.put(next)
      changed = true
    }
  }
  for (const o of old) await tx.store.delete(o.id)
  await tx.done
  if (changed) notify()
  return added
}
