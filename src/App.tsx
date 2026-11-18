import { PlayScreen } from './features/play/PlayScreen'

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Chess Guru</h1>
      </header>
      <main>
        <PlayScreen />
      </main>
    </div>
  )
}
