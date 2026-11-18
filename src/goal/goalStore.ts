import { useEffect, useMemo, useState } from 'react'
import { GOAL } from '../config/goal'
import { getDb } from '../storage/db'
import type { GameRecord } from '../storage/types'
import { useGames } from '../storage/useGames'
import { bestStreak, currentStreak, dayKey, gamesOn, goalIsOff, goalMet, type Goal } from './streak'

/**
 * Stored in the `meta` store:
 *  - goal:         the daily goal
 *  - puzzleDays:   puzzles done per day, { "2026-11-18": 4 } (games are counted from the games store)
 *  - goalDays:     days on which the goal was met, kept even if the goal changes later
 *  - goalCelebrated: the last day the "goal done" message was shown
 */
export interface GoalData {
  goal: Goal
  puzzleDays: Record<string, number>
  goalDays: string[]
  celebrated: string | null
}

export const goalChanged = new EventTarget()
const notify = () => goalChanged.dispatchEvent(new Event('change'))

async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await (await getDb()).get('meta', key)
  return row === undefined ? fallback : (row.value as T)
}

async function putMeta(key: string, value: unknown): Promise<void> {
  await (await getDb()).put('meta', { key, value })
}

/**
 * Read, change and write one value in a single transaction. IndexedDB runs overlapping
 * read-write transactions on a store one after another, so quick updates can't overwrite each other.
 */
async function updateMeta<T>(key: string, fallback: T, change: (value: T) => T): Promise<void> {
  const tx = (await getDb()).transaction('meta', 'readwrite')
  const row = await tx.store.get(key)
  await tx.store.put({ key, value: change(row === undefined ? fallback : (row.value as T)) })
  await tx.done
}

export async function loadGoalData(): Promise<GoalData> {
  return {
    goal: await getMeta<Goal>('goal', { games: GOAL.defaultGames, puzzles: GOAL.defaultPuzzles }),
    puzzleDays: await getMeta<Record<string, number>>('puzzleDays', {}),
    goalDays: await getMeta<string[]>('goalDays', []),
    celebrated: await getMeta<string | null>('goalCelebrated', null),
  }
}

/** Change part of the goal. Merged with the stored goal, so quick changes in a row don't undo each other. */
export async function setGoal(patch: Partial<Goal>): Promise<void> {
  await updateMeta<Goal>('goal', { games: GOAL.defaultGames, puzzles: GOAL.defaultPuzzles }, (g) => ({ ...g, ...patch }))
  notify()
}

/** Count one finished puzzle, mistake puzzle or opening line towards today's goal. */
export async function countPuzzleDone(at = Date.now()): Promise<void> {
  const today = dayKey(at)
  const oldest = dayKey(at - GOAL.keepDays * 24 * 60 * 60 * 1000)
  await updateMeta<Record<string, number>>('puzzleDays', {}, (days) => {
    const kept = Object.fromEntries(Object.entries(days).filter(([d]) => d >= oldest))
    kept[today] = (kept[today] ?? 0) + 1
    return kept
  })
  notify()
}

async function recordMetDay(day: string): Promise<void> {
  let added = false
  await updateMeta<string[]>('goalDays', [], (days) => {
    if (days.includes(day)) return days
    added = true
    return [...days, day].sort()
  })
  if (added) notify()
}

export async function markCelebrated(day: string): Promise<void> {
  await putMeta('goalCelebrated', day)
  notify()
}

/** Replace all goal data (restore from a backup). */
export async function restoreGoalData(d: Partial<GoalData>): Promise<void> {
  if (d.goal) await putMeta('goal', d.goal)
  if (d.puzzleDays) await updateMeta<Record<string, number>>('puzzleDays', {}, (days) => ({ ...days, ...d.puzzleDays }))
  if (d.goalDays) await updateMeta<string[]>('goalDays', [], (days) => [...new Set([...days, ...d.goalDays!])].sort())
  notify()
}

export interface DailyGoal {
  goal: Goal
  off: boolean
  today: string
  done: { games: number; puzzles: number }
  met: boolean
  streak: number
  best: number
  /** The "goal done" message is due (met today, not yet shown). */
  celebrate: boolean
}

export function dailyGoal(data: GoalData, games: GameRecord[], today: string): DailyGoal {
  const done = { games: gamesOn(games, today), puzzles: data.puzzleDays[today] ?? 0 }
  const met = goalMet(data.goal, done)
  const days = met && !data.goalDays.includes(today) ? [...data.goalDays, today] : data.goalDays
  return {
    goal: data.goal,
    off: goalIsOff(data.goal),
    today,
    done,
    met,
    streak: currentStreak(days, today),
    best: bestStreak(days),
    celebrate: met && data.celebrated !== today,
  }
}

/** Today's goal and the streak, kept up to date. Records the day once the goal is met. null while loading. */
export function useDailyGoal(): DailyGoal | null {
  const games = useGames()
  const [state, setState] = useState<{ data: GoalData; today: string } | null>(null)
  useEffect(() => {
    let live = true
    const load = () => loadGoalData().then((data) => live && setState({ data, today: dayKey(Date.now()) }))
    void load()
    goalChanged.addEventListener('change', load)
    // A new day while the app stays open: reload when it comes back on screen.
    document.addEventListener('visibilitychange', load)
    return () => {
      live = false
      goalChanged.removeEventListener('change', load)
      document.removeEventListener('visibilitychange', load)
    }
  }, [])
  const goal = useMemo(() => (state && games ? dailyGoal(state.data, games, state.today) : null), [state, games])
  useEffect(() => {
    if (goal?.met && state && !state.data.goalDays.includes(goal.today)) void recordMetDay(goal.today)
  }, [goal, state])
  return goal
}
