import { routeHref, useRoute } from './app/route'
import { GamesScreen } from './features/games/GamesScreen'
import { PlayScreen } from './features/play/PlayScreen'
import { ReviewScreen } from './features/review/ReviewScreen'

export default function App() {
  const route = useRoute()
  const tab = route.name === 'review' ? 'games' : route.name

  return (
    <div className="app">
      <header className="app-header">
        <a className="brand" href="#/">
          <span className="brand-mark" aria-hidden>
            ♞
          </span>
          <span className="brand-name">
            Chess <span>Guru</span>
          </span>
        </a>
        <nav className="tabs" aria-label="Sections">
          <a href={routeHref({ name: 'play' })} aria-current={tab === 'play' ? 'page' : undefined}>
            Play
          </a>
          <a href={routeHref({ name: 'games' })} aria-current={tab === 'games' ? 'page' : undefined}>
            Games
          </a>
        </nav>
      </header>
      <main>
        {/* The play screen stays mounted so a game in progress survives visiting other pages. */}
        <div hidden={route.name !== 'play'}>
          <PlayScreen />
        </div>
        {route.name === 'games' && <GamesScreen />}
        {route.name === 'review' && <ReviewScreen id={route.id} />}
      </main>
    </div>
  )
}
