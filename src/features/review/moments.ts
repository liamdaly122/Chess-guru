import type { MoveRating } from '../../chess/classify'
import type { KeyMoment, MomentKind } from '../../review/keyMoments'
import type { GameReview } from '../../review/types'

export const MOMENT_LABEL: Record<MomentKind, string> = {
  brilliant: 'Brilliant',
  great: 'Great move',
  blunder: 'Blunder',
  mistake: 'Mistake',
  miss: 'Missed chance',
  'opponent-mistake': 'Their mistake',
  checkmate: 'Checkmate',
}

/** The rating shown next to a key moment. */
export function momentRating(review: GameReview, m: KeyMoment): MoveRating | null {
  return review.plies[m.ply]?.judgement?.rating ?? null
}
