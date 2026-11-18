import type { Move } from 'chess.js'
import type { PlyNote, PlyRating } from '../../analysis/useGameAnalysis'
import type { MoveJudgement, MoveRating } from '../../chess/classify'
import type { Hint } from '../../coach/hints'
import { BulbIcon } from '../../ui/icons'
import { CoachBubble } from './CoachBubble'
import type { CoachMessage } from './coachMessage'
import { RatingBadge } from './RatingBadge'
import { countLabel } from './ratingText'

interface Props {
  history: Move[]
  ratings: PlyRating[]
  notes: PlyNote[]
  gameOver: boolean
  hintMode: boolean
  isUserTurn: boolean
  hint: Hint | null
  hintStep: number
  onHint: () => void
  /** What the coach says now (the same message as the bubble above the board on phones). */
  message: CoachMessage
  className?: string
}

/**
 * The coach beside the board on wide screens: the same speech bubble as on phones, then the
 * hint button during play, or the list of mistakes when the game is over.
 */
export function CoachCard(props: Props) {
  const { gameOver, hintMode, isUserTurn } = props
  return (
    <div className={`coach-panel ${props.className ?? ''}`} data-testid="coach">
      <CoachBubble message={props.message} />
      {gameOver ? <GameSummary {...props} /> : hintMode && isUserTurn && <HintBox {...props} />}
    </div>
  )
}

function moveName(ply: number, move: Move): string {
  return `${Math.floor(ply / 2) + 1}.${move.color === 'b' ? '..' : ''} ${move.san}`
}

const ORDER: MoveRating[] = ['book', 'brilliant', 'great', 'best', 'good', 'inaccuracy', 'mistake', 'blunder']

function GameSummary({ history, ratings, notes }: Props) {
  const judged = ratings.filter((r): r is MoveJudgement => !!r && r !== 'pending')
  const counts = ORDER.map((r) => [r, judged.filter((j) => j.rating === r).length] as const).filter(([, n]) => n > 0)
  const errors = history
    .map((m, i) => ({ m, i, r: ratings[i], n: notes[i] }))
    .filter((x) => x.r && x.r !== 'pending' && (x.r.rating === 'mistake' || x.r.rating === 'blunder'))
  const pending = ratings.some((r) => r === 'pending')

  return (
    <section className="card coach-body game-summary-card">
      {pending && <p className="coach-text muted">Finishing the analysis…</p>}
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
      {errors.length > 0 ? (
        <ol className="summary-notes">
          {errors.map(({ m, i, r, n }) => (
            <li key={i}>
              <p className="coach-line">
                <RatingBadge rating={(r as MoveJudgement).rating} size="sm" /> <strong>{moveName(i, m)}</strong>
              </p>
              {n && n !== 'pending' ? (
                <>
                  <p className="coach-text">{n.text}</p>
                  <p className="coach-tip">
                    <span className="tip-label">Next time</span>
                    {n.tip}
                  </p>
                </>
              ) : (
                <p className="coach-text muted">Working out what went wrong…</p>
              )}
            </li>
          ))}
        </ol>
      ) : (
        !pending && judged.length > 0 && <p className="coach-text">No mistakes or blunders. Well played!</p>
      )}
    </section>
  )
}

function HintBox({ hint, hintStep, onHint }: Props) {
  const steps = hint ? [hint.nudge, hint.pieceText, hint.moveText] : []
  const label = hintStep === 0 ? 'Get a hint' : hintStep < 3 ? 'Show more' : 'Hint used'
  return (
    <div className="card hint-box">
      {hintStep > 0 && hint && (
        <ol className="hint-steps" data-testid="hint-steps">
          {steps.slice(0, hintStep).map((s, i) => (
            <li key={i} className={i === hintStep - 1 ? 'latest' : ''}>
              {s}
            </li>
          ))}
        </ol>
      )}
      <button type="button" className="hint-button" onClick={onHint} disabled={!hint || hintStep >= 3}>
        <BulbIcon />
        {hint ? label : 'Thinking…'}
      </button>
    </div>
  )
}
