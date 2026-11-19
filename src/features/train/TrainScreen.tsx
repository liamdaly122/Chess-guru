import type { ReactNode } from 'react'
import { routeHref } from '../../app/route'
import { isLessonCategory, LESSONS } from '../../lessons/lessons'
import type { LessonCategory } from '../../review/types'
import { useOpeningDrills } from '../../storage/openingStore'
import { useMistakePuzzles } from '../../storage/useMistakePuzzles'
import { LessonPage, LessonsPage } from '../lessons/LessonPage'
import { OpeningLines } from '../openings/OpeningLines'
import { OpeningTrainer } from '../openings/OpeningTrainer'
import { EndgamesPage } from '../practice/EndgamesPage'
import { PracticePage } from '../practice/PracticeList'
import { MistakesPage } from '../puzzles/MistakeTrainer'
import { PuzzleRatingChip, PuzzlesPage } from '../puzzles/PuzzlesScreen'
import { TrainHome } from './TrainHome'
import { VisionList, VisionSession } from '../vision/VisionPage'
import { drillTitle, VISION_TYPES } from '../../vision/drills'
import type { VisionDrill } from '../../vision/visionStore'
import {
  ENDGAMES,
  isMistakesRoute,
  LESSON_PREFIX,
  LESSONS_ROUTE,
  MISTAKES,
  mistakesTitle,
  OPENING_LINES,
  OPENINGS,
  PLAY_IT_OUT_PAGE,
  VISION,
  VISION_PREFIX,
} from './trainRoutes'

const TRAIN = { label: 'Train', href: routeHref({ name: 'train' }) }
const href = (page: string) => routeHref({ name: 'train', theme: page })

/** Train: the home page, or one of its pages (`page` is the part of the route after #/train/). */
export function TrainScreen({ page }: { page?: string }) {
  if (!page) return <TrainHome />
  if (isMistakesRoute(page)) return <MistakesRoute page={page} />
  if (page === LESSONS_ROUTE) {
    return (
      <TrainPage title="Lessons" back={TRAIN}>
        <LessonsPage />
      </TrainPage>
    )
  }
  const lesson = page.startsWith(LESSON_PREFIX) ? page.slice(LESSON_PREFIX.length) : ''
  if (isLessonCategory(lesson)) return <LessonRoute category={lesson} />
  if (page === PLAY_IT_OUT_PAGE) {
    return (
      <TrainPage title="Play it out" back={TRAIN}>
        <PracticePage />
      </TrainPage>
    )
  }
  if (page === ENDGAMES) {
    return (
      <TrainPage title="Endgames" back={TRAIN}>
        <EndgamesPage />
      </TrainPage>
    )
  }
  if (page === OPENINGS || page === OPENING_LINES) return <OpeningsRoute page={page} />
  if (page === VISION) {
    return (
      <TrainPage title="Board vision" back={TRAIN}>
        <VisionList />
      </TrainPage>
    )
  }
  const drill = page.startsWith(VISION_PREFIX) ? page.slice(VISION_PREFIX.length) : ''
  if (drill === 'mixed' || (VISION_TYPES as string[]).includes(drill)) {
    return (
      <TrainPage title={drillTitle(drill as VisionDrill)} back={{ label: 'Board vision', href: href(VISION) }}>
        <VisionSession key={drill} drill={drill as VisionDrill} />
      </TrainPage>
    )
  }
  return (
    <TrainPage title="Puzzles" back={TRAIN} right={<PuzzleRatingChip />}>
      <PuzzlesPage theme={page} />
    </TrainPage>
  )
}

/** A Train page: a back link, the title (with anything to its right) and the content. */
function TrainPage({ title, back, right, children }: { title: string; back: { label: string; href: string }; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="puzzles-screen train-page">
      <a className="back-link small train-back" href={back.href} data-testid="train-back">
        ← {back.label}
      </a>
      <div className="games-head">
        <h1>{title}</h1>
        {right}
      </div>
      {children}
    </div>
  )
}

function MistakesRoute({ page }: { page: string }) {
  const mistakes = useMistakePuzzles()
  return (
    <TrainPage title={mistakesTitle(page)} back={page === MISTAKES ? TRAIN : { label: 'Your mistakes', href: href(MISTAKES) }}>
      {mistakes ? <MistakesPage puzzles={mistakes} theme={page} /> : <p className="muted">Loading…</p>}
    </TrainPage>
  )
}

function LessonRoute({ category }: { category: LessonCategory }) {
  const mistakes = useMistakePuzzles()
  return (
    <TrainPage title={LESSONS[category].title} back={{ label: 'Lessons', href: href(LESSONS_ROUTE) }}>
      {mistakes ? <LessonPage key={category} category={category} mistakes={mistakes} /> : <p className="muted">Loading…</p>}
    </TrainPage>
  )
}

function OpeningsRoute({ page }: { page: string }) {
  const drills = useOpeningDrills()
  // With no lines yet, the Openings page is the list to pick from.
  const lines = page === OPENING_LINES || drills?.length === 0
  const nested = page === OPENING_LINES && !!drills && drills.length > 0
  return (
    <TrainPage
      title={nested ? 'Your opening lines' : 'Openings'}
      back={nested ? { label: 'Openings', href: href(OPENINGS) } : TRAIN}
      right={
        <a className="small" href={routeHref({ name: 'openings' })} data-testid="opening-report-link">
          Your opening report
        </a>
      }
    >
      {!drills ? <p className="muted">Loading…</p> : lines ? <OpeningLines drills={drills} /> : <OpeningTrainer drills={drills} />}
    </TrainPage>
  )
}
