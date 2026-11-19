import type { Chess, Color, Move, Square } from 'chess.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { latestEval, useGameAnalysis, type PlyRating } from '../../analysis/useGameAnalysis'
import { describeStatus, type GameStatus } from '../../chess/gameStatus'
import { materialSummary } from '../../chess/material'
import { COACH } from '../../config/coach'
import { Modal } from '../../ui/Modal'
import { Switch } from '../../ui/Switch'
import { BulbIcon, FlipIcon, PlusIcon, SettingsIcon, UndoIcon } from '../../ui/icons'
import { CoachBubble } from './CoachBubble'
import { CoachCard } from './CoachCard'
import { coachMessage, type CoachMessage } from './coachMessage'
import { BLUNDER_CHECK } from '../../config/blunderCheck'
import { needsBlunderCheck } from '../../coach/blunderCheck'
import { PLAY_IT_OUT } from '../../config/playItOut'
import { practiceSucceeded, type PracticePosition } from '../../practice/positions'
import { recordPracticeTry } from '../../practice/practiceStore'
import { onPracticeRequest } from '../../practice/startRequest'
import { countPuzzleDone } from '../../goal/goalStore'
import { formatDate } from '../../storage/gameInfo'
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
import { MISTAKE_PATTERN_PREFIX, MISTAKES_POSITIONS } from '../puzzles/mistakeRoutes'
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
  // but never wait longer than COACH.botWaitsForRatingMs (longer with blunder check, which needs it).
  const lastPly = play.history.length - 1
  const lastIsUsers = lastPly >= 0 && play.history[lastPly].color === play.userColor
  const checkOn = prefs.blunderCheck
  const waitingForRating = (prefs.liveCoaching || checkOn) && lastIsUsers && analysis.ratings[lastPly] === 'pending'
  const [timedOutPly, setTimedOutPly] = useState<number | null>(null)
  useEffect(() => {
    if (!waitingForRating) return
    const t = setTimeout(() => setTimedOutPly(lastPly), checkOn ? BLUNDER_CHECK.waitForRatingMs : COACH.botWaitsForRatingMs)
    return () => clearTimeout(t)
  }, [waitingForRating, lastPly, checkOn])

  // Blunder check: if your move is a blunder, hold the bot and ask once, without saying why.
  const [kept, setKept] = useState<string[]>([])
  const lastRating = lastIsUsers ? analysis.ratings[lastPly] : null
  const lastKey = `${play.uid}:${lastPly}:${play.moves[lastPly] ?? ''}`
  const askBlunder = needsBlunderCheck(lastRating, { on: checkOn, gameOver: play.status.over, alreadyAsked: kept.includes(lastKey) })
  // While asking, the move's rating and note stay hidden.
  const shownRatings = askBlunder ? userRatings.map((r, i) => (i === lastPly ? null : r)) : userRatings
  const shownNotes = askBlunder ? userNotes.map((n, i) => (i === lastPly ? null : n)) : userNotes
  const askMessage: CoachMessage = {
    id: 'blunder-check',
    tone: 'warning',
    title: 'Are you sure?',
    text: 'Take another look at the position before you commit to this move.',
    actions: [
      { label: 'Take it back', primary: true, onClick: () => play.retractForBlunderCheck() },
      {
        label: 'Play it anyway',
        onClick: () => {
          setKept((k) => [...k, lastKey])
          play.keepAfterBlunderCheck()
        },
      },
    ],
  }
  const shouldHold = (waitingForRating && timedOutPly !== lastPly) || askBlunder
  if (shouldHold !== holdBot) setHoldBot(shouldHold) // derived state, updated during render
  const [flipped, setFlipped] = useState(false)
  const [modal, setModal] = useState<'new' | 'settings' | null>(null)
  const [dismissedGameOver, setDismissedGameOver] = useState<number | null>(null)

  // Play it out: a list asks to start a position from one of your games.
  const startPracticeRef = useRef<(p: PracticePosition) => void>(() => {})
  useEffect(() => {
    startPracticeRef.current = (position) => {
      if (saver.inProgress && !window.confirm('Start this position? Your current game will count as resigned.')) return
      saver.saveAsResigned()
      play.startPractice(position)
      setFlipped(false)
      setModal(null)
    }
  })
  useEffect(() => onPracticeRequest((p) => startPracticeRef.current(p)), [])

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
          // A win where blunder check stopped you counts like one with takebacks.
          play.takebacks + play.blunderChecks,
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
  const main = play.status.over && !play.practice ? mainPattern(userNotes) : null
  const mainMistake = main
    ? { label: PATTERNS[main.pattern].label, count: main.count, href: routeHref({ name: 'puzzles', theme: MISTAKE_PATTERN_PREFIX + main.pattern }) }
    : null
  // Play it out: record the try once when the position is finished.
  const practice = play.practice
  const practiceSuccess = practice && play.status.over ? practiceSucceeded(practice.kind, play.status.winner, play.userColor) : null
  const recordedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!practice || practiceSuccess === null || !userMoved || recordedFor.current === play.uid) return
    recordedFor.current = play.uid
    void recordPracticeTry(practice.id, practiceSuccess)
    void countPuzzleDone()
  }, [practice, practiceSuccess, userMoved, play.uid])

  // Remember it, so the New game sheet starts from the new level too.
  useEffect(() => {
    if (adaptiveRating !== null) saveSettings({ ...loadSettings(), levelRating: adaptiveRating })
  }, [adaptiveRating, play.uid])

  // Badge on the square your last move landed on, until your next move (hidden if the bot captured it).
  const badge = showRatings ? lastUserBadge(play.history, shownRatings, play.userColor, play.game) : null

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
  if (askBlunder) statusText = 'Take it back, or play it anyway?'
  else if (play.engineError) statusText = play.engineError
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
  const badgeRatings = shownRatings.map((r) => (r && r !== 'pending' ? r.rating : r))
  const bookNote = showRatings
    ? leftBookNote(openingInfo, play.history, lastUserPly(play.history, play.userColor), play.userColor)
    : null
  const coachInput = {
    history: play.history,
    ratings: shownRatings,
    notes: shownNotes,
    liveCoaching: prefs.liveCoaching,
    gameOver,
    resultText: play.status.over ? resultText(play.status, play.userColor) : undefined,
    hint,
    hintStep,
    botNote: maiaNote,
    bookNote,
  }
  // Play it out: an introduction before your first move, and the claim buttons when they apply.
  const yourMoves = play.history.filter((m) => m.color === play.userColor).length
  const lastJ = lastUserJudgement(userRatings)
  const canClaim =
    !!practice &&
    !gameOver &&
    !askBlunder &&
    !!lastJ &&
    (practice.kind === 'win'
      ? lastJ.winAfter >= PLAY_IT_OUT.claimWinAt
      : yourMoves >= PLAY_IT_OUT.holdMoves && lastJ.winAfter >= PLAY_IT_OUT.holdAtLeast)
  const practiceIntro: CoachMessage | null =
    practice && yourMoves === 0 && !gameOver
      ? {
          id: `practice:${practice.id}`,
          tone: 'neutral',
          title: practice.kind === 'win' ? 'Win this position' : 'Hold this position',
          text:
            practice.kind === 'win'
              ? `You were winning here (${practice.evalText}) against ${practice.opponent} on ${formatDate(practice.gameDate)}, but the game slipped away. Finish the job: checkmate the bot.`
              : `You were worse here (${practice.evalText}) against ${practice.opponent} on ${formatDate(practice.gameDate)}, but it could still be saved. Hold it: a draw or better counts.`,
        }
      : null
  const withClaim = (m: CoachMessage): CoachMessage =>
    canClaim && practice
      ? {
          ...m,
          actions: [
            practice.kind === 'win'
              ? { label: 'Claim the win', primary: true, onClick: () => play.claim('win') }
              : { label: 'Count it as held', primary: true, onClick: () => play.claim('held') },
          ],
        }
      : m
  const coach = askBlunder ? askMessage : (practiceIntro ?? withClaim(coachMessage(coachInput)))
  // Beside the board the hint card lists the hint steps, so the bubble keeps the move rating.
  const coachBeside = askBlunder ? askMessage : (practiceIntro ?? withClaim(coachMessage({ ...coachInput, hint: null, hintStep: 0 })))

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
          thinking={play.botThinking && !askBlunder}
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
            onMove={(m) => play.playUserMove(m, prefs.blunderCheck)}
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
                practice={
                  practice && practiceSuccess !== null
                    ? { success: practiceSuccess, kind: practice.kind, moreHref: routeHref({ name: 'puzzles', theme: MISTAKES_POSITIONS }) }
                    : null
                }
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
          detail={[
            practice ? (practice.kind === 'win' ? 'Win it' : 'Hold it') : '',
            statusText,
            play.takebacks > 0 ? `${play.takebacks} takeback${play.takebacks > 1 ? 's' : ''}` : '',
            play.blunderChecks > 0 ? `${play.blunderChecks} blunder check${play.blunderChecks > 1 ? 's' : ''}` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
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
          ratings={shownRatings}
          notes={shownNotes}
          message={coachBeside}
          gameOver={gameOver}
          hintMode={prefs.hintMode}
          isUserTurn={play.isUserTurn}
          hint={analysis.hint}
          hintStep={hintStep}
          onHint={nextHint}
        />

        {/* Openings don't apply to a Play it out position. */}
        {!practice && (
          <OpeningPanel
            info={openingInfo}
            history={play.history}
            movesFrom={prefs.liveCoaching && play.isUserTurn ? play.fen : null}
          />
        )}

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
            label="Blunder check"
            description="If my move is a blunder, stop me once and ask if I'm sure, without saying why. Games with it on don't count towards my rating estimate."
            checked={prefs.blunderCheck}
            onChange={(v) => setPrefs({ blunderCheck: v })}
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

/** The rating of your latest rated move, if there is one. */
function lastUserJudgement(ratings: PlyRating[]): Exclude<PlyRating, 'pending' | null> | null {
  for (let i = ratings.length - 1; i >= 0; i--) {
    const r = ratings[i]
    if (r && r !== 'pending') return r
  }
  return null
}
