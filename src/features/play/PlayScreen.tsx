import { useState } from 'react'
import { describeStatus } from '../../chess/gameStatus'
import { GameBoard } from './GameBoard'
import { MoveList } from './MoveList'
import { NewGamePanel } from './NewGamePanel'
import { loadSettings, usePlayGame } from './usePlayGame'

export function PlayScreen() {
  const play = usePlayGame()
  const [flipped, setFlipped] = useState(false)
  const [showNewGame, setShowNewGame] = useState(false)

  const userSide = play.userColor === 'w' ? 'white' : 'black'
  const otherSide = userSide === 'white' ? 'black' : 'white'
  const orientation = flipped ? otherSide : userSide
  const lastMove = play.history[play.history.length - 1]

  let statusText = describeStatus(play.status, play.userColor)
  if (play.engineError) statusText = play.engineError
  else if (!play.engineReady) statusText = 'Loading engine…'

  return (
    <div className="play-screen">
      <section className="board-column">
        <div className="opponent-bar">
          <span className={`side-dot ${otherSide}`} aria-hidden />
          {play.engineName} · {play.level.rating}
          {play.botThinking && <span className="thinking"> thinking…</span>}
        </div>
        <GameBoard
          game={play.game}
          orientation={orientation}
          userColor={play.userColor}
          canMove={play.engineReady && play.isUserTurn}
          lastMove={lastMove}
          onMove={play.playUserMove}
        />
        <div
          className={`status ${play.status.over ? 'over' : ''}`}
          role="status"
          aria-live="polite"
          data-testid="status"
        >
          {statusText}
        </div>
      </section>

      <section className="side-column">
        <div className="controls">
          <button type="button" className="primary" onClick={() => setShowNewGame(true)}>
            New game
          </button>
          <button type="button" onClick={play.undo} disabled={!play.canUndo}>
            Undo
          </button>
          <button type="button" onClick={() => setFlipped((f) => !f)}>
            Flip board
          </button>
        </div>

        {showNewGame && (
          <NewGamePanel
            initial={loadSettings()}
            onCancel={() => setShowNewGame(false)}
            onStart={(s) => {
              play.newGame(s)
              setFlipped(false)
              setShowNewGame(false)
            }}
          />
        )}

        <div className="panel">
          <h2>
            Moves
            {play.takebacks > 0 && (
              <span className="takebacks">
                {' '}
                · {play.takebacks} takeback{play.takebacks > 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <MoveList history={play.history} />
        </div>
      </section>
    </div>
  )
}
