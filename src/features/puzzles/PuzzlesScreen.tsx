import { Chess, type Move, type Square } from 'chess.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { navigate, routeHref } from '../../app/route'
import type { MoveInput } from '../../chess/moves'
import { progressStats } from '../../progress/stats'
import {
  expectedMove,
  loadPuzzles,
  revealNextMove,
  selectPuzzle,
  startPuzzle,
  tryPuzzleMove,
  updatePuzzleRating,
  type Puzzle,
  type PuzzleState,
} from '../../puzzles/puzzle'
import { recommendedThemes, THEME_LABEL } from '../../puzzles/themes'
import { puzzleStartRating, ratingSummary } from '../../rating/estimate'
import { recordAttempt } from '../../storage/puzzleStore'
import { countPuzzleDone } from '../../goal/goalStore'
import { usePuzzleData } from '../../storage/usePuzzleData'
import { useGames } from '../../storage/useGames'
import { PUZZLES } from '../train/trainRoutes'
import { BulbIcon, CheckIcon, TargetIcon } from '../../ui/icons'
import { GameBoard } from '../play/GameBoard'

/**
 * Rated puzzles: a mix from your weak spots, or one chosen theme. `theme` is a puzzle theme,
 * or anything else for the mix.
 */
export function PuzzlesPage({ theme }: { theme?: string }) {
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null)
  const data = usePuzzleData()
  const games = useGames()
  const recommended = useMemo(() => recommendedThemes(games ? progressStats(games) : null), [games])
  const estimate = useMemo(() => (games ? ratingSummary(games).estimate : null), [games])
  // Before your first puzzle, start from your estimated playing rating.
  const rating = data ? puzzleStartRating(data.rating, data.attempts.length, estimate) : null

  useEffect(() => {
    let live = true
    loadPuzzles().then((p) => live && setPuzzles(p))
    return () => {
      live = false
    }
  }, [])

  const selected = theme && THEME_LABEL[theme] ? theme : PUZZLES

  if (!puzzles || !data) return <p className="muted">Loading puzzles…</p>

  return (
    <>
      <div className="theme-chips theme-picker" role="tablist" aria-label="Theme">
        <a className={`chip ${selected === PUZZLES ? 'active' : ''}`} href={routeHref({ name: 'train', theme: PUZZLES })}>
          Your weak spots
        </a>
        {recommended.map((t) => (
          <a key={t} className={`chip ${selected === t ? 'active' : ''}`} href={routeHref({ name: 'train', theme: t })}>
            {THEME_LABEL[t]}
          </a>
        ))}
        <select
          aria-label="More themes"
          className="chip theme-select"
          value={recommended.includes(selected) || selected === PUZZLES ? '' : selected}
          onChange={(e) => e.target.value && navigate({ name: 'train', theme: e.target.value })}
        >
          <option value="">More themes…</option>
          {Object.entries(THEME_LABEL)
            .filter(([t]) => !recommended.includes(t))
            .map(([t, label]) => (
              <option key={t} value={t}>
                {label}
              </option>
            ))}
        </select>
      </div>
      <Trainer
        key={selected}
        puzzles={puzzles}
        themes={selected === PUZZLES ? recommended : [selected]}
        rating={rating ?? data.rating}
        done={new Set(data.attempts.map((a) => a.puzzleId))}
      />
    </>
  )
}

/** The puzzle rating chip for the page header. */
export function PuzzleRatingChip() {
  const data = usePuzzleData()
  const games = useGames()
  const estimate = useMemo(() => (games ? ratingSummary(games).estimate : null), [games])
  if (!data) return null
  return (
    <span className="puzzle-rating" data-testid="puzzle-rating" title="Your puzzle rating">
      <TargetIcon width={18} height={18} /> {puzzleStartRating(data.rating, data.attempts.length, estimate)}
    </span>
  )
}

interface TrainerProps {
  puzzles: Puzzle[]
  themes: string[]
  rating: number
  done: Set<string>
  /** A fixed-size set (for lessons): after this many puzzles, `onSetDone` instead of the next one. */
  limit?: number
  onSetDone?: (solvedFirstTime: number, total: number) => void
}

type Feedback = { kind: 'wrong' | 'correct' | 'solved' | 'revealed'; text: string } | null

export function Trainer({ puzzles, themes, rating, done, limit, onSetDone }: TrainerProps) {
  const [finished, setFinished] = useState<boolean[]>([])
  const pick = (exclude: Set<string>) => selectPuzzle(puzzles, { rating, themes, exclude })
  const [state, setState] = useState<PuzzleState | null>(() => {
    const p = pick(done)
    return p ? startPuzzle(p) : null
  })
  // Position shown while the opponent's reply is on its way (so the reply animates).
  const [shownFen, setShownFen] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [usedHelp, setUsedHelp] = useState(false)
  const [hint, setHint] = useState(false)
  const [result, setResult] = useState<{ solved: boolean; change: number } | null>(null)
  const seen = useRef(new Set(done))
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  if (!state) {
    return <p className="card muted">No puzzles left for this theme near your rating. Try another theme.</p>
  }

  const fen = shownFen ?? state.fen
  const board = new Chess(fen)
  const side = state.userColor === 'w' ? 'White' : 'Black'

  async function finish(s: PuzzleState, helped: boolean) {
    const solved = s.wrong === 0 && !helped
    const after = updatePuzzleRating(rating, s.puzzle.rating, solved)
    setResult({ solved, change: after - rating })
    setFinished((f) => [...f, solved])
    void countPuzzleDone()
    await recordAttempt({
      id: `${s.puzzle.id}:${Date.now()}`,
      puzzleId: s.puzzle.id,
      at: Date.now(),
      solved,
      themes: s.puzzle.themes,
      puzzleRating: s.puzzle.rating,
      ratingBefore: rating,
      ratingAfter: after,
    })
  }

  function onMove(input: MoveInput): boolean {
    if (!state || state.status !== 'playing') return false
    const uci = input.from + input.to + (input.promotion ?? '')
    const { state: next, result: r } = tryPuzzleMove(state, uci)
    if (r === 'illegal') return false
    setHint(false)
    if (r === 'wrong') {
      setState(next)
      setFeedback({ kind: 'wrong', text: "That's not it. Try again." })
      return false
    }
    if (r === 'solved') {
      setState(next)
      setFeedback({ kind: 'solved', text: next.wrong === 0 && !usedHelp ? 'Solved!' : 'Solved, with some help.' })
      void finish(next, usedHelp)
      return true
    }
    // Correct: show your move, then the opponent's reply a moment later.
    const mid = new Chess(state.fen)
    mid.move(input)
    setShownFen(mid.fen())
    setFeedback({ kind: 'correct', text: 'Good move. Keep going.' })
    timer.current = setTimeout(() => {
      setShownFen(null)
      setState(next)
    }, 450)
    return true
  }

  function showSolutionStep() {
    if (!state) return
    setUsedHelp(true)
    setHint(false)
    const next = revealNextMove(state)
    setState(next)
    if (next.status === 'solved') {
      setFeedback({ kind: 'revealed', text: 'That was the solution.' })
      void finish(next, true)
    } else setFeedback({ kind: 'revealed', text: 'Here is the move. Find the next one.' })
  }

  function nextPuzzle() {
    if (!state) return
    if (limit && finished.length >= limit) {
      onSetDone?.(finished.filter(Boolean).length, finished.length)
      return
    }
    seen.current.add(state.puzzle.id)
    const p = pick(seen.current)
    setState(p ? startPuzzle(p) : null)
    setShownFen(null)
    setFeedback(null)
    setUsedHelp(false)
    setHint(false)
    setResult(null)
  }

  const expected = expectedMove(state)
  const lastMove = state.lastMove ? ({ from: state.lastMove.from, to: state.lastMove.to } as Move) : undefined

  return (
    <div className="puzzle-layout">
      <section className="board-area">
        <p className="puzzle-prompt">
          <span className={`side-chip side-${state.userColor}`} /> {side} to play. Find the best move.
        </p>
        <GameBoard
          boardId="puzzle-board"
          game={board}
          orientation={state.userColor === 'w' ? 'white' : 'black'}
          userColor={state.userColor}
          canMove={state.status === 'playing' && !shownFen}
          lastMove={lastMove}
          onMove={onMove}
          glowSquare={hint && expected ? (expected.from as Square) : null}
          badge={
            state.status === 'solved' && state.lastMove
              ? { square: state.lastMove.to as Square, rating: result?.solved === false ? 'good' : 'best' }
              : null
          }
        />
      </section>
      <aside className="side-area">
        <section className="card puzzle-card" data-testid="puzzle-card" data-puzzle-id={state.puzzle.id}>
          {limit && (
            <p className="muted small set-progress" data-testid="set-progress">
              Puzzle {Math.min(limit, finished.length + (state.status === 'solved' ? 0 : 1))} of {limit}
            </p>
          )}
          {!feedback && <p className="muted">Play the move you think is best. Tap Hint if you are stuck.</p>}
          {feedback && (
            <p className={`puzzle-feedback fb-${feedback.kind}`} role="status" data-testid="puzzle-feedback">
              {feedback.kind === 'solved' && <CheckIcon />} {feedback.text}
            </p>
          )}
          {result && (
            <p className="puzzle-result">
              Rating {result.change >= 0 ? '+' : '−'}
              {Math.abs(result.change)} · puzzle {state.puzzle.rating} ·{' '}
              {state.puzzle.themes.map((t) => THEME_LABEL[t] ?? t).join(', ')}
            </p>
          )}
          <div className="puzzle-actions">
            {state.status === 'playing' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setHint(true)
                    setUsedHelp(true)
                  }}
                  disabled={hint}
                >
                  <BulbIcon /> Hint
                </button>
                <button type="button" onClick={showSolutionStep}>
                  Show solution
                </button>
                <button type="button" className="link-button" onClick={nextPuzzle}>
                  Skip
                </button>
              </>
            ) : (
              <button type="button" className="primary wide" onClick={nextPuzzle}>
                {limit && finished.length >= limit ? 'Finish' : 'Next puzzle'}
              </button>
            )}
          </div>
          {state.status === 'solved' && (
            <a className="muted small" href={`https://lichess.org/training/${state.puzzle.id}`} target="_blank" rel="noreferrer">
              Puzzle {state.puzzle.id} on Lichess
            </a>
          )}
        </section>
        <p className="muted small puzzle-note">
          Hints and "show solution" count as not solved for your rating. Puzzles are from the Lichess puzzle database.
        </p>
      </aside>
    </div>
  )
}
