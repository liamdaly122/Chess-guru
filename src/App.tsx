import { PlayScreen } from './features/play/PlayScreen'

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <span className="brand-mark" aria-hidden>
          ♞
        </span>
        <span className="brand-name">
          Chess <span>Guru</span>
        </span>
      </header>
      <main>
        <PlayScreen />
      </main>
    </div>
  )
}
