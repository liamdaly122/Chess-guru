import type { GameRecord } from '../storage/types'

/**
 * Daily goal and streaks, as pure functions. A day is the user's local calendar day, written
 * "2026-11-18". A streak is the run of days, up to today, on which the goal was met; today
 * only breaks it at midnight, so a streak from yesterday still counts while today is open.
 */
export interface Goal {
  /** Games finished (against the bot, or played on Lichess that day). 0 = not part of the goal. */
  games: number
  /** Puzzles done: puzzles, mistake puzzles and opening lines. */
  puzzles: number
}

export function dayKey(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** The day before, as a key (calendar arithmetic, so clock changes don't matter). */
export function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d - 1, 12).getTime())
}

export function goalIsOff(goal: Goal): boolean {
  return goal.games <= 0 && goal.puzzles <= 0
}

export function goalMet(goal: Goal, done: { games: number; puzzles: number }): boolean {
  return !goalIsOff(goal) && done.games >= goal.games && done.puzzles >= goal.puzzles
}

/** Games finished on a given day. */
export function gamesOn(games: GameRecord[], day: string): number {
  return games.filter((g) => g.result !== '*' && dayKey(g.endedAt) === day).length
}

/** Current streak: days in a row with the goal met, ending today (or yesterday while today is open). */
export function currentStreak(metDays: Iterable<string>, today: string): number {
  const met = new Set(metDays)
  let day = met.has(today) ? today : previousDay(today)
  let n = 0
  while (met.has(day)) {
    n++
    day = previousDay(day)
  }
  return n
}

/** Longest run of days in a row with the goal met. */
export function bestStreak(metDays: Iterable<string>): number {
  const met = new Set(metDays)
  let best = 0
  for (const day of met) {
    if (met.has(previousDay(day))) continue // not the start of a run
    let n = 0
    let d = day
    while (met.has(d)) {
      n++
      d = nextDay(d)
    }
    best = Math.max(best, n)
  }
  return best
}

function nextDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + 1, 12).getTime())
}
