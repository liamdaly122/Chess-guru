import { describe, expect, it } from 'vitest'
import { trainPlan, type PlanInput } from './plan'

const now = new Date(2026, 10, 19, 12).getTime()
const day = 86_400_000
const base: PlanInput = {
  now,
  mistakes: null,
  openings: null,
  lessons: [],
  puzzlesToday: 0,
  pages: { mistakes: 'mistakes-today', openings: 'openings', lesson: (c) => `lesson-${c}`, puzzles: 'puzzles' },
}

describe("today's plan", () => {
  it('starts with your games, then puzzles', () => {
    const plan = trainPlan({
      ...base,
      mistakes: { left: 3, doneToday: 0 },
      openings: { due: 2, lastAt: null },
      lessons: [{ category: 'forks', lastAt: null }],
    })
    expect(plan.map((p) => [p.id, p.done])).toEqual([
      ['mistakes', false],
      ['openings', false],
      ['lesson', false],
      ['puzzles', false],
    ])
    expect(plan[0].detail).toBe('3 positions from your games')
    expect(plan[2]).toMatchObject({ title: 'Lesson: Watch out for forks', page: 'lesson-forks' })
  })

  it('ticks off what is done today and leaves out what has nothing waiting', () => {
    const plan = trainPlan({
      ...base,
      mistakes: { left: 0, doneToday: 5 },
      openings: { due: 0, lastAt: now - 10 * day },
      lessons: [{ category: 'forks', lastAt: now - 60_000 }],
      puzzlesToday: 7,
    })
    expect(plan.map((p) => [p.id, p.done])).toEqual([
      ['mistakes', true],
      ['lesson', true],
      ['puzzles', true],
    ])
    expect(plan[2].detail).toBe('5 of 5 today')
  })

  it('skips a lesson practised in the last week for the next one', () => {
    const plan = trainPlan({
      ...base,
      lessons: [
        { category: 'forks', lastAt: now - 3 * day },
        { category: 'loose-pieces', lastAt: null },
      ],
    })
    expect(plan.find((p) => p.id === 'lesson')?.page).toBe('lesson-loose-pieces')
  })
})
