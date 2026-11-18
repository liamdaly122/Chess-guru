import type { MoveJudgement } from '../chess/classify'
import { BLUNDER_CHECK } from '../config/blunderCheck'

/**
 * Should blunder check stop the user after this move? Only for a rated blunder (not while the
 * rating is still being worked out), not when they were already clearly lost, not once the game
 * is over, and only once for the same move.
 */
export function needsBlunderCheck(
  rating: MoveJudgement | 'pending' | null | undefined,
  { on, gameOver, alreadyAsked }: { on: boolean; gameOver: boolean; alreadyAsked: boolean },
): boolean {
  if (!on || gameOver || alreadyAsked || !rating || rating === 'pending') return false
  return BLUNDER_CHECK.ratings.includes(rating.rating) && rating.winBefore > BLUNDER_CHECK.minWinBefore
}
