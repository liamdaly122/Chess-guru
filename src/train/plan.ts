import { dayKey } from '../goal/streak'
import { LESSONS } from '../lessons/lessons'
import type { LessonCategory } from '../review/types'

/** How many rated puzzles the plan asks for each day. */
export const PLAN_PUZZLES = 5
/** A lesson practised within this many days isn't suggested again. */
export const PLAN_LESSON_DAYS = 7

/** One step of today's plan on the Train page. `page` is the Train sub-page it opens. */
export interface PlanItem {
  id: 'mistakes' | 'openings' | 'lesson' | 'puzzles'
  title: string
  detail: string
  page: string
  done: boolean
}

export interface PlanInput {
  now: number
  /** Today's mistake set: positions still to solve today, and how many were solved today. */
  mistakes: { left: number; doneToday: number } | null
  /** Opening lines due (including new ones), and when a line was last practised. */
  openings: { due: number; lastAt: number | null } | null
  /** Lessons, most needed first, with when each was last practised. */
  lessons: { category: LessonCategory; lastAt: number | null }[]
  /** Rated puzzles tried today. */
  puzzlesToday: number
  /** Routes for each step. */
  pages: { mistakes: string; openings: string; lesson: (c: LessonCategory) => string; puzzles: string }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Today's plan: a short list built from what is waiting, your games first. Steps already
 * done today stay on the list, ticked, so the list doesn't shrink under you.
 */
export function trainPlan({ now, mistakes, openings, lessons, puzzlesToday, pages }: PlanInput): PlanItem[] {
  const today = dayKey(now)
  const isToday = (t: number | null | undefined) => !!t && dayKey(t) === today
  const items: PlanItem[] = []

  if (mistakes && (mistakes.left > 0 || mistakes.doneToday > 0)) {
    items.push({
      id: 'mistakes',
      title: "Today's mistakes",
      detail: mistakes.left > 0 ? `${plural(mistakes.left, 'position')} from your games` : `${plural(mistakes.doneToday, 'position')} solved`,
      page: pages.mistakes,
      done: mistakes.left === 0,
    })
  }

  if (openings && (openings.due > 0 || isToday(openings.lastAt))) {
    items.push({
      id: 'openings',
      title: 'Opening lines',
      detail: openings.due > 0 ? `${plural(openings.due, 'line')} to practise` : 'Practised today',
      page: pages.openings,
      done: openings.due === 0,
    })
  }

  // The most needed lesson you haven't practised lately (or the one you did today).
  const recent = (t: number | null) => !!t && now - t < PLAN_LESSON_DAYS * 86_400_000
  const lesson = lessons.find((l) => isToday(l.lastAt)) ?? lessons.find((l) => !recent(l.lastAt))
  if (lesson) {
    items.push({
      id: 'lesson',
      title: `Lesson: ${LESSONS[lesson.category].title}`,
      detail: isToday(lesson.lastAt) ? 'Practised today' : 'Read it, then 5 puzzles',
      page: pages.lesson(lesson.category),
      done: isToday(lesson.lastAt),
    })
  }

  items.push({
    id: 'puzzles',
    title: 'Rated puzzles',
    detail: `${Math.min(puzzlesToday, PLAN_PUZZLES)} of ${PLAN_PUZZLES} today`,
    page: pages.puzzles,
    done: puzzlesToday >= PLAN_PUZZLES,
  })
  return items
}
