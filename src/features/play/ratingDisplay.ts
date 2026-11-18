import type { MoveRating } from '../../chess/classify'

export const RATING_GLYPH: Record<MoveRating, string> = {
  best: '★',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
}

export const RATING_LABEL: Record<MoveRating, string> = {
  best: 'Best move',
  good: 'Good move',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
}
