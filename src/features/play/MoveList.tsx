import type { Move } from 'chess.js'
import { useEffect, useRef } from 'react'
import type { PlyRating } from '../../analysis/useGameAnalysis'
import { RATING_GLYPH, RATING_LABEL } from './ratingDisplay'

interface Props {
  history: Move[]
  /** One entry per half-move. Only the user's moves are rated. */
  ratings: PlyRating[]
}

/** Moves in pairs ("1. e4 e5") with a rating mark after each of the user's moves. */
export function MoveList({ history, ratings }: Props) {
  const endRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [history.length])

  if (history.length === 0) {
    return <p className="move-list-empty">No moves yet.</p>
  }

  const rows: { n: number; plies: number[] }[] = []
  for (let i = 0; i < history.length; i += 2) {
    rows.push({ n: i / 2 + 1, plies: i + 1 < history.length ? [i, i + 1] : [i] })
  }

  return (
    <ol className="move-list" aria-label="Moves">
      {rows.map((r, i) => (
        <li key={r.n} ref={i === rows.length - 1 ? endRef : undefined}>
          <span className="move-no">{r.n}.</span>
          {[0, 1].map((k) => {
            const ply = r.plies[k]
            if (ply === undefined) return <span key={k} className="move" />
            return (
              <span key={k} className="move" data-ply={ply}>
                {history[ply].san}
                <RatingMark rating={ratings[ply]} />
              </span>
            )
          })}
        </li>
      ))}
    </ol>
  )
}

function RatingMark({ rating }: { rating: PlyRating | undefined }) {
  if (!rating) return null
  if (rating === 'pending') {
    return (
      <span className="rating pending" title="Analysing">
        …
      </span>
    )
  }
  return (
    <span className={`rating rating-${rating.rating}`} title={RATING_LABEL[rating.rating]} aria-label={RATING_LABEL[rating.rating]}>
      {RATING_GLYPH[rating.rating]}
    </span>
  )
}
