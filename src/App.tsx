import { useEffect } from 'react'
import { routeHref, useRoute, type Route } from './app/route'
import { GamesScreen } from './features/games/GamesScreen'
import { PlayScreen } from './features/play/PlayScreen'
import { ProgressScreen } from './features/progress/ProgressScreen'
import { TrainScreen } from './features/train/TrainScreen'
import { ReviewScreen } from './features/review/ReviewScreen'
import { BoardIcon, ChartIcon, ListIcon, TargetIcon } from './ui/icons'
import { UpdateBanner } from './features/settings/UpdateBanner'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { KnightMark } from './ui/KnightMark'
import { NewGamesBanner } from './features/games/NewGamesBanner'
import { GoalMessage } from './features/goal/GoalMessage'
import { BackgroundReviewer } from './features/review/BackgroundReviewer'
import { useAutoLichessCheck } from './lichess/autoSync'
import { queueReviewUpgrades } from './review/upgrades'
import { WeeklyReportPage } from './features/report/WeeklyReportPage'
import { OpeningReportPage } from './features/openingReport/OpeningReportPage'
import { useLastWeekReport } from './report/reportStore'

const TABS: { route: Route; label: string; icon: typeof BoardIcon }[] = [
  { route: { name: 'play' }, label: 'Play', icon: BoardIcon },
  { route: { name: 'games' }, label: 'Games', icon: ListIcon },
  { route: { name: 'progress' }, label: 'Progress', icon: ChartIcon },
  { route: { name: 'train' }, label: 'Train', icon: TargetIcon },
]

export default function App() {
  const route = useRoute()
  useAutoLichessCheck()
  useEffect(() => {
    void queueReviewUpgrades()
  }, [])
  const tab = route.name === 'review' ? 'games' : route.name === 'report' || route.name === 'openings' ? 'progress' : route.name
  const reportIsNew = useLastWeekReport()?.isNew ?? false

  return (
    <div className={`app route-${route.name}`}>
      <header className="app-header">
        <a className="brand" href="#/">
          <span className="brand-mark" aria-hidden>
            <KnightMark size={24} />
          </span>
          <span className="brand-name">
            Chess <span>Guru</span>
          </span>
        </a>
        {/* Top tabs on wide screens, a bottom tab bar on phones (same element, styled by CSS). */}
        <nav className="tabs" aria-label="Sections">
          {TABS.map(({ route: r, label, icon: Icon }) => (
            <a key={label} href={routeHref(r)} aria-current={tab === r.name ? 'page' : undefined}>
              <Icon className="tab-icon" />
              <span>{label}</span>
              {r.name === 'progress' && reportIsNew && <span className="tab-dot" aria-label="New weekly report" data-testid="report-dot" />}
            </a>
          ))}
        </nav>
      </header>
      <UpdateBanner />
      <main>
        {route.name !== 'play' && <NewGamesBanner onGamesPage={route.name === 'games'} />}
        <GoalMessage />
        {/* Paused during a game and on the review screen, which use the engine themselves. */}
        <BackgroundReviewer paused={route.name === 'play' || route.name === 'review'} />
        {/* The play screen stays mounted so a game in progress survives visiting other pages. */}
        <div hidden={route.name !== 'play'}>
          <ErrorBoundary>
            <PlayScreen />
          </ErrorBoundary>
        </div>
        {route.name !== 'play' && (
          <ErrorBoundary key={route.name === 'review' ? `review:${route.id}` : route.name}>
            {route.name === 'games' && <GamesScreen />}
            {route.name === 'review' && <ReviewScreen id={route.id} />}
            {route.name === 'progress' && <ProgressScreen />}
            {route.name === 'report' && <WeeklyReportPage weekKey={route.week} />}
            {route.name === 'openings' && <OpeningReportPage />}
            {route.name === 'train' && <TrainScreen page={route.theme} />}
          </ErrorBoundary>
        )}
      </main>
    </div>
  )
}
