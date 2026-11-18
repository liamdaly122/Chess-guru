import type { Move } from 'chess.js'
import { useEffect, useRef } from 'react'
import type { MoveRating } from '../../chess/classify'
import { BulbIcon } from '../../ui/icons'
import { RatingBadge } from './RatingBadge'

interface Props {
  history: Move[]
  /** One entry per half-move. Only the user's moves are rated. */
  ratings: (MoveRating | 'pending' | null)[]
  /** Hide ratings (live coaching off). */
  hideRatings?: boolean
  /** Half-moves where a hint was used. */
  hintedPlies?: number[]
  /** Review mode: the half-move being shown (-1 = start), and a handler to jump to one. */
  currentPly?: number
  onSelect?: (ply: number) => void
}

/** Moves in pairs ("1. e4 e5") with a rating badge after each of the user's moves. */
export function MoveList({ history, ratings, hideRatings, hintedPlies = [], currentPly, onSelect }: Props) {
  const listRef = useRef<HTMLOListElement>(null)
  const highlighted = currentPly ?? history.length - 1

  // Keep the highlighted move in view (the newest move while playing).
  useEffect(() => {
    const list = listRef.current
    const el = list?.querySelector<HTMLElement>(`[data-ply="${highlighted}"]`)
    if (!list || !el) return
    const top = el.offsetTop - list.offsetTop
    if (top < list.scrollTop || top + el.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = top - list.clientHeight / 2
    }
  }, [highlighted, history.length])

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
            const current = ply === highlighted
            const content = (
              <>
                <span className="san">{history[ply].san}</span>
                {hintedPlies.includes(ply) && (
                  <span className="hint-mark" title="Hint used">
                    <BulbIcon width={12} height={12} />
                  </span>
                )}
                {rating && <RatingBadge rating={rating} size="sm" />}
              </>
            )
            return onSelect ? (
              <button
                key={k}
                type="button"
                className={`move move-button ${current ? 'last' : ''}`}
                data-ply={ply}
                aria-current={current ? 'step' : undefined}
                onClick={() => onSelect(ply)}
              >
                {content}
              </button>
            ) : (
              <span key={k} className={`move ${current ? 'last' : ''}`} data-ply={ply}>
                {content}
              </span>
            )
          })}
        </li>
      ))}
    </ol>
  )
}
