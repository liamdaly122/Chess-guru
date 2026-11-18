import type { Chess, Color, Move, Square } from 'chess.js'
import { useEffect, useMemo, useState } from 'react'
import { latestEval, useGameAnalysis, type PlyRating } from '../../analysis/useGameAnalysis'
import { describeStatus } from '../../chess/gameStatus'
import { materialSummary } from '../../chess/material'
import { COACH } from '../../config/coach'
import { Modal } from '../../ui/Modal'
import { Switch } from '../../ui/Switch'
import { BulbIcon, FlipIcon, PlusIcon, SettingsIcon, UndoIcon } from '../../ui/icons'
import { CoachCard } from './CoachCard'
import { EvalBar } from './EvalBar'
import { GameBoard, type BoardBadge } from './GameBoard'
import { GameOverCard } from './GameOverCard'
import { MoveList } from './MoveList'
import { NewGameForm } from './NewGameForm'
import { PlayerStrip } from './PlayerStrip'
import { loadSettings, usePlayGame } from './usePlayGame'
import { usePreferences } from './usePreferences'

export function PlayScreen() {
  const [prefs, setPrefs] = usePreferences()
  const [holdBot, setHoldBot] = useState(false)
  const play = usePlayGame({ holdBot })
  const analysis = useGameAnalysis(play.positions, play.history, play.userColor)

  // With live coaching on, let the rating of your move appear before the bot replies,
  // but never wait longer than COACH.botWaitsForRatingMs.
  const lastPly = play.history.length - 1
  const waitingForRating =
    prefs.liveCoaching && lastPly >= 0 && play.history[lastPly].color === play.userColor && analysis.ratings[lastPly] === 'pending'
  const [timedOutPly, setTimedOutPly] = useState<number | null>(null)
  useEffect(() => {
    if (!waitingForRating) return
    const t = setTimeout(() => setTimedOutPly(lastPly), COACH.botWaitsForRatingMs)
    return () => clearTimeout(t)
  }, [waitingForRating, lastPly])
  const shouldHold = waitingForRating && timedOutPly !== lastPly
  if (shouldHold !== holdBot) setHoldBot(shouldHold) // derived state, updated during render
  const [flipped, setFlipped] = useState(false)
  const [modal, setModal] = useState<'new' | 'settings' | null>(null)
  const [dismissedGameOver, setDismissedGameOver] = useState<number | null>(null)

  // Hint steps reset whenever the position changes.
  const [hintState, setHintState] = useState({ fen: play.fen, step: 0 })
  const hintStep = hintState.fen === play.fen ? hintState.step : 0

  const userSide = play.userColor === 'w' ? 'white' : 'black'
  const otherSide = userSide === 'white' ? 'black' : 'white'
  const orientation = flipped ? otherSide : userSide
  const lastMove = play.history[play.history.length - 1]
  const material = useMemo(() => materialSummary(play.game), [play.game])
  const botColor = play.userColor === 'w' ? 'b' : 'w'
  const gameOver = play.status.over
  const showRatings = prefs.liveCoaching || gameOver

  // Badge on the square your last move landed on, until your next move (hidden if the bot captured it).
  const badge = showRatings ? lastUserBadge(play.history, analysis.ratings, play.userColor, play.game) : null

  const hint = prefs.hintMode && play.isUserTurn ? analysis.hint : null
  const glowSquare = hint && hintStep === 2 ? hint.pieceSquare : null
  const arrow = hint && hintStep >= 3 ? { from: hint.moveFrom, to: hint.moveTo } : null

  function nextHint() {
    if (!analysis.hint) return
    play.markHintUsed()
    setHintState({ fen: play.fen, step: Math.min(3, hintStep + 1) })
  }

  let statusText = describeStatus(play.status, play.userColor)
  if (play.engineError) statusText = play.engineError
  else if (!play.engineReady) statusText = 'Loading engine…'

  const showGameOver = play.status.over && dismissedGameOver !== play.history.length
  const evalScore = latestEval(analysis.snapshot, play.positions)

  return (
    <div className="play-screen">
      <section className="board-area">
        <PlayerStrip
          kind="bot"
          name={play.engineName}
          detail={`${play.level.rating} · ${play.level.label}`}
          color={botColor}
          material={material[botColor]}
          thinking={play.botThinking}
          toMove={!gameOver && !play.isUserTurn}
        />
        <div className="board-row">
          {prefs.showEval && <EvalBar score={evalScore} orientation={orientation} />}
          <GameBoard
            game={play.game}
            orientation={orientation}
            userColor={play.userColor}
            canMove={play.engineReady && play.isUserTurn}
            lastMove={lastMove}
            onMove={play.playUserMove}
            badge={badge}
            glowSquare={glowSquare}
            arrow={arrow}
          >
            {showGameOver && play.status.over && (
              <GameOverCard
                status={play.status}
                userColor={play.userColor}
                onRematch={() => {
                  play.rematch()
                  setFlipped(false)
                }}
                onNewGame={() => setModal('new')}
                onClose={() => setDismissedGameOver(play.history.length)}
              />
            )}
          </GameBoard>
        </div>
        <PlayerStrip
          kind="you"
          name="You"
          detail={play.takebacks > 0 ? `${statusText} · ${play.takebacks} takeback${play.takebacks > 1 ? 's' : ''}` : statusText}
          color={play.userColor}
          material={material[play.userColor]}
          toMove={!gameOver && play.isUserTurn}
        />
        <p className="sr-only" role="status" aria-live="polite" data-testid="status">
          {statusText}
        </p>
      </section>

      <aside className="side-area">
        <nav className="action-bar" aria-label="Game controls">
          <button type="button" className="action" onClick={() => setModal('new')}>
            <PlusIcon />
            <span>New</span>
          </button>
          <button type="button" className="action" onClick={play.undo} disabled={!play.canUndo}>
            <UndoIcon />
            <span>Undo</span>
          </button>
          {prefs.hintMode && (
            <button
              type="button"
              className="action"
              onClick={nextHint}
              disabled={!play.isUserTurn || !analysis.hint || hintStep >= 3}
            >
              <BulbIcon />
              <span>Hint</span>
            </button>
          )}
          <button type="button" className="action" onClick={() => setFlipped((f) => !f)}>
            <FlipIcon />
            <span>Flip</span>
          </button>
          <button type="button" className="action" onClick={() => setModal('settings')}>
            <SettingsIcon />
            <span>Settings</span>
          </button>
        </nav>

        <CoachCard
          history={play.history}
          ratings={analysis.ratings}
          notes={analysis.notes}
          liveCoaching={prefs.liveCoaching}
          gameOver={gameOver}
          hintMode={prefs.hintMode}
          isUserTurn={play.isUserTurn}
          hint={analysis.hint}
          hintStep={hintStep}
          onHint={nextHint}
        />

        <section className="card moves-card" aria-label="Moves">
          <h2 className="card-title">Moves</h2>
          <MoveList
            history={play.history}
            ratings={analysis.ratings}
            hideRatings={!showRatings}
            hintedPlies={play.hintedPlies}
          />
        </section>
      </aside>

      <Modal title="New game" open={modal === 'new'} onClose={() => setModal(null)}>
        <NewGameForm
          initial={loadSettings()}
          onStart={(s) => {
            play.newGame(s)
            setFlipped(false)
            setModal(null)
          }}
        />
      </Modal>

      <Modal title="Settings" open={modal === 'settings'} onClose={() => setModal(null)}>
        <div className="settings">
          <Switch
            label="Live coaching"
            description="Rate each move and explain mistakes as you play. Off: everything waits until the game ends."
            checked={prefs.liveCoaching}
            onChange={(v) => setPrefs({ liveCoaching: v })}
          />
          <Switch
            label="Hints"
            description="Show the hint button: first a nudge, then the piece, then the move."
            checked={prefs.hintMode}
            onChange={(v) => setPrefs({ hintMode: v })}
          />
          <Switch
            label="Evaluation bar"
            description="Show who the engine thinks is better."
            checked={prefs.showEval}
            onChange={(v) => setPrefs({ showEval: v })}
          />
        </div>
      </Modal>
    </div>
  )
}

function lastUserBadge(history: Move[], ratings: PlyRating[], userColor: Color, game: Chess): BoardBadge | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i]
    if (m.color !== userColor) continue
    const r = ratings[i]
    if (!r) return null
    const occupant = game.get(m.to as Square)
    if (!occupant || occupant.color !== userColor) return null
    return { square: m.to as Square, rating: r === 'pending' ? 'pending' : r.rating }
  }
  return null
}
