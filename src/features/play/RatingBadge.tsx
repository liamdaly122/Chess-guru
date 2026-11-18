import type { MoveRating } from '../../chess/classify'
import { RATING_GLYPH, RATING_LABEL } from './ratingText'

interface BadgeProps {
  rating: MoveRating | 'pending'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/** Round coloured badge with the rating symbol. Used on the board, in the move list and in the coach card. */
export function RatingBadge({ rating, size = 'md', className = '' }: BadgeProps) {
  if (rating === 'pending') {
    return <span className={`badge badge-${size} badge-pending ${className}`} aria-label="Analysing" />
  }
  return (
    <span
      className={`badge badge-${size} badge-${rating} ${className}`}
      role="img"
      aria-label={RATING_LABEL[rating]}
      title={RATING_LABEL[rating]}
    >
      {RATING_GLYPH[rating]}
    </span>
  )
}
