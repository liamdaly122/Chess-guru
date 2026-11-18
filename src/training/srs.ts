/**
 * Spaced repetition shared by the trainers (mistake puzzles, opening lines). An item sits in a
 * box: a clean solve moves it up a box and it comes back after that box's interval; solving it
 * cleanly from the last box masters it. Help keeps it in its box; failing sends it back to box 0.
 */

/** solved: first try, no help. helped: solved with a hint or after wrong tries. failed: answer shown. */
export type PuzzleResult = 'solved' | 'helped' | 'failed'

export interface SrsSettings {
  /** Days until the next review after a clean solve, per box (box 1 = first entry). */
  intervalsDays: readonly number[]
  /** After a fail, ask again this many minutes later. */
  retryMinutes: number
  /** Solved with help: same box, back after this many days. */
  helpedDays: number
}

export interface Scheduled {
  /** 0 = new or being relearnt; the last box + 1 = mastered. */
  box: number
  dueAt: number
  attempts: number
  cleanSolves: number
  lastResult?: PuzzleResult
  lastAt?: number
}

export const DAY = 24 * 60 * 60 * 1000
export const MINUTE = 60 * 1000
/** "Due" time for mastered items. A big ordinary number, not Infinity, so it survives JSON backups. */
export const NEVER = Number.MAX_SAFE_INTEGER

export function masteredBox(s: SrsSettings): number {
  return s.intervalsDays.length + 1
}

/** The item's schedule after an attempt. */
export function nextSchedule<T extends Scheduled>(item: T, result: PuzzleResult, s: SrsSettings, now = Date.now()): T {
  const base = { ...item, attempts: item.attempts + 1, lastResult: result, lastAt: now }
  if (result === 'solved') {
    const top = masteredBox(s)
    const box = Math.min(item.box + 1, top)
    const days = s.intervalsDays[box - 1]
    return { ...base, box, cleanSolves: item.cleanSolves + 1, dueAt: box >= top ? NEVER : now + days * DAY }
  }
  if (result === 'helped') return { ...base, dueAt: now + s.helpedDays * DAY }
  return { ...base, box: 0, dueAt: now + s.retryMinutes * MINUTE }
}

/** "in 10 minutes", "tomorrow", "in 3 days" */
export function whenText(dueAt: number, now = Date.now()): string {
  if (dueAt >= NEVER) return 'never (mastered)'
  const ms = dueAt - now
  if (ms <= 0) return 'now'
  if (ms < 60 * MINUTE) {
    const m = Math.max(1, Math.round(ms / MINUTE))
    return `in ${m} minute${m === 1 ? '' : 's'}`
  }
  if (ms < 20 * 60 * MINUTE) {
    const h = Math.round(ms / (60 * MINUTE))
    return `in ${h} hour${h === 1 ? '' : 's'}`
  }
  const days = Math.round(ms / DAY)
  return days === 1 ? 'tomorrow' : `in ${days} days`
}
