import type { Move } from 'chess.js'
import { formatScore, negate } from '../../chess/score'
import type { GameReview } from '../../review/types'
import type { GameRecord } from '../../storage/types'
import { CapIcon } from '../../ui/icons'
import { RatingBadge } from '../play/RatingBadge'
import { praiseText, RATING_VERDICT } from '../play/ratingText'

interface Props {
  ply: number
  move: Move | null
  review: GameReview
  game: GameRecord
  /** Set when this move left the opening book. */
  bookNote?: string | null
}

/** What happened on the move being shown: rating, coaching note, best move and engine line. */
export function ReviewMoveCard({ ply, move, review, game, bookNote }: Props) {
  const name = move ? `${Math.floor(ply / 2) + 1}.${move.color === 'b' ? '..' : ''} ${move.san}` : ''
  const p = ply >= 0 ? review.plies[ply] : null
  const j = p?.judgement

  let body
  if (!move || !p) {
    body = <p className="coach-text muted">Start of the game. Step through with the arrows, tap a move, or tap the graph.</p>
  } else if (move.color !== game.userColor) {
    const evalForYou = p.evalAfter ? formatScore(game.userColor === 'w' ? p.evalAfter : negate(p.evalAfter)) : '…'
    body = (
      <>
        <p className="coach-line verdict-title">
          <strong>{name}</strong> <span className="muted">by your opponent</span>
        </p>
        <p className="coach-text muted">Evaluation for you after this move: {evalForYou}</p>
      </>
    )
  } else if (!j) {
    body = (
      <p className="coach-line">
        <RatingBadge rating="pending" /> <span className="muted">Analysing {name}…</span>
      </p>
    )
  } else {
    const isError = j.rating === 'mistake' || j.rating === 'blunder'
    // Book moves are known theory, so don't second-guess them with the engine's preference.
    const engineIsBest = ['best', 'great', 'brilliant', 'book'].includes(j.rating)
    body = (
      <>
        <p className="coach-line verdict-title">
          <RatingBadge rating={j.rating} />
          <span>
            <strong>{name}</strong> <span className={`tone-${j.rating}`}>{RATING_VERDICT[j.rating]}</span>
          </span>
        </p>
        {isError && p.note ? (
          <>
            <p className="coach-text">{p.note.text}</p>
            <p className="coach-tip">
              <span className="tip-label">Next time</span>
              {p.note.tip}
            </p>
          </>
        ) : (
          <p className="coach-text">{praiseText(j.rating, j.bestSan)}</p>
        )}
        {!engineIsBest && j.bestLineSan.length > 0 && (
          <p className="engine-line">
            <span className="muted">Engine line</span> {j.bestLineSan.join(' ')}
          </p>
        )}
        <p className="win-change compact">
          <span className="win-label">Winning chances</span>
          <span className="win-nums">
            {Math.round(j.winBefore)}% → {Math.round(j.winAfter)}%
          </span>
          {!engineIsBest && j.bestSan && (
            <span className="best-chip">
              Best <strong>{j.bestSan}</strong>
            </span>
          )}
        </p>
      </>
    )
  }

  return (
    <section className="card coach-card" aria-label="Move" data-testid="review-move">
      <header className="coach-head">
        <span className="coach-avatar" aria-hidden>
          <CapIcon />
        </span>
        <span className="coach-title">Coach</span>
      </header>
      <div className="coach-body" key={ply}>
        {body}
        {bookNote && <p className="book-note">{bookNote}</p>}
      </div>
    </section>
  )
}
