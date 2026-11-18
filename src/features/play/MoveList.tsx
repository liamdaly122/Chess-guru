import type { Move } from 'chess.js'
import { useEffect, useRef } from 'react'
import type { PlyRating } from '../../analysis/useGameAnalysis'
import { BulbIcon } from '../../ui/icons'
import { RatingBadge } from './RatingBadge'

interface Props {
  history: Move[]
  /** One entry per half-move. Only the user's moves are rated. */
  ratings: PlyRating[]
  /** Hide ratings (live coaching off). */
  hideRatings?: boolean
  /** Half-moves where a hint was used. */
  hintedPlies?: number[]
}

/** Moves in pairs ("1. e4 e5") with a rating badge after each of the user's moves. */
export function MoveList({ history, ratings, hideRatings, hintedPlies = [] }: Props) {
  const listRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [history.length])

  if (history.length === 0) {
    return <p className="move-list-empty muted">No moves yet.</p>
  }

  const rows: { n: number; plies: number[] }[] = []
  for (let i = 0; i < history.length; i += 2) {
    rows.push({ n: i / 2 + 1, plies: i + 1 < history.length ? [i, i + 1] : [i] })
  }

  return (
    <ol className="move-list" aria-label="Moves" ref={listRef}>
      {rows.map((r) => (
        <li key={r.n}>
          <span className="move-no">{r.n}</span>
          {[0, 1].map((k) => {
            const ply = r.plies[k]
            if (ply === undefined) return <span key={k} className="move" />
            const rating = hideRatings ? null : ratings[ply]
            const last = ply === history.length - 1
            return (
              <span key={k} className={`move ${last ? 'last' : ''}`} data-ply={ply}>
                <span className="san">{history[ply].san}</span>
                {hintedPlies.includes(ply) && (
                  <span className="hint-mark" title="Hint used">
                    <BulbIcon width={12} height={12} />
                  </span>
                )}
                {rating && <RatingBadge rating={rating === 'pending' ? 'pending' : rating.rating} size="sm" />}
              </span>
            )
          })}
        </li>
      ))}
    </ol>
  )
}
