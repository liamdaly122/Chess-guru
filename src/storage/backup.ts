import type { OpeningDrill } from '../openings/drill'
import type { MistakePuzzle } from '../puzzles/mistakes'
import { getDb } from './db'
import { listGames, saveGames } from './games'
import { mistakesChanged } from './mistakeStore'
import { drillsChanged } from './openingStore'
import { loadGoalData, restoreGoalData, type GoalData } from '../goal/goalStore'
import { getPracticeRecords, restorePracticeRecords, type PracticeRecords } from '../practice/practiceStore'
import { getPuzzleRating, listAttempts, puzzlesChanged } from './puzzleStore'
import type { GameRecord, PuzzleAttempt } from './types'

/**
 * Backups. Everything lives only in this browser, which can lose it (deleting the app, clearing
 * website data, a new phone), so the Games page offers a backup file and a restore. On iPhone
 * the backup opens the share sheet, where "Save to Files" can put it in iCloud Drive.
 */

interface BackupFile {
  app: 'chess-guru'
  /**
   * 1: games only. 2: also puzzle rating, puzzle attempts and mistake puzzles. 3: also opening
   * lines. 4: also the daily goal, puzzles done per day and the days the goal was met. 5: also
   * your Play it out tries.
   */
  version: 1 | 2 | 3 | 4 | 5
  exportedAt: number
  games: GameRecord[]
  puzzleRating?: number
  puzzleAttempts?: PuzzleAttempt[]
  mistakePuzzles?: MistakePuzzle[]
  openingDrills?: OpeningDrill[]
  goal?: Pick<GoalData, 'goal' | 'puzzleDays' | 'goalDays'>
  practice?: PracticeRecords
}

export async function exportBackup(): Promise<string> {
  const db = await getDb()
  const file: BackupFile = {
    app: 'chess-guru',
    version: 5,
    exportedAt: Date.now(),
    games: await listGames(),
    puzzleRating: await getPuzzleRating(),
    puzzleAttempts: await listAttempts(),
    mistakePuzzles: await db.getAll('mistakePuzzles'),
    openingDrills: await db.getAll('openingDrills'),
    goal: await loadGoalData().then(({ goal, puzzleDays, goalDays }) => ({ goal, puzzleDays, goalDays })),
    practice: await getPracticeRecords(),
  }
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

function looksLikeAttempt(a: unknown): a is PuzzleAttempt {
  const r = a as Partial<PuzzleAttempt> | null
  return !!r && typeof r.id === 'string' && typeof r.puzzleId === 'string' && typeof r.at === 'number'
}

function looksLikeMistake(m: unknown): m is MistakePuzzle {
  const r = m as Partial<MistakePuzzle> | null
  return !!r && typeof r.id === 'string' && typeof r.fen === 'string' && typeof r.solution === 'string' && typeof r.dueAt === 'number'
}

function looksLikeDrill(d: unknown): d is OpeningDrill {
  const r = d as Partial<OpeningDrill> | null
  return (
    !!r &&
    typeof r.id === 'string' &&
    Array.isArray(r.uci) &&
    Array.isArray(r.san) &&
    (r.side === 'w' || r.side === 'b') &&
    typeof r.dueAt === 'number'
  )
}

export interface RestoreResult {
  restored: number
  skipped: number
  puzzles: number
  openings: number
}

/**
 * Restore from a backup file. Games, puzzle attempts, mistake puzzles and opening lines in the backup replace
 * the same ones here; anything else here is kept.
 */
export async function importBackup(text: string): Promise<RestoreResult> {
  let data: Partial<BackupFile>
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file isn’t a Chess Guru backup.')
  }
  if (data.app !== 'chess-guru' || !Array.isArray(data.games)) throw new Error('That file isn’t a Chess Guru backup.')
  const valid = data.games.filter(looksLikeGame)
  await saveGames(valid, { keepExistingReview: true })

  const attempts = (data.puzzleAttempts ?? []).filter(looksLikeAttempt)
  const mistakes = (data.mistakePuzzles ?? []).filter(looksLikeMistake)
  const drills = (data.openingDrills ?? []).filter(looksLikeDrill)
  if (attempts.length || mistakes.length || drills.length || typeof data.puzzleRating === 'number') {
    const db = await getDb()
    const tx = db.transaction(['puzzleAttempts', 'mistakePuzzles', 'openingDrills', 'meta'], 'readwrite')
    for (const a of attempts) await tx.objectStore('puzzleAttempts').put(a)
    for (const m of mistakes) await tx.objectStore('mistakePuzzles').put(m)
    for (const d of drills) await tx.objectStore('openingDrills').put(d)
    if (typeof data.puzzleRating === 'number') {
      await tx.objectStore('meta').put({ key: 'puzzleRating', value: Math.round(data.puzzleRating) })
    }
    await tx.done
    puzzlesChanged.dispatchEvent(new Event('change'))
    mistakesChanged.dispatchEvent(new Event('change'))
    drillsChanged.dispatchEvent(new Event('change'))
  }
  const goal = data.goal
  if (goal && typeof goal === 'object') {
    const okGoal = goal.goal && typeof goal.goal.games === 'number' && typeof goal.goal.puzzles === 'number'
    const okDays = Array.isArray(goal.goalDays) && goal.goalDays.every((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
    const okCounts = goal.puzzleDays && typeof goal.puzzleDays === 'object' && Object.values(goal.puzzleDays).every((n) => typeof n === 'number')
    await restoreGoalData({
      goal: okGoal ? goal.goal : undefined,
      goalDays: okDays ? goal.goalDays : undefined,
      puzzleDays: okCounts ? goal.puzzleDays : undefined,
    })
  }
  if (data.practice && typeof data.practice === 'object') {
    const ok = Object.entries(data.practice).filter(
      ([id, r]) => typeof id === 'string' && r && typeof r.tries === 'number' && typeof r.successes === 'number' && typeof r.lastAt === 'number',
    )
    if (ok.length) await restorePracticeRecords(Object.fromEntries(ok))
  }
  return {
    restored: valid.length,
    skipped: data.games.length - valid.length,
    puzzles: attempts.length + mistakes.length,
    openings: drills.length,
  }
}

const LAST_BACKUP_KEY = 'lastBackupAt'

/** When the last backup was made (ms), or null. */
export async function getLastBackupAt(): Promise<number | null> {
  const row = await (await getDb()).get('meta', LAST_BACKUP_KEY)
  return typeof row?.value === 'number' ? row.value : null
}

async function setLastBackupAt(at: number): Promise<void> {
  await (await getDb()).put('meta', { key: LAST_BACKUP_KEY, value: at })
  puzzlesChanged.dispatchEvent(new Event('change'))
}

/**
 * Make a backup file and hand it to the user: the share sheet where the browser supports
 * sharing files (iPhone: "Save to Files" > iCloud Drive), otherwise a normal download.
 * Returns how it was saved, or null if the user cancelled the share sheet.
 */
export async function backUpToFile(): Promise<'shared' | 'downloaded' | null> {
  const text = await exportBackup()
  const name = `chess-guru-backup-${new Date().toISOString().slice(0, 10)}.json`
  const file = new File([text], name, { type: 'application/json' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Chess Guru backup' })
      await setLastBackupAt(Date.now())
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null
      // Sharing failed for another reason: fall back to a download.
    }
  }
  downloadText(name, text, 'application/json')
  await setLastBackupAt(Date.now())
  return 'downloaded'
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
