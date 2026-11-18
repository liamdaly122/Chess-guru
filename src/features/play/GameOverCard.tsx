import type { Color } from 'chess.js'
import type { GameStatus } from '../../chess/gameStatus'
import { CloseIcon } from '../../ui/icons'

interface Props {
  status: Extract<GameStatus, { over: true }>
  userColor: Color
  onReview: () => void
  onRematch: () => void
  onNewGame: () => void
  onClose: () => void
}

/** Result card laid over the board when the game ends. */
export function GameOverCard({ status, userColor, onReview, onRematch, onNewGame, onClose }: Props) {
  const outcome = status.winner === null ? 'draw' : status.winner === userColor ? 'win' : 'loss'
  const title = outcome === 'win' ? 'You won!' : outcome === 'loss' ? 'You lost' : 'Draw'
  const reason = status.reason === 'checkmate' ? 'by checkmate' : `by ${status.reason}`

  return (
    <div className="game-over" role="dialog" aria-label="Game over" data-testid="game-over">
      <div className={`game-over-card outcome-${outcome}`}>
        <button type="button" className="icon-button game-over-close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
        <p className="game-over-result">{status.result.replace('1/2', '½')}</p>
        <h2>{title}</h2>
        <p className="muted">{reason}</p>
        <button type="button" className="primary wide game-over-review" onClick={onReview}>
          Review game
        </button>
        <div className="game-over-actions">
          <button type="button" onClick={onRematch}>
            Rematch
          </button>
          <button type="button" onClick={onNewGame}>
            New game
          </button>
        </div>
      </div>
    </div>
  )
}
