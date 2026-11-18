import type { Move } from 'chess.js'
import { useEffect, useRef } from 'react'
import type { MoveRating } from '../../chess/classify'
import { RatingBadge } from './RatingBadge'

interface Props {
  history: Move[]
  ratings: (MoveRating | 'pending' | null)[]
  hideRatings?: boolean
  /** Review: the half-move shown, and tap a move to jump to it. */
  currentPly?: number
  onSelect?: (ply: number) => void
}

/** One scrolling line of moves for phones, newest at the right. */
export function MoveStrip({ history, ratings, hideRatings, currentPly, onSelect }: Props) {
  const ref = useRef<HTMLOListElement>(null)
  const highlighted = currentPly ?? history.length - 1
  // Keep the highlighted move in view (the newest one while playing).
  useEffect(() => {
    const list = ref.current
    const el = list?.querySelector<HTMLElement>(`[data-ply="${highlighted}"]`)
    if (!list) return
    if (!el) {
      list.scrollLeft = highlighted < 0 ? 0 : list.scrollWidth
      return
    }
    list.scrollLeft = el.offsetLeft - list.clientWidth / 2 + el.offsetWidth / 2
  }, [highlighted, history.length, ratings])

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
          <li key={i} className={i === highlighted ? 'last' : ''} data-ply={i}>
            {m.color === 'w' && <span className="strip-no">{i / 2 + 1}.</span>}
            {onSelect ? (
              <button type="button" className="strip-san strip-button" onClick={() => onSelect(i)}>
                {m.san}
              </button>
            ) : (
              <span className="strip-san">{m.san}</span>
            )}
            {r && <RatingBadge rating={r} size="sm" />}
          </li>
        )
      })}
    </ol>
  )
}
