import type { Move } from 'chess.js'
import type { PlyRating } from '../../analysis/useGameAnalysis'
import { uciToSan } from '../../chess/moves'
import { formatScore } from '../../chess/score'
import { RATING_GLYPH, RATING_LABEL } from './ratingDisplay'

interface Props {
  history: Move[]
  ratings: PlyRating[]
}

/** Shows the rating of the user's most recent move, the engine's best move and the evaluation change. */
export function LastMoveFeedback({ history, ratings }: Props) {
  let ply = -1
  for (let i = ratings.length - 1; i >= 0; i--) {
    if (ratings[i]) {
      ply = i
      break
    }
  }

  if (ply === -1) {
    return (
      <div className="panel feedback" data-testid="feedback">
        <p className="muted">Each of your moves will be rated here after the engine checks it.</p>
      </div>
    )
  }

  const move = history[ply]
  const rating = ratings[ply]!
  const moveName = `${Math.floor(ply / 2) + 1}.${move.color === 'b' ? '..' : ''} ${move.san}`

  if (rating === 'pending') {
    return (
      <div className="panel feedback" data-testid="feedback">
        <p className="muted">Checking {moveName}…</p>
      </div>
    )
  }

  const best = rating.bestMove ? uciToSan(move.before, rating.bestMove) : null
  const showBest = rating.rating !== 'best' && best

  return (
    <div className={`panel feedback feedback-${rating.rating}`} data-testid="feedback">
      <p className="feedback-title">
        <span className={`rating rating-${rating.rating}`}>{RATING_GLYPH[rating.rating]}</span> {moveName}:{' '}
        {RATING_LABEL[rating.rating].toLowerCase()}
      </p>
      {showBest && (
        <p>
          Best was <strong>{best}</strong>.
        </p>
      )}
      {rating.mateRule === 'allowed-mate' && <p>This move allowed a forced mate.</p>}
      {rating.mateRule === 'missed-mate' && <p>You had a forced mate here and missed it.</p>}
      <p className="muted">
        Evaluation for you: {formatScore(rating.scoreBefore)} → {formatScore(rating.scoreAfter)}. Winning chances:{' '}
        {Math.round(rating.winBefore)}% → {Math.round(rating.winAfter)}%.
      </p>
    </div>
  )
}
