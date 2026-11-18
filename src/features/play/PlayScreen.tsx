import { useState } from 'react'
import { latestEval, useGameAnalysis } from '../../analysis/useGameAnalysis'
import { describeStatus } from '../../chess/gameStatus'
import { EvalBar } from './EvalBar'
import { GameBoard } from './GameBoard'
import { LastMoveFeedback } from './LastMoveFeedback'
import { MoveList } from './MoveList'
import { NewGamePanel } from './NewGamePanel'
import { loadSettings, usePlayGame } from './usePlayGame'

export function PlayScreen() {
  const play = usePlayGame()
  const [flipped, setFlipped] = useState(false)
  const [showNewGame, setShowNewGame] = useState(false)
  const [showEval, setShowEval] = useState(() => readFlag(SHOW_EVAL_KEY, true))
  const analysis = useGameAnalysis(play.positions, play.history, play.userColor)

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
        <div className="board-row">
          {showEval && <EvalBar score={latestEval(analysis.snapshot, play.positions)} orientation={orientation} />}
          <GameBoard
            game={play.game}
            orientation={orientation}
            userColor={play.userColor}
            canMove={play.engineReady && play.isUserTurn}
            lastMove={lastMove}
            onMove={play.playUserMove}
          />
        </div>
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

        <LastMoveFeedback history={play.history} ratings={analysis.ratings} />

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
          <MoveList history={play.history} ratings={analysis.ratings} />
        </div>

        <label className="toggle">
          <input
            type="checkbox"
            checked={showEval}
            onChange={(e) => {
              setShowEval(e.target.checked)
              writeFlag(SHOW_EVAL_KEY, e.target.checked)
            }}
          />
          Show evaluation bar
        </label>
      </section>
    </div>
  )
}

const SHOW_EVAL_KEY = 'chess-guru:show-eval'

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // Only a convenience; ignore if storage is unavailable.
  }
}
