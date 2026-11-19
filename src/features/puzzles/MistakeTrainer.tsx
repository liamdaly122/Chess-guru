import { Chess, type Move, type Square } from 'chess.js'
import { useState } from 'react'
import { routeHref } from '../../app/route'
import type { MoveInput } from '../../chess/moves'
import { MISTAKE_PUZZLES } from '../../config/mistakes'
import { useAnalyser } from '../../engine/useAnalyser'
import { countPuzzleDone } from '../../goal/goalStore'
import {
  checkAttempt,
  isGoodAlternative,
  isMastered,
  moreDue,
  patternSet,
  patternStats,
  schedule,
  todaysSet,
  whenText,
  type MistakePuzzle,
  type PuzzleResult,
} from '../../puzzles/mistakes'
import { isPattern, PATTERNS } from '../../puzzles/patterns'
import { formatDate } from '../../storage/gameInfo'
import { saveMistakePuzzle } from '../../storage/mistakeStore'
import { BulbIcon, CheckIcon } from '../../ui/icons'
import { GameBoard } from '../play/GameBoard'
import { RatingBadge } from '../play/RatingBadge'
import { LESSON_PREFIX, LESSONS_ROUTE, MISTAKE_PATTERN_PREFIX, MISTAKES, MISTAKES_MORE, MISTAKES_POSITIONS, MISTAKES_TODAY } from './mistakeRoutes'
import { LessonPage, LessonsList, LessonsPage } from '../lessons/LessonPage'
import { isLessonCategory } from '../../lessons/lessons'
import { PracticeCard, PracticePage } from '../practice/PracticeList'

const href = (theme: string) => routeHref({ name: 'puzzles', theme })
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Your mistakes: today's set, your most common mistakes, or a session solving them. */
export function MistakesPage({ puzzles, theme }: { puzzles: MistakePuzzle[]; theme: string }) {
  if (theme === MISTAKES_POSITIONS) return <PracticePage />
  if (theme === LESSONS_ROUTE) return <LessonsPage />
  if (theme.startsWith(LESSON_PREFIX)) {
    const c = theme.slice(LESSON_PREFIX.length)
    if (isLessonCategory(c)) return <LessonPage key={c} category={c} mistakes={puzzles} />
  }
  if (puzzles.length === 0) {
    return (
      <div className="mistakes-home">
      <div className="card empty-state" data-testid="mistakes-empty">
        <p>
          <strong>No mistakes to practise yet.</strong>
        </p>
        <p className="muted">
          When a reviewed game has mistakes that cost you, the positions appear here, grouped by the kind of mistake.
          Play a game or review one from the Games page.
        </p>
      </div>
      <LessonsList max={3} />
      <PracticeCard />
      </div>
    )
  }
  if (theme === MISTAKES_TODAY || theme === MISTAKES_MORE) return <MistakeSession key={theme} puzzles={puzzles} kind={theme} />
  if (theme.startsWith(MISTAKE_PATTERN_PREFIX)) {
    const pattern = theme.slice(MISTAKE_PATTERN_PREFIX.length)
    return <MistakeSession key={theme} puzzles={puzzles} kind={pattern} />
  }
  return <MistakesHome puzzles={puzzles} />
}

function MistakesHome({ puzzles }: { puzzles: MistakePuzzle[] }) {
  const [now] = useState(() => Date.now())
  const [showAll, setShowAll] = useState(false)
  const today = todaysSet(puzzles, now)
  const stats = patternStats(puzzles, now)
  const nextDue = Math.min(...puzzles.filter((p) => !isMastered(p) && p.dueAt > now).map((p) => p.dueAt))
  const shown = showAll ? stats : stats.slice(0, 5)

  return (
    <div className="mistakes-home">
      <section className="card today-card" data-testid="mistakes-today">
        <h2 className="card-title">Today's mistakes</h2>
        {today.queue.length > 0 ? (
          <>
            <p>
              {today.doneToday === 0
                ? `${plural(today.queue.length, 'position')} from your most common mistakes.`
                : `${today.queue.length} of ${today.limit} left for today.`}
            </p>
            <a className="button-link primary wide" href={href(MISTAKES_TODAY)} data-testid="start-today">
              {today.doneToday === 0 ? 'Start' : 'Carry on'}
            </a>
          </>
        ) : today.waiting > 0 ? (
          <>
            <p>
              Done for today. {plural(today.waiting, 'more position')} {today.waiting === 1 ? 'is' : 'are'} waiting.
            </p>
            <a className="button-link wide" href={href(MISTAKES_MORE)}>
              Keep going
            </a>
          </>
        ) : (
          <p className="muted">
            All caught up{Number.isFinite(nextDue) ? `. The next position is due ${whenText(nextDue, now)}` : ''}.
          </p>
        )}
      </section>

      <section className="card" aria-label="Your most common mistakes" data-testid="mistake-patterns">
        <h2 className="card-title">Your most common mistakes</h2>
        <ul className="line-list">
          {shown.map((s) => (
            <li key={s.pattern} className="line-row pattern-row">
              <div className="line-info">
                <p className="line-name">{s.label}</p>
                <p className="muted small">
                  {s.times > 0
                    ? `${plural(s.times, 'time')} in ${plural(s.games, 'game')} lately`
                    : `Not in your recent games (${plural(s.timesEver, 'time')} before)`}
                  {s.improving ? ' · improving' : ''}
                  {s.mastered ? ` · ${s.mastered} mastered` : ''}
                </p>
              </div>
              <a className="button-link solve-button" href={href(MISTAKE_PATTERN_PREFIX + s.pattern)} aria-label={`Solve: ${s.label}`}>
                Solve {Math.min(s.puzzles, MISTAKE_PUZZLES.patternSet)}
              </a>
            </li>
          ))}
        </ul>
        {stats.length > shown.length && (
          <button type="button" className="link-button" onClick={() => setShowAll(true)}>
            Show all {stats.length}
          </button>
        )}
      </section>

      <LessonsList max={3} />
      <PracticeCard />
    </div>
  )
}

/** A short set of positions solved one after another, then a summary. */
function MistakeSession({ puzzles, kind }: { puzzles: MistakePuzzle[]; kind: string }) {
  // The set is fixed when the session starts, so saving results can't reshuffle it.
  const [ids] = useState(() => {
    const now = Date.now()
    const set = kind === MISTAKES_TODAY ? todaysSet(puzzles, now).queue : kind === MISTAKES_MORE ? moreDue(puzzles, now) : patternSet(puzzles, kind, now)
    return set.map((p) => p.id)
  })
  const [results, setResults] = useState<PuzzleResult[]>([])
  const pattern = isPattern(kind) ? PATTERNS[kind] : null
  const title = pattern ? pattern.label : kind === MISTAKES_TODAY ? "Today's mistakes" : 'More of your mistakes'
  const current = puzzles.find((p) => p.id === ids[results.length])
  const back = (
    <a className="back-link small" href={href(MISTAKES)}>
      ← Your mistakes
    </a>
  )

  if (ids.length === 0) {
    return (
      <div className="card empty-state">
        {back}
        <p>
          <strong>Nothing to solve here right now.</strong>
        </p>
        <p className="muted">New positions appear once a game's review is complete.</p>
      </div>
    )
  }

  if (!current) {
    const clean = results.filter((r) => r === 'solved').length
    return (
      <section className="card session-done" data-testid="session-done">
        <h2 className="card-title">{title}</h2>
        <p className="session-score">
          <CheckIcon /> {clean} of {plural(results.length, 'position')} solved first time.
        </p>
        <p className="muted">
          {clean === results.length
            ? 'Clean sweep. These come back later to make sure they stick.'
            : 'The ones you missed come back soon, the rest later.'}
          {pattern ? ` Next time: ${pattern.tip}` : ''}
        </p>
        <a className="button-link primary wide" href={href(MISTAKES)}>
          Back to your mistakes
        </a>
      </section>
    )
  }

  return (
    <>
      <div className="trainer-bar">
        {back}
        <p className="muted small" data-testid="session-progress">
          {title} · {results.length + 1} of {ids.length}
        </p>
      </div>
      <MistakePuzzleView key={current.id} puzzle={current} onNext={(r) => setResults((rs) => [...rs, r])} />
    </>
  )
}

type Phase =
  | { kind: 'playing'; feedback: string | null }
  | { kind: 'checking' }
  | { kind: 'done'; result: PuzzleResult; message: string; next: MistakePuzzle }

function MistakePuzzleView({ puzzle, onNext }: { puzzle: MistakePuzzle; onNext: (result: PuzzleResult) => void }) {
  const analyse = useAnalyser()
  const [fen, setFen] = useState(puzzle.fen)
  const [phase, setPhase] = useState<Phase>({ kind: 'playing', feedback: null })
  const [wrong, setWrong] = useState(0)
  const [usedHint, setUsedHint] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)

  const userColor = new Chess(puzzle.fen).turn()
  const side = userColor === 'w' ? 'White' : 'Black'
  const games = new Set(puzzle.occurrences.map((o) => o.gameId)).size

  async function finish(success: boolean, message: string) {
    const result: PuzzleResult = !success ? 'failed' : wrong === 0 && !usedHint ? 'solved' : 'helped'
    const next = schedule(puzzle, result, Date.now())
    await saveMistakePuzzle(next)
    void countPuzzleDone()
    setPhase({ kind: 'done', result, message, next })
  }

  function play(input: MoveInput): boolean {
    if (phase.kind !== 'playing') return false
    const uci = input.from + input.to + (input.promotion ?? '')
    const check = checkAttempt(puzzle, uci)
    if (check.verdict === 'illegal') return false
    setShowHint(false)
    const after = new Chess(puzzle.fen)
    after.move(input)
    setFen(after.fen())
    setLastMove({ from: input.from, to: input.to })

    if (check.verdict === 'correct') {
      void finish(true, uci === puzzle.solution ? `${puzzle.solutionSan} is the move.` : 'Checkmate. That works too!')
      return true
    }
    // A different move: ask the engine whether it's just as good.
    setPhase({ kind: 'checking' })
    void analyse(check.fenAfter, { depth: MISTAKE_PUZZLES.checkDepth, maxTimeMs: MISTAKE_PUZZLES.checkTimeMs }).then(
      (analysis) => {
        if (analysis && isGoodAlternative(puzzle, analysis)) {
          void finish(true, `That works too. The engine's first choice was ${puzzle.solutionSan}.`)
        } else {
          setWrong((w) => w + 1)
          setFen(puzzle.fen)
          setLastMove(null)
          setPhase({ kind: 'playing', feedback: "Not this one. It doesn't fix the problem. Try again." })
        }
      },
    )
    return true
  }

  function revealAnswer() {
    setShowAnswer(true)
    setShowHint(false)
    void finish(false, `The move was ${puzzle.solutionSan}.`)
  }

  const board = new Chess(fen)
  const solutionFrom = puzzle.solution.slice(0, 2) as Square
  const solutionTo = puzzle.solution.slice(2, 4) as Square
  const done = phase.kind === 'done'

  return (
    <div className="puzzle-layout">
      <section className="board-area">
        <p className="puzzle-prompt">
          <span className={`side-chip side-${userColor}`} /> {side} to play. Find a better move.
        </p>
        <p className="mistake-origin muted small">
          {games > 1 ? (
            <>
              You went wrong here in {games} games, most recently with <strong>{puzzle.playedSan}</strong> vs {puzzle.opponent}.
            </>
          ) : (
            <>
              From your game vs {puzzle.opponent}, {formatDate(puzzle.gameDate)}. You played <strong>{puzzle.playedSan}</strong> here
            </>
          )}{' '}
          <RatingBadge rating={puzzle.rating} size="sm" />
        </p>
        <GameBoard
          boardId="mistake-board"
          game={board}
          orientation={userColor === 'w' ? 'white' : 'black'}
          userColor={userColor}
          canMove={phase.kind === 'playing'}
          lastMove={lastMove ? ({ from: lastMove.from, to: lastMove.to } as Move) : undefined}
          onMove={play}
          glowSquare={showHint ? solutionFrom : null}
          arrow={showAnswer ? { from: solutionFrom, to: solutionTo, color: 'rgba(76, 175, 80, 0.85)' } : null}
          badge={
            done && phase.result !== 'failed' && lastMove
              ? { square: lastMove.to as Square, rating: phase.result === 'solved' ? 'best' : 'good' }
              : null
          }
        />
      </section>

      <aside className="side-area">
        <section className="card puzzle-card" data-testid="mistake-card" data-puzzle-id={puzzle.id}>
          <p className="pattern-chip">{PATTERNS[puzzle.pattern].label}</p>
          {phase.kind === 'playing' && (
            <>
              {phase.feedback ? (
                <p className="puzzle-feedback fb-wrong" role="status" data-testid="mistake-feedback">
                  {phase.feedback}
                </p>
              ) : (
                <p className="muted">Look again at the position. What did you miss?</p>
              )}
              <div className="puzzle-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowHint(true)
                    setUsedHint(true)
                  }}
                  disabled={showHint}
                >
                  <BulbIcon /> Hint
                </button>
                <button type="button" onClick={revealAnswer}>
                  Show answer
                </button>
              </div>
            </>
          )}

          {phase.kind === 'checking' && (
            <p className="muted" role="status" data-testid="mistake-feedback">
              Checking your move with the engine…
            </p>
          )}

          {phase.kind === 'done' && (
            <>
              <p className={`puzzle-feedback ${phase.result === 'failed' ? 'fb-revealed' : 'fb-solved'}`} role="status" data-testid="mistake-feedback">
                {phase.result !== 'failed' && <CheckIcon />}
                {phase.result === 'solved' ? 'Solved! ' : phase.result === 'helped' ? 'Solved, with some help. ' : ''}
                {phase.message}
              </p>
              <div className="mistake-lesson">
                <p className="coach-text">
                  <strong>In the game:</strong> {puzzle.note}
                </p>
                <p className="coach-tip">
                  <span className="tip-label">Next time</span>
                  {puzzle.tip}
                </p>
              </div>
              <p className="muted small" data-testid="mistake-schedule">
                {isMastered(phase.next)
                  ? 'Mastered: you have solved this one cleanly enough times. It won’t come back unless you make the mistake again.'
                  : phase.result === 'failed'
                    ? `It will come back ${whenText(phase.next.dueAt)} so you can try again.`
                    : `Next review ${whenText(phase.next.dueAt)}.`}
              </p>
              <button type="button" className="primary wide" onClick={() => onNext(phase.result)}>
                Next
              </button>
            </>
          )}
        </section>
      </aside>
    </div>
  )
}
