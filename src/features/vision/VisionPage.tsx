import { Chess, type Square } from 'chess.js'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { routeHref } from '../../app/route'
import { countPuzzleDone } from '../../goal/goalStore'
import { loadPuzzles, type Puzzle } from '../../puzzles/puzzle'
import { CheckIcon } from '../../ui/icons'
import {
  checkVision,
  drillTitle,
  makeSet,
  MAX_COUNT,
  VISION_INFO,
  VISION_SET,
  VISION_TYPES,
  type VisionQuestion,
  type VisionResult,
} from '../../vision/drills'
import { formatTime, recordVisionSet, useVisionRecords, type VisionDrill, type VisionRecord } from '../../vision/visionStore'
import { GameBoard } from '../play/GameBoard'
import { VISION_PREFIX } from '../train/trainRoutes'

const DRILLS: VisionDrill[] = ['mixed', ...VISION_TYPES]

function recordText(r: VisionRecord | undefined): string {
  if (!r) return 'Not tried yet'
  return `Best ${r.best} of ${VISION_SET} in ${formatTime(r.bestMs)} · ${r.sets} ${r.sets === 1 ? 'set' : 'sets'}`
}

/** The drills, each with your best set. */
export function VisionList() {
  const records = useVisionRecords()
  return (
    <div className="mistakes-home">
      <p className="muted small practice-about">
        Quick questions about real positions, answered without moving any pieces: the seeing that calculating depends on.
        Sets of {VISION_SET}, timed.
      </p>
      <section className="card" aria-label="Board vision drills" data-testid="vision-list">
        <ul className="line-list">
          {DRILLS.map((d) => (
            <li key={d} className="line-row" data-testid="vision-row" data-drill={d}>
              <div className="line-info">
                <p className="line-name">{drillTitle(d)}</p>
                <p className="muted small">{d === 'mixed' ? 'All four kinds of question, in turn.' : VISION_INFO[d].about}</p>
                <p className="muted small">
                  {records ? recordText(records[d]) : ''}
                  {records?.[d] && records[d]!.best >= 8 ? (
                    <>
                      {' '}
                      <CheckIcon width={13} height={13} />
                    </>
                  ) : null}
                </p>
              </div>
              <a className="button-link primary solve-button" href={routeHref({ name: 'train', theme: VISION_PREFIX + d })}>
                Start
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

const MARK: Record<'tapped' | 'right' | 'missed' | 'wrong', CSSProperties> = {
  tapped: { backgroundColor: 'rgba(59, 130, 246, 0.55)' },
  right: { backgroundColor: 'rgba(76, 175, 80, 0.7)' },
  missed: { boxShadow: 'inset 0 0 0 4px rgba(240, 138, 36, 0.95)' },
  wrong: { backgroundColor: 'rgba(226, 69, 60, 0.6)' },
}

/** One set of questions, then the score. */
export function VisionSession({ drill }: { drill: VisionDrill }) {
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null)
  // The set is built once when it starts, so answering can't reshuffle it.
  const [run, setRun] = useState<{ round: number; set: VisionQuestion[] } | null>(null)
  useEffect(() => {
    let live = true
    loadPuzzles().then((p) => {
      if (!live) return
      setPuzzles(p)
      setRun({ round: 0, set: makeSet(drill, p, VISION_SET) })
    })
    return () => {
      live = false
    }
  }, [drill])
  if (!run || !puzzles) return <p className="muted">Loading positions…</p>
  return (
    <VisionRun
      key={run.round}
      drill={drill}
      set={run.set}
      onAgain={() => setRun({ round: run.round + 1, set: makeSet(drill, puzzles, VISION_SET) })}
    />
  )
}

function VisionRun({ drill, set, onAgain }: { drill: VisionDrill; set: VisionQuestion[]; onAgain: () => void }) {
  const [index, setIndex] = useState(0)
  const [tapped, setTapped] = useState<Square[]>([])
  const [result, setResult] = useState<VisionResult | null>(null)
  const [score, setScore] = useState<boolean[]>([])
  const [done, setDone] = useState<{ ms: number; best: boolean } | null>(null)
  const [startedAt] = useState(() => Date.now())
  const finishedAt = useRef<number | null>(null)
  // Saving is asynchronous: a second tap on Finish must not save or count the set twice.
  const saving = useRef(false)
  const q = set[index]

  const board = useMemo(() => new Chess(result && q.finalFen ? q.finalFen : q.fen), [q, result])

  if (done) {
    const right = score.filter(Boolean).length
    return (
      <section className="card session-done" data-testid="vision-done">
        <h2 className="card-title">{drillTitle(drill)}</h2>
        <p className="session-score">
          <CheckIcon /> {right} of {set.length} right in {formatTime(done.ms)}.
        </p>
        <p className="muted">{done.best ? 'Your best set yet.' : right === set.length ? 'A clean set.' : 'Each set uses new positions.'}</p>
        <div className="puzzle-actions">
          <button type="button" className="primary" onClick={onAgain} data-testid="vision-again">
            Another set
          </button>
          <a className="button-link" href={routeHref({ name: 'train', theme: 'vision' })}>
            All drills
          </a>
        </div>
      </section>
    )
  }

  function check(given: Square[] | number) {
    const r = checkVision(q, given)
    setResult(r)
    setScore((s) => [...s, r.correct])
    if (index === set.length - 1) finishedAt.current = Date.now()
  }

  function next() {
    if (index < set.length - 1) {
      setIndex(index + 1)
      setTapped([])
      setResult(null)
      return
    }
    if (saving.current) return
    saving.current = true
    const ms = (finishedAt.current ?? Date.now()) - startedAt
    const right = score.filter(Boolean).length
    void countPuzzleDone()
    void recordVisionSet(drill, right, ms).then((best) => setDone({ ms, best }))
  }

  const marks: Partial<Record<Square, CSSProperties>> = {}
  if (!result) for (const s of tapped) marks[s] = MARK.tapped
  else {
    for (const s of result.right) marks[s] = MARK.right
    for (const s of result.missed) marks[s] = MARK.missed
    for (const s of result.wrong) marks[s] = MARK.wrong
  }

  const squaresQuestion = q.answer.kind === 'squares'
  const side = q.color === 'w' ? 'White' : 'Black'

  return (
    <div className="puzzle-layout vision-layout" data-testid="vision-question" data-type={q.type} data-fen={q.fen}>
      <section className="board-area">
        <p className="puzzle-prompt vision-prompt" data-testid="vision-prompt">
          <span className={`side-chip side-${q.color}`} />
          <span>
            {q.type === 'imagine' ? (
              <>
                Picture these moves:
                <span className="vision-moves" data-testid="vision-moves">
                  {q.moves}
                </span>
                Then tap every {side} piece or pawn that is attacked (not the king).
              </>
            ) : (
              q.prompt
            )}
          </span>
        </p>
        <GameBoard
          boardId="vision-board"
          game={board}
          orientation={q.color === 'w' ? 'white' : 'black'}
          userColor={q.color}
          canMove={false}
          onMove={() => false}
          glowSquare={q.focus ?? null}
          onSquareTap={
            squaresQuestion && !result
              ? (s) => setTapped((t) => (t.includes(s) ? t.filter((x) => x !== s) : [...t, s]))
              : () => {}
          }
          squareMarks={marks}
        />
      </section>
      <aside className="side-area">
        <section className="card puzzle-card vision-card" data-testid="vision-card">
          {!result && squaresQuestion && (
            <div className="puzzle-actions">
              <button type="button" className="primary" onClick={() => check(tapped)} data-testid="vision-check">
                Check{tapped.length ? ` (${tapped.length})` : ''}
              </button>
              <button type="button" onClick={() => setTapped([])} disabled={!tapped.length}>
                Clear
              </button>
            </div>
          )}

          {!result && !squaresQuestion && (
            <div className="count-buttons" role="group" aria-label="How many">
              {Array.from({ length: MAX_COUNT + 1 }, (_, n) => (
                <button key={n} type="button" onClick={() => check(n)} data-testid={`count-${n}`}>
                  {n === MAX_COUNT ? `${n}+` : n}
                </button>
              ))}
            </div>
          )}

          {result && (
            <>
              <p className={`puzzle-feedback ${result.correct ? 'fb-solved' : 'fb-wrong'}`} role="status" data-testid="vision-feedback">
                {result.correct && <CheckIcon />} {result.text}
              </p>
              {q.type === 'imagine' && <p className="muted small">The board now shows the position after the moves.</p>}
              {squaresQuestion && !result.correct && (
                <p className="muted small vision-key">
                  <span className="key key-right" /> found <span className="key key-missed" /> missed <span className="key key-wrong" /> wrong
                </p>
              )}
              <button type="button" className="primary wide" onClick={next} data-testid="vision-next">
                {index === set.length - 1 ? 'Finish' : 'Next'}
              </button>
            </>
          )}
          <p className="muted small vision-progress" data-testid="vision-progress">
            Question {index + 1} of {set.length} · {score.filter(Boolean).length} right
          </p>
        </section>
      </aside>
    </div>
  )
}
