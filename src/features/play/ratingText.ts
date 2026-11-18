import type { MoveRating } from '../../chess/classify'

export const RATING_GLYPH: Record<MoveRating, string> = {
  book: '', // drawn as a book icon by RatingBadge
  brilliant: '!!',
  great: '!',
  best: '★',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '✕',
}

export const RATING_LABEL: Record<MoveRating, string> = {
  book: 'Book move',
  brilliant: 'Brilliant',
  great: 'Great move',
  best: 'Best move',
  good: 'Good move',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
}

/** "1 mistake", "2 mistakes", "3 book", "2 best" for summary chips. */
export function countLabel(rating: MoveRating, n: number): string {
  const word = RATING_LABEL[rating].toLowerCase().replace(' move', '')
  const plural = n !== 1 && (rating === 'mistake' || rating === 'blunder')
  if (n !== 1 && rating === 'inaccuracy') return `${n} inaccuracies`
  return `${n} ${word}${plural ? 's' : ''}`
}

/** Completes "1. Nf3 ..." in the coach card. */
export const RATING_VERDICT: Record<MoveRating, string> = {
  book: 'is a book move',
  brilliant: 'is brilliant',
  great: 'is a great move',
  best: 'is the best move',
  good: 'is a good move',
  inaccuracy: 'is an inaccuracy',
  mistake: 'is a mistake',
  blunder: 'is a blunder',
}

/** A short line for moves that weren't mistakes (mistakes and blunders get a coaching note instead). */
export function praiseText(rating: MoveRating, best: string | null): string {
  switch (rating) {
    case 'book':
      return 'Known opening theory. Strong players have played this many times.'
    case 'brilliant':
      return 'A sacrifice, and the engine rates it as the best move. Superb.'
    case 'great':
      return "The only good move here. The engine's next choice was much worse."
    case 'best':
      return "That's the engine's top choice."
    case 'good':
      return best ? `A solid move. The engine slightly preferred ${best}.` : 'A solid move.'
    case 'inaccuracy':
      return best ? `Not quite the best. ${best} was stronger.` : 'Not quite the best move.'
    default:
      return ''
  }
}
