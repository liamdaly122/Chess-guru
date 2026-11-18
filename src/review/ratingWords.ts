import type { MoveRating } from '../chess/classify'

/** Standard chess annotation symbols, as used in PGN files. */
export const RATING_SYMBOL: Record<MoveRating, string> = {
  book: 'book',
  brilliant: '!!',
  great: '!',
  best: 'best',
  good: 'good',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
}

export const RATING_WORD: Record<MoveRating, string> = {
  book: 'Book move',
  brilliant: 'Brilliant',
  great: 'Great move',
  best: 'Best move',
  good: 'Good move',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
}
