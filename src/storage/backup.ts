import { listGames, saveGames } from './games'
import type { GameRecord } from './types'

/**
 * Backups. Browser storage can be cleared (Safari on iPhone may do it after a while without
 * visits), so the games list offers a full backup file and a restore.
 */

interface BackupFile {
  app: 'chess-guru'
  version: 1
  exportedAt: number
  games: GameRecord[]
}

export async function exportBackup(): Promise<string> {
  const file: BackupFile = { app: 'chess-guru', version: 1, exportedAt: Date.now(), games: await listGames() }
  return JSON.stringify(file)
}

/** All games as one PGN file, with ratings and notes as comments. */
export async function exportAllPgn(): Promise<string> {
  const games = await listGames()
  return games
    .map((g) => g.pgn ?? '')
    .filter(Boolean)
    .join('\n\n')
}

function looksLikeGame(g: unknown): g is GameRecord {
  if (!g || typeof g !== 'object') return false
  const r = g as Partial<GameRecord>
  return (
    typeof r.id === 'string' &&
    (r.source === 'bot' || r.source === 'lichess') &&
    typeof r.endedAt === 'number' &&
    Array.isArray(r.moves) &&
    (r.userColor === 'w' || r.userColor === 'b')
  )
}

/** Restore games from a backup file. Games already here are replaced by the backup's version. */
export async function importBackup(text: string): Promise<{ restored: number; skipped: number }> {
  let data: Partial<BackupFile>
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file isn’t a Chess Guru backup.')
  }
  if (data.app !== 'chess-guru' || !Array.isArray(data.games)) throw new Error('That file isn’t a Chess Guru backup.')
  const valid = data.games.filter(looksLikeGame)
  await saveGames(valid, { keepExistingReview: true })
  return { restored: valid.length, skipped: data.games.length - valid.length }
}

/** Ask the browser to save a text file. */
export function downloadText(filename: string, text: string, type = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
