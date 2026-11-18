import { useRef, useState } from 'react'
import { routeHref } from '../../app/route'
import { fetchLichessGames, LichessError } from '../../lichess/importGames'
import { downloadText, exportAllPgn, exportBackup, importBackup } from '../../storage/backup'
import { saveGames } from '../../storage/games'
import { formatDate, OUTCOME_WORD, opponentOf, outcomeOf, ratingCounts } from '../../storage/gameInfo'
import type { GameRecord } from '../../storage/types'
import { useGames } from '../../storage/useGames'
import { CpuIcon } from '../../ui/icons'
import { RatingBadge } from '../play/RatingBadge'

type Filter = 'all' | 'bot' | 'lichess'

export function GamesScreen() {
  const games = useGames()
  const [filter, setFilter] = useState<Filter>('all')
  const shown = (games ?? []).filter((g) => filter === 'all' || g.source === filter)

  return (
    <div className="games-screen">
      <div className="games-main">
        <div className="games-head">
          <h1>Your games</h1>
          <div className="filter-chips" role="tablist" aria-label="Show">
            {(['all', 'bot', 'lichess'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                className={`chip ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'bot' ? 'vs Bot' : 'Lichess'}
              </button>
            ))}
          </div>
        </div>

        {games === null ? (
          <p className="muted">Loading…</p>
        ) : shown.length === 0 ? (
          <div className="card empty-state">
            <p>
              <strong>No games yet.</strong>
            </p>
            <p className="muted">
              Finish a game against the bot, or import your games from Lichess, and they'll appear here for review.
            </p>
            <a className="button-link primary" href="#/">
              Play the bot
            </a>
          </div>
        ) : (
          <ul className="game-list" data-testid="game-list">
            {shown.map((g) => (
              <GameRow key={g.id} game={g} />
            ))}
          </ul>
        )}
      </div>

      <aside className="side-area">
        <LichessImport />
        <BackupCard />
      </aside>
    </div>
  )
}

function GameRow({ game }: { game: GameRecord }) {
  const outcome = outcomeOf(game)
  const opp = opponentOf(game)
  const counts = ratingCounts(game)
  const reviewed = game.review?.complete
  return (
    <li>
      <a className="game-row card" href={routeHref({ name: 'review', id: game.id })}>
        <span className={`result-pill result-${outcome}`}>{OUTCOME_WORD[outcome]}</span>
        <span className="game-row-main">
          <span className="game-row-title">
            {game.source === 'bot' ? <CpuIcon width={16} height={16} /> : <span className="lichess-mark">L</span>}
            vs {opp.name}
            {opp.rating ? <span className="muted"> ({opp.rating})</span> : null}
          </span>
          <span className="game-row-meta muted">
            {[
              formatDate(game.endedAt),
              game.speed,
              `${Math.ceil(game.moves.length / 2)} move${Math.ceil(game.moves.length / 2) === 1 ? '' : 's'}`,
              game.opening,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className="game-row-stats">
          {reviewed && game.review?.accuracy != null ? (
            <>
              <span className="game-row-acc">{Math.round(game.review.accuracy)}%</span>
              <span className="game-row-badges">
                {(['mistake', 'blunder'] as const).map((r) =>
                  counts[r] ? (
                    <span key={r} className="mini-count">
                      <RatingBadge rating={r} size="sm" />
                      {counts[r]}
                    </span>
                  ) : null,
                )}
              </span>
            </>
          ) : (
            <span className="muted small">Not reviewed yet</span>
          )}
        </span>
      </a>
    </li>
  )
}

const USER_KEY = 'chess-guru:lichess-user'

function LichessImport() {
  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem(USER_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [max, setMax] = useState(20)
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; text?: string }>({ kind: 'idle' })

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setState({ kind: 'busy' })
    try {
      localStorage.setItem(USER_KEY, username.trim())
    } catch {
      // Remembering the name is only a convenience.
    }
    try {
      const { games } = await fetchLichessGames(username, max)
      const added = await saveGames(games)
      const already = games.length - added
      setState({
        kind: 'done',
        text:
          games.length === 0
            ? 'No finished standard games found.'
            : `Imported ${added} new game${added === 1 ? '' : 's'}${already ? ` (${already} already here)` : ''}. Open one to review it.`,
      })
    } catch (err) {
      setState({ kind: 'error', text: err instanceof LichessError ? err.message : 'Something went wrong. Try again.' })
    }
  }

  return (
    <section className="card import-card" aria-label="Import from Lichess">
      <h2 className="card-title">Import from Lichess</h2>
      <form onSubmit={run} className="import-form">
        <input
          type="text"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Lichess username"
          aria-label="Lichess username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <select aria-label="How many games" value={max} onChange={(e) => setMax(Number(e.target.value))}>
          <option value={10}>Last 10</option>
          <option value={20}>Last 20</option>
          <option value={50}>Last 50</option>
        </select>
        <button type="submit" className="primary" disabled={state.kind === 'busy' || !username.trim()}>
          {state.kind === 'busy' ? 'Importing…' : 'Import'}
        </button>
      </form>
      {state.text && (
        <p className={`import-status ${state.kind}`} role="status">
          {state.text}
        </p>
      )}
      <p className="muted small">
        Only finished games are imported, for review afterwards. Chess Guru never helps during a live game.
      </p>
    </section>
  )
}

function BackupCard() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const stamp = () => new Date().toISOString().slice(0, 10)

  async function restore(file: File) {
    try {
      const { restored, skipped } = await importBackup(await file.text())
      setMessage(`Restored ${restored} game${restored === 1 ? '' : 's'}${skipped ? `, skipped ${skipped}` : ''}.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }

  return (
    <section className="card backup-card" aria-label="Backup">
      <h2 className="card-title">Backup</h2>
      <p className="muted small">
        Games are stored only in this browser. Browsers (especially Safari on iPhone) can clear them, so keep a backup.
      </p>
      <div className="backup-buttons">
        <button type="button" onClick={async () => downloadText(`chess-guru-backup-${stamp()}.json`, await exportBackup(), 'application/json')}>
          Download backup
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}>
          Restore backup
        </button>
        <button type="button" onClick={async () => downloadText(`chess-guru-games-${stamp()}.pgn`, await exportAllPgn(), 'application/x-chess-pgn')}>
          All games as PGN
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void restore(f)
          e.target.value = ''
        }}
      />
      {message && (
        <p className="import-status done" role="status">
          {message}
        </p>
      )}
    </section>
  )
}
