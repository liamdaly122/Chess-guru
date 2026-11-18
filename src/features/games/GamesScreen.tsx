import { useEffect, useRef, useState } from 'react'
import { routeHref } from '../../app/route'
import { fetchLichessGames, LichessError } from '../../lichess/importGames'
import { backUpToFile, downloadText, exportAllPgn, getLastBackupAt, importBackup } from '../../storage/backup'
import { puzzlesChanged } from '../../storage/puzzleStore'
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
        <BackupCard gameCount={games?.length ?? 0} />
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

function BackupCard({ gameCount }: { gameCount: number }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const { at: lastBackupAt, daysSince } = useLastBackup()
  const stamp = () => new Date().toISOString().slice(0, 10)
  const overdue = gameCount > 0 && (daysSince == null || daysSince >= BACKUP_REMINDER_DAYS)

  async function backUp() {
    try {
      const how = await backUpToFile()
      if (how === 'shared') setMessage('Backup saved. On iPhone choose "Save to Files", then iCloud Drive.')
      else if (how === 'downloaded') setMessage('Backup downloaded. Keep it somewhere safe, such as iCloud Drive or Google Drive.')
    } catch {
      setMessage('Could not make the backup. Try again.')
    }
  }

  async function restore(file: File) {
    try {
      const { restored, skipped, puzzles } = await importBackup(await file.text())
      setMessage(
        `Restored ${restored} game${restored === 1 ? '' : 's'}` +
          (puzzles ? ` and ${puzzles} puzzle record${puzzles === 1 ? '' : 's'}` : '') +
          (skipped ? `, skipped ${skipped}` : '') +
          '.',
      )
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }

  return (
    <section className={`card backup-card ${overdue ? 'overdue' : ''}`} aria-label="Backup" data-testid="backup-card">
      <h2 className="card-title">Backup</h2>
      <p className="muted small">
        Your games and puzzle progress are stored only on this device. Deleting the app or clearing website data
        removes them, so keep a backup in iCloud Drive (or Google Drive).
      </p>
      <p className={`backup-status ${overdue ? 'warn' : ''}`} data-testid="backup-status">
        {lastBackupAt == null
          ? gameCount > 0
            ? 'No backup yet.'
            : 'No backup yet. Back up once you have some games.'
          : daysSince === 0
            ? 'Last backup: today.'
            : `Last backup: ${daysSince} day${daysSince === 1 ? '' : 's'} ago.`}
        {overdue && lastBackupAt != null && ' Time for a new one.'}
      </p>
      <div className="backup-buttons">
        <button type="button" className={overdue ? 'primary' : ''} onClick={() => void backUp()}>
          Back up to Files / iCloud
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

/** Remind the user to back up after this many days. */
const BACKUP_REMINDER_DAYS = 7

/** When the last backup was made, and how many whole days ago (worked out when loaded). */
function useLastBackup(): { at: number | null; daysSince: number | null } {
  const [state, setState] = useState<{ at: number | null; daysSince: number | null }>({ at: null, daysSince: null })
  useEffect(() => {
    let live = true
    const load = () =>
      getLastBackupAt().then(
        (at) => live && setState({ at, daysSince: at == null ? null : Math.floor((Date.now() - at) / 86_400_000) }),
      )
    void load()
    puzzlesChanged.addEventListener('change', load)
    return () => {
      live = false
      puzzlesChanged.removeEventListener('change', load)
    }
  }, [])
  return state
}
