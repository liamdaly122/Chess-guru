import { Chess, type Move, type Square } from 'chess.js'
import { useEffect, useRef, useState } from 'react'
import { routeHref } from '../../app/route'
import { parseUci, type MoveInput } from '../../chess/moves'
import { OPENING_TRAINER } from '../../config/openingTrainer'
import { loadBook, type BookData } from '../../openings/book'
import {
  drillStats,
  dueDrills,
  expectedMove,
  fenAt,
  isDone,
  isMastered,
  opponentToMove,
  playReply,
  runResult,
  scheduleDrill,
  startRun,
  tryMove,
  type DrillRun,
  type OpeningDrill,
} from '../../openings/drill'
import { lineText } from '../../openings/lines'
import { saveDrill } from '../../storage/openingStore'
import { countPuzzleDone } from '../../goal/goalStore'
import { whenText, type PuzzleResult } from '../../training/srs'
import { BulbIcon, CheckIcon } from '../../ui/icons'
import { GameBoard } from '../play/GameBoard'
import { MoveStrip } from '../play/MoveStrip'

/** Route theme for the opening trainer, and for its list of lines. */
export const OPENINGS = 'openings'
export const OPENING_LINES = 'openings-lines'

const SIDE = { w: 'White', b: 'Black' } as const
const ARROW = 'rgba(76, 175, 80, 0.85)'

/**
 * Opening trainer: play through the lines you chose, from your side, with the app playing the
 * other side. A new line is shown move by move first, then asked from memory on a spaced
 * repetition schedule.
 */
export function OpeningTrainer({ drills }: { drills: OpeningDrill[] }) {
  const [now, setNow] = useState(() => Date.now())
  const [practiceAll, setPracticeAll] = useState(false)
  const [doneIds, setDoneIds] = useState<string[]>([])
  // Counts runs, so a line just learned starts afresh for the run from memory.
  const [round, setRound] = useState(0)
  const [book, setBook] = useState<BookData | null>(null)
  useEffect(() => {
    let live = true
    loadBook().then((b) => live && setBook(b))
    return () => {
      live = false
    }
  }, [])

  const queue = practiceAll
    ? drills.filter((d) => d.learned && !isMastered(d) && !doneIds.includes(d.id)).sort((a, b) => a.dueAt - b.dueAt)
    : dueDrills(drills, now).filter((d) => !doneIds.includes(d.id))
  // Keep the line on screen until "Next", even if the list reloads underneath it.
  const [currentId, setCurrentId] = useState<string | null>(null)
  if (currentId === null && queue[0]) setCurrentId(queue[0].id)
  const current = drills.find((d) => d.id === (currentId ?? queue[0]?.id)) ?? null
  const stats = drillStats(drills, now)
  const linesLink = (
    <a className="small" href={routeHref({ name: 'puzzles', theme: OPENING_LINES })} data-testid="opening-lines-link">
      Your lines ({drills.length}) · add more
    </a>
  )

  if (!current) {
    return (
      <div className="card empty-state" data-testid="openings-caught-up">
        <p>
          <strong>All caught up.</strong>
        </p>
        <p className="muted">
          {stats.learning} learning · {stats.mastered} mastered
          {stats.nextDueAt ? ` · next line due ${whenText(stats.nextDueAt, now)}` : ''}.
        </p>
        <div className="puzzle-actions">
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
          <a className="button-link" href={routeHref({ name: 'puzzles', theme: OPENING_LINES })}>
            Add lines
          </a>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="trainer-bar">
        <p className="muted small" data-testid="opening-stats">
          {stats.due} due · {stats.fresh} new · {stats.mastered} mastered
        </p>
        {linesLink}
      </div>
      {book ? (
        <DrillView
          key={`${current.id}:${round}`}
          drill={current}
          book={book}
          onNext={(wasLearning) => {
            // A line just learned stays in the queue, to be played from memory next.
            if (!wasLearning) setDoneIds((ids) => [...ids, current.id])
            setCurrentId(null)
            setRound((r) => r + 1)
            setNow(Date.now())
          }}
        />
      ) : (
        <p className="muted">Loading the opening book…</p>
      )}
    </>
  )
}

type Feedback = { kind: 'wrong' | 'correct' | 'revealed'; text: string } | null

function DrillView({ drill: given, book, onNext }: { drill: OpeningDrill; book: BookData; onNext: (wasLearning: boolean) => void }) {
  // The line as it was when this run started (saving the result reloads the list).
  const [drill] = useState(given)
  const [run, setRun] = useState<DrillRun>(() => startRun(drill))
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [hint, setHint] = useState(false)
  const [finished, setFinished] = useState<{ result: PuzzleResult; next: OpeningDrill } | null>(null)
  const saving = useRef(false)
  const learning = !drill.learned
  const done = isDone(run)

  // The app plays the other side's moves of the line, after a short pause.
  useEffect(() => {
    if (!opponentToMove(run)) return
    const t = setTimeout(() => setRun((r) => playReply(r)), OPENING_TRAINER.replyDelayMs)
    return () => clearTimeout(t)
  }, [run])

  // End of the line: save the new schedule.
  useEffect(() => {
    if (!done || saving.current) return
    saving.current = true
    const result = runResult(run)
    const next = scheduleDrill(drill, result, Date.now())
    void saveDrill(next).then(() => setFinished({ result, next }))
    void countPuzzleDone()
  }, [done, run, drill])

  const fen = fenAt(drill, run.ply)
  const board = new Chess(fen)
  const expected = expectedMove(run)
  const showArrow = expected && (learning || run.shown)
  const history: Move[] = (() => {
    const c = new Chess()
    for (const m of drill.uci.slice(0, run.ply)) c.move(parseUci(m))
    return c.history({ verbose: true })
  })()
  const last = history.at(-1)

  function onMove(input: MoveInput): boolean {
    const uci = input.from + input.to + (input.promotion ?? '')
    const r = tryMove(run, uci, book)
    if (r.kind === 'illegal') return false
    setHint(false)
    if (r.kind === 'correct') {
      setRun(r.run)
      setFeedback(isDone(r.run) ? null : { kind: 'correct', text: 'Yes. Keep going.' })
      return true
    }
    setRun(r.run)
    setFeedback(
      r.kind === 'other-book'
        ? { kind: 'revealed', text: `${r.san} is a book move too, but not in this line. Try again.` }
        : { kind: 'wrong', text: `${r.san} isn't a book move here. Try again.` },
    )
    return false
  }

  const promptText = learning
    ? 'New line: play the moves shown by the arrow.'
    : run.shown
      ? 'Play the move shown, then carry on.'
      : 'Play the line from memory.'

  return (
    <div className="puzzle-layout">
      <section className="board-area">
        <p className="puzzle-prompt">
          <span className={`side-chip side-${drill.side}`} /> {drill.name}
        </p>
        <p className="muted small drill-sub">
          {drill.eco} · as {SIDE[drill.side]} · {drill.san.length} half-moves
        </p>
        <MoveStrip history={history} ratings={[]} />
        <GameBoard
          boardId="opening-board"
          game={board}
          orientation={drill.side === 'w' ? 'white' : 'black'}
          userColor={drill.side}
          canMove={!!expected && !done}
          lastMove={last}
          onMove={onMove}
          glowSquare={hint && expected ? (expected.slice(0, 2) as Square) : null}
          arrow={showArrow ? { from: expected.slice(0, 2) as Square, to: expected.slice(2, 4) as Square, color: ARROW } : null}
          badge={finished && last && last.color === drill.side ? { square: last.to, rating: finished.result === 'solved' ? 'book' : 'good' } : null}
        />
      </section>

      <aside className="side-area">
        <section className="card puzzle-card" data-testid="opening-card" data-drill-id={drill.id}>
          {!done && (
            <>
              {feedback ? (
                <p className={`puzzle-feedback fb-${feedback.kind}`} role="status" data-testid="opening-feedback">
                  {feedback.text}
                </p>
              ) : (
                <p className="muted">{expected ? promptText : 'Your opponent is moving…'}</p>
              )}
              {!learning && (
                <div className="puzzle-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setHint(true)
                      setRun((r) => ({ ...r, helped: true }))
                    }}
                    disabled={hint || run.shown || !expected}
                  >
                    <BulbIcon /> Hint
                  </button>
                  <button type="button" onClick={() => setRun((r) => ({ ...r, shown: true }))} disabled={run.shown || !expected}>
                    Show move
                  </button>
                </div>
              )}
            </>
          )}

          {done && finished && (
            <>
              <p
                className={`puzzle-feedback ${finished.result === 'failed' ? 'fb-revealed' : 'fb-solved'}`}
                role="status"
                data-testid="opening-feedback"
              >
                {finished.result !== 'failed' && <CheckIcon />}
                {learning
                  ? 'Line played through. Next, play it from memory.'
                  : finished.result === 'solved'
                    ? 'Perfect. You know this line.'
                    : finished.result === 'helped'
                      ? 'Line complete, with some help.'
                      : 'Line complete. It will come back soon.'}
              </p>
              <p className="drill-line">{lineText(drill.san)}</p>
              <p className="muted small" data-testid="opening-schedule">
                {learning
                  ? 'New lines are asked again straight away.'
                  : isMastered(finished.next)
                    ? 'Mastered: you have played this line from memory enough times.'
                    : `Next review ${whenText(finished.next.dueAt)}.`}
              </p>
              <button type="button" className="primary wide" onClick={() => onNext(learning)}>
                Next
              </button>
            </>
          )}
        </section>
      </aside>
    </div>
  )
}
