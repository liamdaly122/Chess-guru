import { isPattern, PATTERNS } from '../../puzzles/patterns'

/**
 * Train's pages, as the part of the route after `#/train/`. No page = the Train home.
 * Puzzle theme names (from the Lichess puzzle data) open the puzzle trainer on that theme.
 */

/** Your mistakes: the page, today's set, more after today's set, and one pattern's set. */
export const MISTAKES = 'mistakes'
export const MISTAKES_TODAY = 'mistakes-today'
export const MISTAKES_MORE = 'mistakes-more'
export const MISTAKE_PATTERN_PREFIX = 'mistakes-p-'

export function isMistakesRoute(page: string | undefined): boolean {
  return !!page && (page === MISTAKES || page.startsWith(`${MISTAKES}-`))
}

/** Rated puzzles, mixed from your weak spots. */
export const PUZZLES = 'puzzles'

/** Play it out: positions from your games to win or hold. */
export const PLAY_IT_OUT_PAGE = 'play-it-out'

/** Endgame drills. */
export const ENDGAMES = 'endgames'

/** Lessons: the list, and one lesson ("lesson-forks"). */
export const LESSONS_ROUTE = 'lessons'
export const LESSON_PREFIX = 'lesson-'

/** Opening trainer: practice, and the lines you learn. */
export const OPENINGS = 'openings'
export const OPENING_LINES = 'openings-lines'

/** The title of a mistakes page: the page itself, today's set, more, or one pattern's set. */
export function mistakesTitle(page: string): string {
  if (page === MISTAKES_TODAY) return "Today's mistakes"
  if (page === MISTAKES_MORE) return 'More of your mistakes'
  const pattern = page.startsWith(MISTAKE_PATTERN_PREFIX) ? page.slice(MISTAKE_PATTERN_PREFIX.length) : ''
  return isPattern(pattern) ? PATTERNS[pattern].label : 'Your mistakes'
}

/** Board vision drills: the list, and a set ("vision-loose", "vision-mixed"). */
export const VISION = 'vision'
export const VISION_PREFIX = 'vision-'
