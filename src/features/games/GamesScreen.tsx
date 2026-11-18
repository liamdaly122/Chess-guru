import { useEffect, useRef, useState } from 'react'
import { routeHref } from '../../app/route'
import { checkForNewGames, queueUnreviewed, updateSync, useLichessSync, type LichessSync } from '../../lichess/autoSync'
import { fetchLichessGames, LichessError, USERNAME_PATTERN } from '../../lichess/importGames'
import { LICHESS_SYNC } from '../../config/lichess'
import { Switch } from '../../ui/Switch'
import { backUpToFile, downloadText, exportAllPgn, getLastBackupAt, importBackup } from '../../storage/backup'
import { puzzlesChanged } from '../../storage/puzzleStore'
import { saveGames } from '../../storage/games'
import { formatDate, OUTCOME_WORD, opponentOf, outcomeOf, ratingCounts } from '../../storage/gameInfo'
import type { GameRecord } from '../../storage/types'
import { useGames } from '../../storage/useGames'
import { CpuIcon } from '../../ui/icons'
import { groupGames, type GameGroup } from './gameGroups'
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
          <div className="game-groups" data-testid="game-list">
            {groupGames(shown).map((group, i) => (
              <GameGroupSection key={`${filter}:${group.label}`} group={group} startOpen={i === 0} />
            ))}
          </div>
        )}
      </div>

      <aside className="side-area">
        <LichessImport />
        <BackupCard gameCount={games?.length ?? 0} />
      </aside>
    </div>
  )
}

const GROUP_PAGE = 10

/** One collapsible group of games, showing 10 at a time. */
function GameGroupSection({ group, startOpen }: { group: GameGroup; startOpen: boolean }) {
  const [limit, setLimit] = useState(GROUP_PAGE)
  const record = [
    group.won ? `${group.won} won` : '',
    group.lost ? `${group.lost} lost` : '',
    group.drawn ? `${group.drawn} drawn` : '',
  ]
    .filter(Boolean)
    .join(', ')
  return (
    <details className="game-group" open={startOpen}>
      <summary>
        <span className="game-group-label">{group.label}</span>
        <span className="muted small">
          {group.games.length} game{group.games.length === 1 ? '' : 's'}
          {record ? ` · ${record}` : ''}
        </span>
      </summary>
      <ul className="game-list">
        {group.games.slice(0, limit).map((g) => (
          <GameRow key={g.id} game={g} />
        ))}
      </ul>
      {group.games.length > limit && (
        <button type="button" className="link-button show-more" onClick={() => setLimit((l) => l + GROUP_PAGE)}>
          Show {Math.min(GROUP_PAGE, group.games.length - limit)} more
        </button>
      )}
    </details>
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
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {game.opening && <span className="game-row-opening muted">{game.opening}</span>}
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
      <AutoImport username={username} />
      <p className="muted small">
        Only finished games are imported, for review afterwards. Chess Guru never helps during a live game.
      </p>
    </section>
  )
}

/** "just now", "5 minutes ago", "3 hours ago", "2 days ago" */
function agoText(at: number, now: number): string {
  const min = Math.floor((now - at) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

function statusText(s: LichessSync, now: number): string {
  if (!s.lastCheckAt) return 'Not checked yet.'
  const when = `Last checked ${agoText(s.lastCheckAt, now)}`
  if (s.lastError) return `${when}: ${s.lastError}`
  return `${when}: ${s.lastAdded ? `${s.lastAdded} new game${s.lastAdded === 1 ? '' : 's'}` : 'no new games'}.`
}

/** Switches for the automatic import and review, with the last check's result. */
function AutoImport({ username }: { username: string }) {
  const sync = useLichessSync()
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [problem, setProblem] = useState<string | null>(null)
  if (sync === undefined) return null
  const on = !!sync?.auto

  async function checkNow() {
    setBusy(true)
    await checkForNewGames({ force: true })
    setNow(Date.now())
    setBusy(false)
  }

  async function toggleAuto(checked: boolean) {
    setProblem(null)
    if (!checked) {
      await updateSync({ auto: false, autoReview: false })
      return
    }
    const name = username.trim() || sync?.username || ''
    if (!USERNAME_PATTERN.test(name)) {
      setProblem('Enter your Lichess username above first.')
      return
    }
    await updateSync({ username: name, auto: true })
    await checkNow()
  }

  return (
    <div className="auto-import" data-testid="auto-import">
      <Switch
        label="Check for new games automatically"
        description={
          on
            ? `New finished games for ${sync?.username} are imported when you open Chess Guru (at most every ${LICHESS_SYNC.minMinutesBetweenChecks} minutes).`
            : 'Remember your username and import new finished games each time you open Chess Guru.'
        }
        checked={on}
        onChange={(c) => void toggleAuto(c)}
      />
      {problem && <p className="import-status error">{problem}</p>}
      {on && sync && (
        <>
          <Switch
            label="Review them automatically"
            description={`Unreviewed Lichess games are reviewed while you use the app, newest first (up to ${LICHESS_SYNC.maxAutoReviews} at a time). Reviews pause while you play or look at a review.`}
            checked={sync.autoReview}
            onChange={(c) => {
              void updateSync({ autoReview: c }).then(() => {
                if (c) void queueUnreviewed()
              })
            }}
          />
          <p className="muted small auto-status" data-testid="auto-status">
            {busy ? 'Checking Lichess…' : statusText(sync, now)}{' '}
            {!busy && (
              <button type="button" className="link-button" onClick={() => void checkNow()}>
                Check now
              </button>
            )}
          </p>
        </>
      )}
    </div>
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
      const { restored, skipped, puzzles, openings } = await importBackup(await file.text())
      setMessage(
        `Restored ${restored} game${restored === 1 ? '' : 's'}` +
          (puzzles ? `, ${puzzles} puzzle record${puzzles === 1 ? '' : 's'}` : '') +
          (openings ? `, ${openings} opening line${openings === 1 ? '' : 's'}` : '') +
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
        Your games and puzzle progress live only on this device. Keep a backup in iCloud Drive in case the app is
        deleted or the phone is replaced.
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
      <button type="button" className="primary wide" onClick={() => void backUp()}>
        Back up to Files / iCloud
      </button>
      <div className="backup-secondary">
        <button type="button" onClick={() => fileRef.current?.click()}>
          Restore
        </button>
        <button type="button" onClick={async () => downloadText(`chess-guru-games-${stamp()}.pgn`, await exportAllPgn(), 'application/x-chess-pgn')}>
          Games as PGN
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
