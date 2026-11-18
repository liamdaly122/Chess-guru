import type { Move } from 'chess.js'
import { useEffect, useRef } from 'react'
import type { MoveRating } from '../../chess/classify'
import { RatingBadge } from './RatingBadge'

interface Props {
  history: Move[]
  ratings: (MoveRating | 'pending' | null)[]
  hideRatings?: boolean
}

/** One scrolling line of moves for phones, newest at the right. */
export function MoveStrip({ history, ratings, hideRatings }: Props) {
  const ref = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [history.length, ratings])

  if (history.length === 0) {
    return (
      <ol className="move-strip empty" aria-label="Moves">
        <li className="muted">Moves appear here</li>
      </ol>
    )
  }
  return (
    <ol className="move-strip" aria-label="Moves" ref={ref} data-testid="move-strip">
      {history.map((m, i) => {
        const r = hideRatings ? null : ratings[i]
        return (
          <li key={i} className={i === history.length - 1 ? 'last' : ''}>
            {m.color === 'w' && <span className="strip-no">{i / 2 + 1}.</span>}
            <span className="strip-san">{m.san}</span>
            {r && <RatingBadge rating={r} size="sm" />}
          </li>
        )
      })}
    </ol>
  )
}
