import { routeHref, useRoute, type Route } from './app/route'
import { GamesScreen } from './features/games/GamesScreen'
import { PlayScreen } from './features/play/PlayScreen'
import { ProgressScreen } from './features/progress/ProgressScreen'
import { PuzzlesScreen } from './features/puzzles/PuzzlesScreen'
import { ReviewScreen } from './features/review/ReviewScreen'
import { BoardIcon, ChartIcon, ListIcon, TargetIcon } from './ui/icons'
import { UpdateBanner } from './features/settings/UpdateBanner'

const TABS: { route: Route; label: string; icon: typeof BoardIcon }[] = [
  { route: { name: 'play' }, label: 'Play', icon: BoardIcon },
  { route: { name: 'games' }, label: 'Games', icon: ListIcon },
  { route: { name: 'progress' }, label: 'Progress', icon: ChartIcon },
  { route: { name: 'puzzles' }, label: 'Puzzles', icon: TargetIcon },
]

export default function App() {
  const route = useRoute()
  const tab = route.name === 'review' ? 'games' : route.name

  return (
    <div className={`app route-${route.name}`}>
      <header className="app-header">
        <a className="brand" href="#/">
          <span className="brand-mark" aria-hidden>
            ♞
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
            </a>
          ))}
        </nav>
      </header>
      <UpdateBanner />
      <main>
        {/* The play screen stays mounted so a game in progress survives visiting other pages. */}
        <div hidden={route.name !== 'play'}>
          <PlayScreen />
        </div>
        {route.name === 'games' && <GamesScreen />}
        {route.name === 'review' && <ReviewScreen id={route.id} />}
        {route.name === 'progress' && <ProgressScreen />}
        {route.name === 'puzzles' && <PuzzlesScreen theme={route.theme} />}
      </main>
    </div>
  )
}
