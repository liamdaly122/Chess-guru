import { buildPgn } from '../pgn/exportPgn'
import { getDb } from './db'
import type { GameRecord } from './types'

/** Fires whenever a game is saved or deleted, so lists can refresh. */
export const gamesChanged = new EventTarget()

function notify() {
  gamesChanged.dispatchEvent(new Event('change'))
}

/** Save (insert or replace) a game. The PGN is rebuilt so it always matches the review. */
export async function saveGame(game: GameRecord): Promise<void> {
  const db = await getDb()
  await db.put('games', { ...game, pgn: buildPgn(game) })
  notify()
}

/** Save several games in one transaction (Lichess import, backup restore). Existing reviews are kept. */
export async function saveGames(games: GameRecord[], { keepExistingReview = true } = {}): Promise<number> {
  const db = await getDb()
  const tx = db.transaction('games', 'readwrite')
  let added = 0
  for (const g of games) {
    const existing = await tx.store.get(g.id)
    if (!existing) added++
    const merged = keepExistingReview && existing?.review && !g.review ? { ...g, review: existing.review } : g
    await tx.store.put({ ...merged, pgn: buildPgn(merged) })
  }
  await tx.done
  notify()
  return added
}

export async function getGame(id: string): Promise<GameRecord | undefined> {
  return (await getDb()).get('games', id)
}

/** All games, newest first. */
export async function listGames(): Promise<GameRecord[]> {
  const all = await (await getDb()).getAllFromIndex('games', 'byEndedAt')
  return all.reverse()
}

export async function deleteGame(id: string): Promise<void> {
  await (await getDb()).delete('games', id)
  notify()
}
