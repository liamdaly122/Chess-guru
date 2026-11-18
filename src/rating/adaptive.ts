import { ADAPTIVE } from '../config/rating'
import { LEVELS } from '../config/levels'

export type Outcome = 'win' | 'loss' | 'draw'

/** The level for the next game after this result (stays within the list of levels). */
export function nextLevelRating(current: number, outcome: Outcome, takebacks = 0): number {
  const i = Math.max(0, LEVELS.findIndex((l) => l.rating === current))
  let step = ADAPTIVE[outcome]
  if (outcome === 'win' && takebacks > 0 && !ADAPTIVE.takebackWinsCount) step = 0
  return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, i + step))].rating
}
