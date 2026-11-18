import type { MoveRating } from '../../chess/classify'

export const RATING_GLYPH: Record<MoveRating, string> = {
  brilliant: '!!',
  great: '!',
  best: '★',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '✕',
}

export const RATING_LABEL: Record<MoveRating, string> = {
  brilliant: 'Brilliant',
  great: 'Great move',
  best: 'Best move',
  good: 'Good move',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
}

/** Completes "1. Nf3 ..." in the coach card. */
export const RATING_VERDICT: Record<MoveRating, string> = {
  brilliant: 'is brilliant',
  great: 'is a great move',
  best: 'is the best move',
  good: 'is a good move',
  inaccuracy: 'is an inaccuracy',
  mistake: 'is a mistake',
  blunder: 'is a blunder',
}
