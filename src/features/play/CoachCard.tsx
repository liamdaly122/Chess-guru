import type { Move } from 'chess.js'
import type { PlyNote, PlyRating } from '../../analysis/useGameAnalysis'
import type { MoveJudgement, MoveRating } from '../../chess/classify'
import { uciToSan } from '../../chess/moves'
import type { Hint } from '../../coach/hints'
import { BulbIcon, CapIcon } from '../../ui/icons'
import { RatingBadge } from './RatingBadge'
import { countLabel, praiseText, RATING_VERDICT } from './ratingText'

interface Props {
  history: Move[]
  ratings: PlyRating[]
  notes: PlyNote[]
  liveCoaching: boolean
  gameOver: boolean
  hintMode: boolean
  isUserTurn: boolean
  hint: Hint | null
  hintStep: number
  onHint: () => void
  /** Shown under the verdict when your last move left the opening book. */
  bookNote?: string | null
  className?: string
}

/** The coach's panel: rating and explanation of your last move, hints, and the end-of-game summary. */
export function CoachCard(props: Props) {
  const { gameOver, liveCoaching, hintMode, isUserTurn } = props
  return (
    <section className={`card coach-card ${props.className ?? ''}`} aria-label="Coach" data-testid="coach">
      <header className="coach-head">
        <span className="coach-avatar" aria-hidden>
          <CapIcon />
        </span>
        <span className="coach-title">Coach</span>
      </header>
      {gameOver ? <GameSummary {...props} /> : liveCoaching ? <LastMove {...props} /> : <Paused />}
      {hintMode && isUserTurn && !gameOver && <HintBox {...props} />}
    </section>
  )
}

function moveName(ply: number, move: Move): string {
  return `${Math.floor(ply / 2) + 1}.${move.color === 'b' ? '..' : ''} ${move.san}`
}

function lastRatedPly(ratings: PlyRating[]): number {
  for (let i = ratings.length - 1; i >= 0; i--) if (ratings[i]) return i
  return -1
}

function Paused() {
  return <p className="coach-text muted">Live coaching is off. Your ratings and notes will appear when the game ends.</p>
}

function LastMove(props: Props) {
  const { history, ratings, notes } = props
  const ply = lastRatedPly(ratings)
  if (ply === -1) {
    return <p className="coach-text muted">Make your move. I'll rate each one and explain any mistakes.</p>
  }
  const move = history[ply]
  const rating = ratings[ply]!
  if (rating === 'pending') {
    return (
      <div className="coach-body">
        <p className="coach-line">
          <RatingBadge rating="pending" /> <span className="muted">Checking {moveName(ply, move)}…</span>
        </p>
        <div className="shimmer" />
      </div>
    )
  }
  return (
    <>
      <MoveVerdict ply={ply} move={move} judgement={rating} note={notes[ply]} />
      {props.bookNote && <p className="book-note">{props.bookNote}</p>}
    </>
  )
}

function MoveVerdict({ ply, move, judgement, note }: { ply: number; move: Move; judgement: MoveJudgement; note: PlyNote }) {
  const best = judgement.bestMove ? uciToSan(move.before, judgement.bestMove) : null
  const isError = judgement.rating === 'mistake' || judgement.rating === 'blunder'
  return (
    <div className={`coach-body verdict-${judgement.rating}`}>
      <p className="coach-line verdict-title">
        <RatingBadge rating={judgement.rating} />
        <span>
          <strong>{moveName(ply, move)}</strong> <span className={`tone-${judgement.rating}`}>{RATING_VERDICT[judgement.rating]}</span>
        </span>
      </p>
      {isError ? (
        note && note !== 'pending' ? (
          <>
            <p className="coach-text" data-testid="coach-note">
              {note.text}
            </p>
            <p className="coach-tip">
              <span className="tip-label">Next time</span>
              {note.tip}
            </p>
          </>
        ) : (
          <p className="coach-text muted">Working out what went wrong…</p>
        )
      ) : (
        <p className="coach-text">{praiseText(judgement.rating, best)}</p>
      )}
      <WinChange
        judgement={judgement}
        best={['best', 'great', 'brilliant', 'book'].includes(judgement.rating) ? null : best}
      />
    </div>
  )
}

function WinChange({ judgement, best }: { judgement: MoveJudgement; best: string | null }) {
  const before = Math.round(judgement.winBefore)
  const after = Math.round(judgement.winAfter)
  return (
    <div className="win-change">
      <span className="win-label">Winning chances</span>
      <span className="win-bars" aria-label={`Winning chances ${before}% to ${after}%`}>
        <span className="win-bar">
          <span style={{ width: `${before}%` }} />
        </span>
        <span className="win-arrow">→</span>
        <span className={`win-bar ${after < before - 4 ? 'down' : ''}`}>
          <span style={{ width: `${after}%` }} />
        </span>
      </span>
      <span className="win-nums">
        {before}% → {after}%
      </span>
      {best && (
        <span className="best-chip">
          Best <strong>{best}</strong>
        </span>
      )}
    </div>
  )
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
    <div className="coach-body">
      <p className="coach-text">
        <strong>Game over.</strong> {pending ? 'Finishing the analysis…' : 'Here is how your moves rated.'}
      </p>
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
    </div>
  )
}

function HintBox({ hint, hintStep, onHint }: Props) {
  const steps = hint ? [hint.nudge, hint.pieceText, hint.moveText] : []
  const label = hintStep === 0 ? 'Get a hint' : hintStep < 3 ? 'Show more' : 'Hint used'
  return (
    <div className="hint-box">
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
