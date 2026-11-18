import { Chess, type Move, type Square } from 'chess.js'
import { useState } from 'react'
import type { MoveInput } from '../../chess/moves'
import { MISTAKE_PUZZLES } from '../../config/mistakes'
import { useAnalyser } from '../../engine/useAnalyser'
import {
  byDue,
  checkAttempt,
  duePuzzles,
  isGoodAlternative,
  isMastered,
  mistakeStats,
  schedule,
  whenText,
  type MistakePuzzle,
  type PuzzleResult,
} from '../../puzzles/mistakes'
import { formatDate } from '../../storage/gameInfo'
import { saveMistakePuzzle } from '../../storage/mistakeStore'
import { BulbIcon, CheckIcon } from '../../ui/icons'
import { GameBoard } from '../play/GameBoard'
import { RatingBadge } from '../play/RatingBadge'

interface Props {
  puzzles: MistakePuzzle[]
}

/**
 * "Find the move you missed": puzzles made from your own mistakes and blunders, brought back on
 * a spaced-repetition schedule until you solve them cleanly several times.
 */
export function MistakeTrainer({ puzzles }: Props) {
  // The clock is read when a session starts or moves on, not during render.
  const [now, setNow] = useState(() => Date.now())
  const [practiceAll, setPracticeAll] = useState(false)
  const [doneIds, setDoneIds] = useState<string[]>([])
  const queue = practiceAll
    ? puzzles.filter((p) => !isMastered(p) && !doneIds.includes(p.id)).sort(byDue)
    : duePuzzles(puzzles, now).filter((p) => !doneIds.includes(p.id))
  // Pin the puzzle on screen until "Next", so a reload of the list can't swap it mid-solve.
  const [currentId, setCurrentId] = useState<string | null>(null)
  if (currentId === null && queue[0]) setCurrentId(queue[0].id)
  const current = puzzles.find((p) => p.id === (currentId ?? queue[0]?.id)) ?? null
  const stats = mistakeStats(puzzles, now)

  if (puzzles.length === 0) {
    return (
      <div className="card empty-state" data-testid="mistakes-empty">
        <p>
          <strong>No mistakes to practise yet.</strong>
        </p>
        <p className="muted">
          When a reviewed game has mistakes or blunders, each one becomes a puzzle here: find the move you missed.
          Play a game or review one from the Games page.
        </p>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="card empty-state" data-testid="mistakes-caught-up">
        <p>
          <strong>All caught up.</strong>
        </p>
        <p className="muted">
          {stats.learning} learning · {stats.mastered} mastered
          {stats.nextDueAt ? ` · next one due ${whenText(stats.nextDueAt, now)}` : ''}.
        </p>
        {stats.learning > 0 && (
          <button
            type="button"
            onClick={() => {
              setPracticeAll(true)
              setDoneIds([])
            }}
          >
            Practise anyway
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <p className="muted small mistake-stats" data-testid="mistake-stats">
        {stats.due} due · {stats.learning} learning · {stats.mastered} mastered
      </p>
      <MistakePuzzleView
        key={current.id}
        puzzle={current}
        onNext={() => {
          setDoneIds((ids) => [...ids, current.id])
          setCurrentId(null)
          setNow(Date.now())
        }}
      />
    </>
  )
}

type Phase =
  | { kind: 'playing'; feedback: string | null }
  | { kind: 'checking' }
  | { kind: 'done'; result: PuzzleResult; message: string; next: MistakePuzzle }

function MistakePuzzleView({ puzzle, onNext }: { puzzle: MistakePuzzle; onNext: () => void }) {
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

  async function finish(success: boolean, message: string) {
    const result: PuzzleResult = !success ? 'failed' : wrong === 0 && !usedHint ? 'solved' : 'helped'
    const next = schedule(puzzle, result, Date.now())
    await saveMistakePuzzle(next)
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
          From your game vs {puzzle.opponent}, {formatDate(puzzle.gameDate)}. You played{' '}
          <strong>{puzzle.playedSan}</strong> here <RatingBadge rating={puzzle.rating} size="sm" />
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
                  ? 'Mastered: you have solved this one cleanly enough times. It won’t come back.'
                  : phase.result === 'failed'
                    ? `It will come back ${whenText(phase.next.dueAt)} so you can try again.`
                    : `Next review ${whenText(phase.next.dueAt)}.`}
              </p>
              <button type="button" className="primary wide" onClick={onNext}>
                Next
              </button>
            </>
          )}
        </section>
      </aside>
    </div>
  )
}
