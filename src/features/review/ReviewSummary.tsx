import type { MoveRating } from '../../chess/classify'
import type { GameReview } from '../../review/types'
import { opponentOf, outcomeOf } from '../../storage/gameInfo'
import type { GameRecord } from '../../storage/types'
import { RatingBadge } from '../play/RatingBadge'
import { countLabel } from '../play/ratingText'

const ORDER: MoveRating[] = ['book', 'brilliant', 'great', 'best', 'good', 'inaccuracy', 'mistake', 'blunder']

interface Props {
  game: GameRecord
  review: GameReview
  onJump: (ply: number) => void
}

function resultLine(game: GameRecord): string {
  const o = outcomeOf(game)
  const opp = opponentOf(game).name
  const how = game.termination === 'checkmate' ? 'by checkmate' : game.termination ? `by ${game.termination}` : ''
  if (o === 'win') return `You beat ${opp} ${how}`.trim()
  if (o === 'loss') return `You lost to ${opp} ${how}`.trim()
  if (o === 'draw') return `Draw with ${opp} ${how}`.trim()
  return `Unfinished game against ${opp}`
}

/** End-of-game summary: result, accuracy, rating counts and the biggest lessons. */
export function ReviewSummary({ game, review, onJump }: Props) {
  const counts = ORDER.map(
    (r) => [r, review.plies.filter((p) => p.judgement?.rating === r).length] as const,
  ).filter(([, n]) => n > 0)

  return (
    <section className="card summary-card" aria-label="Game summary" data-testid="review-summary">
      <div className="summary-top">
        <div>
          <h2 className="card-title">Summary</h2>
          <p className="summary-result">{resultLine(game)}.</p>
          {game.takebacks ? <p className="muted small">Played with {game.takebacks} takeback{game.takebacks > 1 ? 's' : ''}.</p> : null}
        </div>
        <div className="accuracy" aria-label="Accuracy">
          <span className="accuracy-num">{review.accuracy == null ? '…' : Math.round(review.accuracy)}</span>
          <span className="accuracy-label">accuracy</span>
        </div>
      </div>

      {counts.length > 0 && (
        <ul className="summary-counts">
          {counts.map(([r, n]) => (
            <li key={r}>
              <RatingBadge rating={r} size="sm" />
              <span>
                {countLabel(r, n)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {review.complete && (
        <div className="lessons">
          <h3>{review.lessons.length > 0 ? 'Biggest lessons' : 'Lessons'}</h3>
          {review.lessons.length === 0 ? (
            <p className="coach-text">No mistakes or blunders in this game. Well played!</p>
          ) : (
            <ol>
              {review.lessons.map((l) => (
                <li key={l.category}>
                  <p className="lesson-title">{l.title}</p>
                  <p className="coach-text">{l.text}</p>
                  <p className="coach-tip">
                    <span className="tip-label">Next time</span>
                    {l.tip}
                  </p>
                  <div className="lesson-jumps">
                    {l.plies.slice(0, 4).map((ply) => (
                      <button key={ply} type="button" className="chip" onClick={() => onJump(ply)}>
                        {Math.floor(ply / 2) + 1}
                        {review.plies[ply].color === 'w' ? '.' : '...'} {review.plies[ply].san}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}
