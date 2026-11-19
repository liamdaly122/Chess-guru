import type { Color } from 'chess.js'
import type { MoveRating } from '../../chess/classify'
import { gameVerdict, moveName, phaseGrade, phaseScores, type KeyMoment } from '../../review/keyMoments'
import { MOMENT_LABEL, momentRating } from './moments'
import { practiceFromGame } from '../../practice/positions'
import { requestPractice } from '../../practice/startRequest'
import { PHASE_LABEL } from '../../review/gamePhase'
import type { GameReview } from '../../review/types'
import { opponentOf } from '../../storage/gameInfo'
import type { GameRecord } from '../../storage/types'
import { CoachBubble } from '../play/CoachBubble'
import { RatingBadge } from '../play/RatingBadge'
import { RATING_LABEL } from '../play/ratingText'

const ORDER: MoveRating[] = ['brilliant', 'great', 'best', 'good', 'book', 'inaccuracy', 'mistake', 'blunder']

interface Props {
  game: GameRecord
  review: GameReview
  moments: KeyMoment[]
  onStart: () => void
  onJump: (ply: number) => void
}

function count(review: GameReview, color: Color, rating: MoveRating): number {
  return review.plies.filter((p) => p.color === color && p.judgement?.rating === rating).length
}

/**
 * The first screen of a review, like Chess.com's Game Review: the coach's verdict, a Start
 * button, both players' accuracy and ratings, how you did in each phase, the key moments and
 * the biggest lessons.
 */
export function ReviewSummary({ game, review, moments, onStart, onJump }: Props) {
  const opp = opponentOf(game)
  const them: Color = game.userColor === 'w' ? 'b' : 'w'
  const rows = ORDER.map((r) => ({ r, you: count(review, game.userColor, r), opp: count(review, them, r) })).filter((x) => x.you || x.opp)
  const phases = phaseScores(review, game.userColor)
  const practice = review.complete ? practiceFromGame({ ...game, review }) : []

  return (
    <div className="review-overview" data-testid="review-summary">
      <CoachBubble message={{ tone: 'neutral', text: review.complete ? gameVerdict(game, review, moments) : 'Analysing your game…' }} />
      <button type="button" className="primary wide start-review" onClick={onStart} disabled={!review.complete || moments.length === 0} data-testid="start-review">
        {moments.length ? `Start review · ${moments.length} key moment${moments.length === 1 ? '' : 's'}` : 'Start review'}
      </button>

      <section className="card players-card" aria-label="Accuracy">
        <div className="player-acc">
          <span className="player-acc-name">You</span>
          <span className="accuracy">
            <span className="accuracy-num">{review.accuracy == null ? '–' : Math.round(review.accuracy)}</span>
            <span className="accuracy-label">accuracy</span>
          </span>
        </div>
        <span className="players-vs muted">vs</span>
        <div className="player-acc">
          <span className="player-acc-name">{opp.name}</span>
          <span className="accuracy opponent">
            <span className="accuracy-num">{review.opponentAccuracy == null ? '–' : Math.round(review.opponentAccuracy)}</span>
            <span className="accuracy-label">accuracy</span>
          </span>
        </div>
      </section>

      {rows.length > 0 && (
        <section className="card" aria-label="Move ratings">
          <table className="ratings-table">
            <thead>
              <tr>
                <th />
                <th>You</th>
                <th>{opp.name}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, you, opp: o }) => (
                <tr key={r} className={`row-${r}`}>
                  <td>
                    <RatingBadge rating={r} size="sm" /> {RATING_LABEL[r]}
                  </td>
                  <td>{you}</td>
                  <td>{o}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card phases-card" aria-label="Game phases">
        {phases.map((p) => (
          <div key={p.phase} className={`phase-score grade-${phaseGrade(p.accuracy).replace(/\W+/g, '-').toLowerCase()}`}>
            <span className="tile-label">{PHASE_LABEL[p.phase]}</span>
            <span className="phase-grade">{phaseGrade(p.accuracy)}</span>
            <span className="muted small">{p.accuracy == null ? 'no moves' : `${Math.round(p.accuracy)}%`}</span>
          </div>
        ))}
      </section>

      {moments.length > 0 && (
        <section className="card" aria-label="Key moments">
          <h2 className="card-title">Key moments</h2>
          <ul className="moment-list">
            {moments.map((m) => {
              const r = momentRating(review, m)
              return (
                <li key={m.ply}>
                  <button type="button" className="moment-button" onClick={() => onJump(m.ply)}>
                    {r && <RatingBadge rating={r} size="sm" />}
                    <span className="moment-move">{moveName(review, m.ply)}</span>
                    <span className="muted small">{MOMENT_LABEL[m.kind]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {practice.length > 0 && (
        <section className="card" aria-label="Play it out" data-testid="review-practice">
          <h2 className="card-title">Play it out</h2>
          <ul className="line-list">
            {practice.map((p) => (
              <li key={p.id} className="line-row">
                <div className="line-info">
                  <p className="line-name">{p.kind === 'win' ? 'Win the won position' : 'Hold the bad position'}</p>
                  <p className="muted small">
                    {p.kind === 'win' ? 'You were winning' : 'You were worse but it could be saved'} ({p.evalText}) before {p.played}.
                  </p>
                </div>
                <button type="button" className="primary solve-button" onClick={() => requestPractice(p)}>
                  Play
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.complete && (
        <section className="card lessons" aria-label="Lessons">
          <h2 className="card-title">{review.lessons.length > 0 ? 'Biggest lessons' : 'Lessons'}</h2>
          {review.lessons.length === 0 ? (
            <p className="coach-text">No mistakes or blunders in this game. Well played!</p>
          ) : (
            <ol>
              {review.lessons.map((l) => (
                <li key={l.category}>
                  <p className="lesson-title">{l.title}</p>
                  <p className="coach-text">{l.text}</p>
                  <p className="lesson-tip">
                    <strong>Next time:</strong> {l.tip}
                  </p>
                  <div className="lesson-jumps">
                    {l.plies.slice(0, 4).map((ply) => (
                      <button key={ply} type="button" className="chip" onClick={() => onJump(ply)}>
                        {moveName(review, ply)}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  )
}
