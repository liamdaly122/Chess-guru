import type { Chess, Color, Move, Square } from 'chess.js'
import { useEffect, useMemo, useState } from 'react'
import { latestEval, useGameAnalysis, type PlyRating } from '../../analysis/useGameAnalysis'
import { describeStatus, type GameStatus } from '../../chess/gameStatus'
import { materialSummary } from '../../chess/material'
import { COACH } from '../../config/coach'
import { Modal } from '../../ui/Modal'
import { Switch } from '../../ui/Switch'
import { BulbIcon, FlipIcon, PlusIcon, SettingsIcon, UndoIcon } from '../../ui/icons'
import { CoachBubble } from './CoachBubble'
import { CoachCard } from './CoachCard'
import { coachMessage } from './coachMessage'
import { MoveStrip } from './MoveStrip'
import { EvalBar } from './EvalBar'
import { GameBoard, type BoardBadge } from './GameBoard'
import { GameOverCard, type NextLevel } from './GameOverCard'
import { MoveList } from './MoveList'
import { NewGameForm } from './NewGameForm'
import { PlayerStrip } from './PlayerStrip'
import { loadSettings, saveSettings, usePlayGame } from './usePlayGame'
import { nextLevelRating } from '../../rating/adaptive'
import { mainPattern, PATTERNS } from '../../puzzles/patterns'
import { routeHref } from '../../app/route'
import { MISTAKE_PATTERN_PREFIX } from '../puzzles/mistakeRoutes'
import { findLevel } from '../../config/levels'
import { usePreferences } from './usePreferences'
import { AboutSection } from '../settings/AboutSection'
import { InstallSection } from '../settings/InstallSection'
import { useSaveBotGame } from './useSaveBotGame'
import { useOpeningBook } from '../../openings/useOpeningBook'
import { OpeningPanel } from '../openings/OpeningPanel'
import { leftBookNote } from '../openings/leftBookNote'
import { navigate } from '../../app/route'

export function PlayScreen() {
  const [prefs, setPrefs] = usePreferences()
  const [holdBot, setHoldBot] = useState(false)
  const play = usePlayGame({ holdBot })
  const openingInfo = useOpeningBook(play.positions)
  // Both sides are rated so the saved review is complete straight away; the screen shows only yours.
  const analysis = useGameAnalysis(play.positions, play.history, play.userColor, {
    bookPlies: openingInfo?.status.inBook,
    rateBoth: true,
  })
  const userRatings = useMemo(
    () => analysis.ratings.map((r, i) => (play.history[i]?.color === play.userColor ? r : null)),
    [analysis.ratings, play.history, play.userColor],
  )
  const userNotes = useMemo(
    () => analysis.notes.map((n, i) => (play.history[i]?.color === play.userColor ? n : null)),
    [analysis.notes, play.history, play.userColor],
  )
  const saver = useSaveBotGame(play, analysis, openingInfo?.status.opening ?? null)

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

  // Adaptive bot: after a finished game (one you moved in, from the normal start), the next
  // game's level goes up after a win and down after a loss.
  const userMoved = play.history.some((m) => m.color === play.userColor)
  const adaptiveRating =
    play.status.over && userMoved && !play.startFen && loadSettings().adaptive
      ? nextLevelRating(
          play.level.rating,
          play.status.winner === null ? 'draw' : play.status.winner === play.userColor ? 'win' : 'loss',
          play.takebacks,
        )
      : null
  const nextLevel: NextLevel | null =
    adaptiveRating === null
      ? null
      : {
          rating: adaptiveRating,
          label: findLevel(adaptiveRating).label,
          change: adaptiveRating > play.level.rating ? 'up' : adaptiveRating < play.level.rating ? 'down' : 'same',
        }
  const main = play.status.over ? mainPattern(userNotes) : null
  const mainMistake = main
    ? { label: PATTERNS[main.pattern].label, count: main.count, href: routeHref({ name: 'puzzles', theme: MISTAKE_PATTERN_PREFIX + main.pattern }) }
    : null
  // Remember it, so the New game sheet starts from the new level too.
  useEffect(() => {
    if (adaptiveRating !== null) saveSettings({ ...loadSettings(), levelRating: adaptiveRating })
  }, [adaptiveRating, play.uid])

  // Badge on the square your last move landed on, until your next move (hidden if the bot captured it).
  const badge = showRatings ? lastUserBadge(play.history, userRatings, play.userColor, play.game) : null

  const hint = prefs.hintMode && play.isUserTurn ? analysis.hint : null
  const glowSquare = hint && hintStep === 2 ? hint.pieceSquare : null
  const arrow = hint && hintStep >= 3 ? { from: hint.moveFrom, to: hint.moveTo } : null

  function nextHint() {
    if (!analysis.hint) return
    play.markHintUsed()
    setHintState({ fen: play.fen, step: Math.min(3, hintStep + 1) })
  }

  const isMaia = play.level.engine.kind === 'maia'
  let statusText = describeStatus(play.status, play.userColor)
  if (play.engineError) statusText = play.engineError
  else if (!play.engineReady) statusText = 'Loading engine…'
  else if (isMaia && play.maiaStatus.state === 'loading' && !play.isUserTurn && !play.status.over) {
    statusText = `Downloading the human-like bot… ${Math.round(play.maiaStatus.progress * 100)}%`
  }
  const maiaNote =
    isMaia && play.maiaStatus.state === 'loading'
      ? `Getting Maia ready: a one-off download of about 25 MB (${Math.round(play.maiaStatus.progress * 100)}%).`
      : isMaia && play.maiaStatus.state === 'failed'
        ? "Couldn't load the human-like bot on this device, so Stockfish is playing this level instead."
        : null

  const showGameOver = play.status.over && dismissedGameOver !== play.history.length
  const evalScore = latestEval(analysis.snapshot, play.positions)
  const badgeRatings = userRatings.map((r) => (r && r !== 'pending' ? r.rating : r))
  const bookNote = showRatings
    ? leftBookNote(openingInfo, play.history, lastUserPly(play.history, play.userColor), play.userColor)
    : null
  const coachInput = {
    history: play.history,
    ratings: userRatings,
    notes: userNotes,
    liveCoaching: prefs.liveCoaching,
    gameOver,
    resultText: play.status.over ? resultText(play.status, play.userColor) : undefined,
    hint,
    hintStep,
    botNote: maiaNote,
    bookNote,
  }
  const coach = coachMessage(coachInput)
  // Beside the board the hint card lists the hint steps, so the bubble keeps the move rating.
  const coachBeside = coachMessage({ ...coachInput, hint: null, hintStep: 0 })

  return (
    <div className="play-screen">
      <section className="board-area">
        {/* Phones only: coach and moves above the board, like Chess.com. */}
        <div className="mobile-only mobile-top">
          <CoachBubble message={coach} />
          <MoveStrip history={play.history} ratings={badgeRatings} hideRatings={!showRatings} />
        </div>
        <PlayerStrip
          kind="bot"
          name={play.engineName}
          detail={`${play.level.rating} · ${play.level.label}${isMaia ? ' · human-like' : ''}`}
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
                onReview={() => navigate({ name: 'review', id: play.uid })}
                next={nextLevel}
                mainMistake={mainMistake}
                onRematch={() => {
                  play.rematch(nextLevel?.rating)
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
        {maiaNote && (
          <p className={`card maia-note desktop-only ${play.maiaStatus.state}`} role="status" data-testid="maia-note">
            {maiaNote}
          </p>
        )}
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
          className={gameOver ? '' : 'desktop-only'}
          history={play.history}
          ratings={userRatings}
          notes={userNotes}
          message={coachBeside}
          gameOver={gameOver}
          hintMode={prefs.hintMode}
          isUserTurn={play.isUserTurn}
          hint={analysis.hint}
          hintStep={hintStep}
          onHint={nextHint}
        />

        <OpeningPanel
          info={openingInfo}
          history={play.history}
          movesFrom={prefs.liveCoaching && play.isUserTurn ? play.fen : null}
        />

        <section className="card moves-card desktop-only" aria-label="Moves">
          <h2 className="card-title">Moves</h2>
          <MoveList
            history={play.history}
            ratings={badgeRatings}
            hideRatings={!showRatings}
            hintedPlies={play.hintedPlies}
          />
        </section>
      </aside>

      <Modal title="New game" open={modal === 'new'} onClose={() => setModal(null)}>
        <NewGameForm
          initial={loadSettings()}
          inProgress={saver.inProgress}
          onResign={() => {
            saver.saveAsResigned()
            play.resign()
            setModal(null)
          }}
          onStart={(s) => {
            saver.saveAsResigned()
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
        <InstallSection />
        <AboutSection />
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

function lastUserPly(history: Move[], userColor: Color): number {
  for (let i = history.length - 1; i >= 0; i--) if (history[i].color === userColor) return i
  return -1
}

function resultText(status: Extract<GameStatus, { over: true }>, userColor: Color): string {
  const how = status.reason === 'checkmate' ? 'by checkmate' : `by ${status.reason}`
  if (status.winner === null) return `Draw ${how}`
  return status.winner === userColor ? `You won ${how}` : `You lost ${how}`
}
