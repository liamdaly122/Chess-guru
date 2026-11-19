import type { Color } from 'chess.js'
import type { GameStatus } from '../../chess/gameStatus'
import { CloseIcon } from '../../ui/icons'

/** The adaptive bot's level for the next game. */
export interface NextLevel {
  rating: number
  label: string
  change: 'up' | 'down' | 'same'
}

interface Props {
  status: Extract<GameStatus, { over: true }>
  userColor: Color
  onReview: () => void
  onRematch: () => void
  onNewGame: () => void
  onClose: () => void
  next?: NextLevel | null
  /** The game's most common kind of mistake, with a link to practise it. */
  mainMistake?: { label: string; count: number; href: string } | null
  /** Play it out: whether you did what the position asked, and where to find more. */
  practice?: { success: boolean; kind: 'win' | 'hold' | 'mate'; moreHref: string; moreLabel: string } | null
}

/** Result card laid over the board when the game ends. */
export function GameOverCard({ status, userColor, onReview, onRematch, onNewGame, onClose, next, mainMistake, practice }: Props) {
  const outcome = status.winner === null ? 'draw' : status.winner === userColor ? 'win' : 'loss'
  const title = practice
    ? practice.success
      ? practice.kind === 'mate'
        ? 'Checkmate!'
        : practice.kind === 'win'
          ? 'Converted!'
          : 'Held!'
      : 'Not this time'
    : outcome === 'win'
      ? 'You won!'
      : outcome === 'loss'
        ? 'You lost'
        : 'Draw'
  const reason =
    status.reason === 'claim'
      ? outcome === 'win'
        ? 'win claimed'
        : 'position held'
      : status.reason === 'checkmate'
        ? 'by checkmate'
        : `by ${status.reason}`

  if (practice) {
    return (
      <div className="game-over" role="dialog" aria-label="Position finished" data-testid="game-over">
        <div className={`game-over-card outcome-${practice.success ? 'win' : 'loss'}`}>
          <button type="button" className="icon-button game-over-close" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
          <p className="game-over-result">{status.result.replace('1/2', '½')}</p>
          <h2>{title}</h2>
          <p className="muted">
            {reason}.{' '}
            {practice.success
              ? practice.kind === 'hold'
                ? 'You saved it this time.'
                : 'You finished the job this time.'
              : practice.kind === 'hold'
                ? 'It got away. Have another go.'
                : 'The win slipped away. Have another go.'}
          </p>
          <button type="button" className="primary wide" onClick={onRematch}>
            Try again
          </button>
          <div className="game-over-actions">
            <a className="button-link" href={practice.moreHref}>
              {practice.moreLabel}
            </a>
            <button type="button" onClick={onNewGame}>
              New game
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="game-over" role="dialog" aria-label="Game over" data-testid="game-over">
      <div className={`game-over-card outcome-${outcome}`}>
        <button type="button" className="icon-button game-over-close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
        <p className="game-over-result">{status.result.replace('1/2', '½')}</p>
        <h2>{title}</h2>
        <p className="muted">{reason}</p>
        {next && (
          <p className={`next-level change-${next.change}`} data-testid="next-level">
            {next.change === 'up' ? '▲ Next game: ' : next.change === 'down' ? '▼ Next game: ' : 'Next game: '}
            <strong>
              {next.rating} {next.label}
            </strong>
            {next.change === 'same' ? ' again' : ''}
          </p>
        )}
        {mainMistake && (
          <p className="main-mistake" data-testid="main-mistake">
            Main mistake: {mainMistake.label.toLowerCase()}
            {mainMistake.count > 1 ? ` (${mainMistake.count} times)` : ''}. <a href={mainMistake.href}>Practise it</a>
          </p>
        )}
        <button type="button" className="primary wide game-over-review" onClick={onReview}>
          Review game
        </button>
        <div className="game-over-actions">
          <button type="button" onClick={onRematch}>
            {next ? `Play ${next.rating}` : 'Rematch'}
          </button>
          <button type="button" onClick={onNewGame}>
            New game
          </button>
        </div>
      </div>
    </div>
  )
}
