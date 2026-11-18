import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '../storage/db'
import type { GameRecord } from '../storage/types'
import { countPuzzleDone, dailyGoal, loadGoalData, setGoal } from './goalStore'
import { goalStatusText } from './goalText'
import { bestStreak, currentStreak, dayKey, gamesOn, goalMet, previousDay } from './streak'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()

describe('days and streaks', () => {
  it('uses the local calendar day', () => {
    expect(dayKey(at(2026, 11, 18, 0))).toBe('2026-11-18')
    expect(dayKey(at(2026, 11, 18, 23))).toBe('2026-11-18')
    expect(previousDay('2026-03-01')).toBe('2026-02-28')
    expect(previousDay('2026-01-01')).toBe('2025-12-31')
  })

  it('counts the streak up to today, or up to yesterday while today is still open', () => {
    const days = ['2026-11-15', '2026-11-16', '2026-11-17']
    expect(currentStreak(days, '2026-11-17')).toBe(3)
    expect(currentStreak(days, '2026-11-18')).toBe(3) // today not done yet
    expect(currentStreak(days, '2026-11-19')).toBe(0) // missed yesterday
    expect(currentStreak([...days, '2026-11-18'], '2026-11-18')).toBe(4)
  })

  it('finds the best streak', () => {
    expect(bestStreak(['2026-11-01', '2026-11-02', '2026-11-05', '2026-11-06', '2026-11-07'])).toBe(3)
    expect(bestStreak([])).toBe(0)
  })

  it('checks the goal', () => {
    expect(goalMet({ games: 1, puzzles: 5 }, { games: 1, puzzles: 5 })).toBe(true)
    expect(goalMet({ games: 1, puzzles: 5 }, { games: 2, puzzles: 4 })).toBe(false)
    expect(goalMet({ games: 0, puzzles: 3 }, { games: 0, puzzles: 3 })).toBe(true)
    expect(goalMet({ games: 0, puzzles: 0 }, { games: 9, puzzles: 9 })).toBe(false) // goal off
  })

  it('counts finished games on a day', () => {
    const g = (endedAt: number, result: GameRecord['result'] = '1-0') => ({ endedAt, result }) as GameRecord
    expect(gamesOn([g(at(2026, 11, 18, 9)), g(at(2026, 11, 18, 22)), g(at(2026, 11, 17)), g(at(2026, 11, 18), '*')], '2026-11-18')).toBe(2)
  })
})

describe('daily goal store', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory()
    resetDbForTests()
  })

  it('starts with 1 game and 5 puzzles, counts puzzles per day and describes what is left', async () => {
    const today = at(2026, 11, 18)
    for (let i = 0; i < 3; i++) await countPuzzleDone(today)
    await countPuzzleDone(at(2026, 11, 17))
    const data = await loadGoalData()
    expect(data.goal).toEqual({ games: 1, puzzles: 5 })
    expect(data.puzzleDays).toEqual({ '2026-11-17': 1, '2026-11-18': 3 })

    const g = dailyGoal({ ...data, goalDays: ['2026-11-17'] }, [], '2026-11-18')
    expect(g).toMatchObject({ done: { games: 0, puzzles: 3 }, met: false, streak: 1, celebrate: false })
    expect(goalStatusText(g)).toBe('1 game and 2 puzzles to go to keep your streak.')
  })

  it('a met goal extends the streak and is due a message once', async () => {
    await setGoal({ games: 0, puzzles: 2 })
    await countPuzzleDone(at(2026, 11, 18))
    await countPuzzleDone(at(2026, 11, 18))
    const data = await loadGoalData()
    const g = dailyGoal({ ...data, goalDays: ['2026-11-16', '2026-11-17'] }, [], '2026-11-18')
    expect(g).toMatchObject({ met: true, streak: 3, celebrate: true })
    expect(goalStatusText(g)).toBe('Done for today.')
    expect(dailyGoal({ ...data, celebrated: '2026-11-18' }, [], '2026-11-18').celebrate).toBe(false)
  })

  it("doesn't lose changes made at the same moment", async () => {
    await Promise.all([setGoal({ games: 0 }), setGoal({ puzzles: 3 })])
    await Promise.all(Array.from({ length: 5 }, () => countPuzzleDone(at(2026, 11, 18))))
    const data = await loadGoalData()
    expect(data.goal).toEqual({ games: 0, puzzles: 3 })
    expect(data.puzzleDays['2026-11-18']).toBe(5)
  })

  it('keeps only recent puzzle counts', async () => {
    await countPuzzleDone(at(2026, 1, 1))
    await countPuzzleDone(at(2026, 11, 18))
    expect(Object.keys((await loadGoalData()).puzzleDays)).toEqual(['2026-11-18'])
  })
})
