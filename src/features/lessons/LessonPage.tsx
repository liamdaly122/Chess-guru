import { Chess, type Square } from 'chess.js'
import { useEffect, useMemo, useState } from 'react'
import { routeHref } from '../../app/route'
import { LESSONS, lessonCounts, lessonExample, lessonsByNeed } from '../../lessons/lessons'
import { recordLessonSet, useLessonRecords, type LessonRecord } from '../../lessons/lessonStore'
import { patternStats, type MistakePuzzle } from '../../puzzles/mistakes'
import { loadPuzzles, type Puzzle } from '../../puzzles/puzzle'
import { THEME_LABEL } from '../../puzzles/themes'
import type { LessonCategory } from '../../review/types'
import { formatDate } from '../../storage/gameInfo'
import { useGames } from '../../storage/useGames'
import { usePuzzleData } from '../../storage/usePuzzleData'
import { CheckIcon } from '../../ui/icons'
import { CoachBubble } from '../play/CoachBubble'
import { GameBoard } from '../play/GameBoard'
import { Trainer } from '../puzzles/PuzzlesScreen'
import { LESSON_PREFIX, LESSONS_ROUTE, MISTAKE_PATTERN_PREFIX, MISTAKES } from '../puzzles/mistakeRoutes'

export const LESSON_SET = 5
const href = (theme: string) => routeHref({ name: 'puzzles', theme })

function progressText(r: LessonRecord | undefined): string {
  if (!r) return 'Not practised yet'
  return `Practised ${r.sets} ${r.sets === 1 ? 'time' : 'times'} · best ${r.best} of ${LESSON_SET}`
}

/** The lessons, your costliest kind of mistake first. `max` shows only the first few (a card on the Mistakes page). */
export function LessonsList({ max }: { max?: number }) {
  const games = useGames()
  const records = useLessonRecords()
  const order = useMemo(() => (games ? lessonsByNeed(games) : null), [games])
  const counts = useMemo(() => (games ? lessonCounts(games) : null), [games])
  if (!order || !counts || !records) return null
  const shown = max ? order.slice(0, max) : order
  return (
    <section className="card" aria-label="Lessons" data-testid="lessons-card">
      <h2 className="card-title">Lessons</h2>
      <ul className="line-list">
        {shown.map((c) => (
          <li key={c} className="line-row" data-testid="lesson-row" data-category={c}>
            <div className="line-info">
              <p className="line-name">{LESSONS[c].title}</p>
              <p className="muted small">
                {counts[c].times > 0 ? `${counts[c].times} ${counts[c].times === 1 ? 'mistake' : 'mistakes'} of this kind · ` : ''}
                {progressText(records[c])}
                {records[c] && records[c]!.best >= 4 ? (
                  <>
                    {' '}
                    <CheckIcon width={13} height={13} />
                  </>
                ) : null}
              </p>
            </div>
            <a className="button-link solve-button" href={href(LESSON_PREFIX + c)}>
              Open
            </a>
          </li>
        ))}
      </ul>
      {max && order.length > max && (
        <a className="small see-all" href={href(LESSONS_ROUTE)}>
          All {order.length} lessons
        </a>
      )}
    </section>
  )
}

export function LessonsPage() {
  return (
    <div className="mistakes-home">
      <a className="back-link small" href={href(MISTAKES)}>
        ← Your mistakes
      </a>
      <p className="muted small practice-about">
        Short lessons on the kinds of mistake the coach finds in your games, your costliest first. Each ends with {LESSON_SET}{' '}
        puzzles to practise.
      </p>
      <LessonsList />
    </div>
  )
}

/** One lesson: what the mistake is, how to spot it, an example from your games, and a practice set. */
export function LessonPage({ category, mistakes }: { category: LessonCategory; mistakes: MistakePuzzle[] }) {
  const lesson = LESSONS[category]
  const games = useGames()
  const data = usePuzzleData()
  const records = useLessonRecords()
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null)
  const [mode, setMode] = useState<'read' | 'practise' | { solved: number; total: number }>('read')
  const [showBest, setShowBest] = useState(false)
  const [round, setRound] = useState(0)

  useEffect(() => {
    let live = true
    loadPuzzles().then((p) => live && setPuzzles(p))
    return () => {
      live = false
    }
  }, [])

  const example = useMemo(() => (games ? lessonExample(games, category) : null), [games, category])
  const yourPattern = useMemo(
    () => patternStats(mistakes).find((s) => (lesson.patterns as string[]).includes(s.pattern)) ?? null,
    [mistakes, lesson.patterns],
  )
  const board = useMemo(() => (example ? new Chess(example.fen) : null), [example])
  const back = (
    <a className="back-link small" href={href(LESSONS_ROUTE)}>
      ← Lessons
    </a>
  )

  if (mode === 'practise' && puzzles && data) {
    return (
      <div className="lesson-practice">
        <div className="trainer-bar">
          <button type="button" className="link-button back-link small" onClick={() => setMode('read')}>
            ← {lesson.title}
          </button>
        </div>
        <Trainer
          key={round}
          puzzles={puzzles}
          themes={lesson.themes}
          rating={data.rating}
          done={new Set(data.attempts.map((a) => a.puzzleId))}
          limit={LESSON_SET}
          onSetDone={(solved, total) => {
            void recordLessonSet(category, solved)
            setMode({ solved, total })
          }}
        />
      </div>
    )
  }

  return (
    <div className="mistakes-home lesson" data-testid="lesson">
      {back}
      <section className="card lesson-card">
        <h1 className="lesson-title-h">{lesson.title}</h1>
        <p>{lesson.intro}</p>
        <h2 className="card-title">How to spot it</h2>
        <ul className="lesson-points">
          {lesson.spot.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <h2 className="card-title">Before every move, ask</h2>
        <ol className="lesson-points">
          {lesson.checklist.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      {example && board && (
        <section className="card lesson-example" aria-label="From your games" data-testid="lesson-example">
          <h2 className="card-title">From your games</h2>
          <CoachBubble
            message={{
              id: 'lesson-example',
              tone: 'mistake',
              title: `You played ${example.playedSan} here`,
              text: `${example.note}${example.bestSan && !example.note.includes(example.bestSan) ? ` The best move was ${example.bestSan}.` : ''}`,
            }}
          />
          <div className="lesson-board">
            <GameBoard
              boardId="lesson-board"
              game={board}
              orientation={board.turn() === 'w' ? 'white' : 'black'}
              userColor={board.turn()}
              canMove={false}
              onMove={() => false}
              arrow={
                showBest && example.bestUci
                  ? { from: example.bestUci.slice(0, 2) as Square, to: example.bestUci.slice(2, 4) as Square, color: 'rgba(76, 175, 80, 0.85)' }
                  : null
              }
            />
          </div>
          <p className="muted small">
            vs {example.opponent}, {formatDate(example.gameDate)}
          </p>
          <div className="puzzle-actions">
            {example.bestUci && (
              <button type="button" className={showBest ? 'active' : ''} aria-pressed={showBest} onClick={() => setShowBest((b) => !b)}>
                {showBest ? 'Hide the best move' : 'Show the best move'}
              </button>
            )}
            <a className="button-link" href={routeHref({ name: 'review', id: example.gameId })}>
              Open the game
            </a>
          </div>
        </section>
      )}

      <section className="card lesson-practise" aria-label="Practise" data-testid="lesson-practise">
        <h2 className="card-title">Practise</h2>
        {typeof mode === 'object' ? (
          <p className="session-score" data-testid="lesson-score">
            <CheckIcon /> {mode.solved} of {mode.total} solved first time.
          </p>
        ) : (
          <p>
            {LESSON_SET} puzzles on {lesson.themes.map((t) => THEME_LABEL[t]?.toLowerCase() ?? t).join(', ')}, near your puzzle
            rating.
          </p>
        )}
        <p className="muted small">{progressText(records?.[category])}</p>
        <button
          type="button"
          className="primary wide"
          disabled={!puzzles || !data}
          onClick={() => {
            setRound((r) => r + 1)
            setMode('practise')
          }}
          data-testid="lesson-start"
        >
          {typeof mode === 'object' ? 'Another set' : `Start ${LESSON_SET} puzzles`}
        </button>
        {yourPattern && (
          <a className="button-link wide" href={href(MISTAKE_PATTERN_PREFIX + yourPattern.pattern)}>
            Your own positions: {yourPattern.label.toLowerCase()}
          </a>
        )}
      </section>
    </div>
  )
}
