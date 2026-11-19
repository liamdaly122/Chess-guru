import { useMemo, useState, type ReactNode } from 'react'
import { routeHref } from '../../app/route'
import { dayKey } from '../../goal/streak'
import { lessonCounts, lessonsByNeed, LESSONS } from '../../lessons/lessons'
import { useLessonRecords } from '../../lessons/lessonStore'
import { drillStats } from '../../openings/drill'
import { ENDGAME_DRILLS, drillRecordId } from '../../practice/endgames'
import { practicePositions } from '../../practice/positions'
import { usePracticeRecords } from '../../practice/practiceStore'
import { todaysSet } from '../../puzzles/mistakes'
import { puzzleStartRating, ratingSummary } from '../../rating/estimate'
import { useOpeningDrills } from '../../storage/openingStore'
import { useGames } from '../../storage/useGames'
import { useMistakePuzzles } from '../../storage/useMistakePuzzles'
import { usePuzzleData } from '../../storage/usePuzzleData'
import { trainPlan, type PlanItem } from '../../train/plan'
import { BookIcon, CapIcon, CheckIcon, ChevronIcon, CrownIcon, EyeIcon, FlagIcon, PuzzleIcon, RetryIcon } from '../../ui/icons'
import { formatTime, useVisionRecords } from '../../vision/visionStore'
import { VISION_SET } from '../../vision/drills'
import { GoalLine } from '../goal/GoalCard'
import {
  ENDGAMES,
  LESSON_PREFIX,
  LESSONS_ROUTE,
  MISTAKES,
  MISTAKES_TODAY,
  OPENINGS,
  PLAY_IT_OUT_PAGE,
  PUZZLES,
  VISION,
} from './trainRoutes'

const href = (page: string) => routeHref({ name: 'train', theme: page })
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * The Train home: today's plan at the top, then every trainer in two groups: what comes from
 * your own games, and general practice. Each opens its own page with a back link here.
 */
export function TrainHome() {
  const [now] = useState(() => Date.now())
  const games = useGames()
  const mistakes = useMistakePuzzles()
  const drills = useOpeningDrills()
  const data = usePuzzleData()
  const lessonRecords = useLessonRecords()
  const practiceRecords = usePracticeRecords()
  const visionRecords = useVisionRecords()
  const visionBest = visionRecords
    ? Object.values(visionRecords).sort((a, b) => b.best - a.best || a.bestMs - b.bestMs)[0]
    : undefined

  const today = mistakes ? todaysSet(mistakes, now) : null
  const openings = drills ? drillStats(drills, now) : null
  const openingsDue = openings ? openings.due + openings.fresh : 0
  const lessonOrder = useMemo(() => {
    if (!games) return null
    const counts = lessonCounts(games)
    return lessonsByNeed(games).filter((c) => counts[c].times > 0)
  }, [games])
  const positions = useMemo(() => (games ? practicePositions(games, ratingSummary(games).estimate?.rating) : null), [games])
  const estimate = useMemo(() => (games ? ratingSummary(games).estimate : null), [games])
  const rating = data ? puzzleStartRating(data.rating, data.attempts.length, estimate) : null
  const puzzlesToday = data ? data.attempts.filter((a) => dayKey(a.at) === dayKey(now)).length : 0
  const untried = positions && practiceRecords ? positions.filter((p) => !practiceRecords[p.id]).length : 0
  const endgamesDone = practiceRecords ? ENDGAME_DRILLS.filter((d) => practiceRecords[drillRecordId(d.id)]?.successes).length : 0

  const loading = !games || !mistakes || !drills || !data || !lessonRecords || !practiceRecords
  const plan = loading
    ? []
    : trainPlan({
        now,
        mistakes: today ? { left: today.queue.length, doneToday: today.doneToday } : null,
        openings: drills.length ? { due: openingsDue, lastAt: Math.max(0, ...drills.map((d) => d.lastAt ?? 0)) || null } : null,
        lessons: (lessonOrder ?? []).map((c) => ({ category: c, lastAt: lessonRecords[c]?.lastAt ?? null })),
        puzzlesToday,
        pages: { mistakes: MISTAKES_TODAY, openings: OPENINGS, lesson: (c) => LESSON_PREFIX + c, puzzles: PUZZLES },
      })
  const next = plan.find((p) => !p.done)

  return (
    <div className="puzzles-screen train-home-page">
      <div className="games-head">
        <h1>Train</h1>
      </div>
      <GoalLine />
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="train-home">
          <section className="card plan-card" aria-label="Today" data-testid="train-plan">
            <h2 className="card-title">Today</h2>
            <ul className="train-list">
              {plan.map((item) => (
                <PlanRow key={item.id} item={item} />
              ))}
            </ul>
            {next ? (
              <a className="button-link primary wide" href={href(next.page)} data-testid="plan-next">
                Start: {next.id === 'lesson' ? 'the lesson' : next.title.toLowerCase()}
              </a>
            ) : (
              <p className="plan-done" data-testid="plan-done">
                <CheckIcon /> All done for today. Nice work.
              </p>
            )}
          </section>

          <section className="card" aria-label="From your games">
            <h2 className="card-title">From your games</h2>
            <ul className="train-list">
              <TrainRow
                page={MISTAKES}
                icon={<RetryIcon />}
                title="Your mistakes"
                detail={
                  mistakes.length === 0
                    ? 'Positions from your reviewed games appear here'
                    : today && today.queue.length > 0
                      ? `${plural(today.queue.length, 'position')} to solve today`
                      : 'Done for today'
                }
                count={today?.queue.length ?? 0}
                testId="tile-mistakes"
              />
              <TrainRow
                page={LESSONS_ROUTE}
                icon={<CapIcon />}
                title="Lessons"
                detail={lessonOrder?.[0] ? `Start with: ${LESSONS[lessonOrder[0]].title.toLowerCase()}` : 'Short lessons on each kind of mistake'}
                testId="tile-lessons"
              />
              <TrainRow
                page={PLAY_IT_OUT_PAGE}
                icon={<FlagIcon />}
                title="Play it out"
                detail={
                  !positions || positions.length === 0
                    ? 'Win the won positions from your games'
                    : untried > 0
                      ? `${plural(untried, 'position')} not tried yet`
                      : `${plural(positions.length, 'position')} to win or hold`
                }
                testId="tile-play-it-out"
              />
            </ul>
          </section>

          <section className="card" aria-label="Practice">
            <h2 className="card-title">Practice</h2>
            <ul className="train-list">
              <TrainRow
                page={PUZZLES}
                icon={<PuzzleIcon />}
                title="Puzzles"
                detail={`Rating ${rating ?? '–'}${puzzlesToday ? ` · ${puzzlesToday} today` : ''}`}
                testId="tile-puzzles"
              />
              <TrainRow
                page={OPENINGS}
                icon={<BookIcon />}
                title="Openings"
                detail={
                  !openings || openings.total === 0
                    ? 'Learn your openings by heart'
                    : openingsDue > 0
                      ? `${plural(openingsDue, 'line')} to practise · ${openings.mastered} mastered`
                      : `All caught up · ${openings.mastered} of ${openings.total} mastered`
                }
                count={openingsDue}
                testId="tile-openings"
              />
              <TrainRow
                page={VISION}
                icon={<EyeIcon />}
                title="Board vision"
                detail={
                  visionBest
                    ? `Best set: ${visionBest.best} of ${VISION_SET} in ${formatTime(visionBest.bestMs)}`
                    : 'Spot loose pieces and checks faster'
                }
                testId="tile-vision"
              />
              <TrainRow
                page={ENDGAMES}
                icon={<CrownIcon />}
                title="Endgames"
                detail={`${endgamesDone} of ${ENDGAME_DRILLS.length} drills done`}
                testId="tile-endgames"
              />
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}

function PlanRow({ item }: { item: PlanItem }) {
  return (
    <li className={`train-row plan-row ${item.done ? 'done' : ''}`} data-testid="plan-row" data-id={item.id} data-done={item.done}>
      <a href={href(item.page)}>
        <span className="plan-check" aria-label={item.done ? 'Done' : 'To do'}>
          {item.done && <CheckIcon width={16} height={16} />}
        </span>
        <span className="train-row-text">
          <span className="train-row-title">{item.title}</span>
          <span className="muted small">{item.detail}</span>
        </span>
        <ChevronIcon className="train-chevron" />
      </a>
    </li>
  )
}

function TrainRow(props: { page: string; icon: ReactNode; title: string; detail: string; count?: number; testId: string }) {
  return (
    <li className="train-row">
      <a href={href(props.page)} data-testid={props.testId}>
        <span className="train-icon">{props.icon}</span>
        <span className="train-row-text">
          <span className="train-row-title">{props.title}</span>
          <span className="muted small">{props.detail}</span>
        </span>
        {props.count ? <span className="count-pill">{props.count}</span> : null}
        <ChevronIcon className="train-chevron" />
      </a>
    </li>
  )
}
