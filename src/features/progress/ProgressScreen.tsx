import { useCallback, useMemo, useState } from 'react'
import { routeHref } from '../../app/route'
import { CATEGORY_THEMES, recommendedThemes, THEME_LABEL } from '../../puzzles/themes'
import { progressStats } from '../../progress/stats'
import { PHASE_LABEL } from '../../review/gamePhase'
import type { LessonCategory } from '../../review/types'
import { themeRecords } from '../../storage/puzzleStore'
import { usePuzzleData } from '../../storage/usePuzzleData'
import { useGames } from '../../storage/useGames'
import { useMistakePuzzles } from '../../storage/useMistakePuzzles'
import { mistakeStats } from '../../puzzles/mistakes'
import { AccuracyChart } from './AccuracyChart'
import { BatchReviewer } from './BatchReviewer'

type Filter = 'all' | 'bot' | 'lichess'

const CATEGORY_LABEL: Record<LessonCategory, string> = {
  'loose-pieces': 'Loose pieces',
  forks: 'Forks against you',
  'pins-skewers': 'Pins and skewers',
  threats: 'Missed threats',
  'king-safety': 'King safety',
  'missed-tactics': 'Missed tactics',
  'missed-mates': 'Missed mates',
  general: 'Other mistakes',
}

export function ProgressScreen() {
  const games = useGames()
  const puzzles = usePuzzleData()
  const mistakes = useMistakePuzzles()
  const [now] = useState(() => Date.now())
  const mistakeInfo = mistakes ? mistakeStats(mistakes, now) : null
  const [filter, setFilter] = useState<Filter>('all')
  const [batch, setBatch] = useState<string[] | null>(null)
  const finishBatch = useCallback(() => setBatch(null), [])

  const filtered = useMemo(() => (games ?? []).filter((g) => filter === 'all' || g.source === filter), [games, filter])
  const stats = useMemo(() => progressStats(filtered), [filtered])
  const unreviewed = filtered.filter((g) => !g.review?.complete)
  const themes = recommendedThemes(stats)

  if (games === null) return <p className="muted page-message">Loading…</p>

  const maxPerMove = Math.max(1, ...stats.phases.map((p) => p.perMove))
  const maxPattern = Math.max(1, ...stats.patterns.map((p) => p.winLost))
  const trend = stats.recentAccuracy != null && stats.avgAccuracy != null ? stats.recentAccuracy - stats.avgAccuracy : null

  return (
    <div className="progress-screen">
      <div className="games-head">
        <h1>Your progress</h1>
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

      <div className="stat-tiles" data-testid="stat-tiles">
        <div className="card tile">
          <span className="tile-label">Accuracy</span>
          <span className="tile-value">{stats.avgAccuracy == null ? '–' : `${Math.round(stats.avgAccuracy)}%`}</span>
          <span className="tile-sub muted">all reviewed games</span>
        </div>
        <div className="card tile">
          <span className="tile-label">Last 10 games</span>
          <span className="tile-value">{stats.recentAccuracy == null ? '–' : `${Math.round(stats.recentAccuracy)}%`}</span>
          <span className={`tile-sub ${trend == null ? 'muted' : trend >= 0 ? 'up' : 'down'}`}>
            {trend == null ? 'no games yet' : `${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend).toFixed(1)} vs your average`}
          </span>
        </div>
        <div className="card tile">
          <span className="tile-label">Record</span>
          <span className="tile-value">
            {stats.record.win}–{stats.record.loss}–{stats.record.draw}
          </span>
          <span className="tile-sub muted">won, lost, drawn</span>
        </div>
        <div className="card tile">
          <span className="tile-label">Puzzle rating</span>
          <span className="tile-value">{puzzles?.rating ?? '–'}</span>
          <span className="tile-sub muted">{puzzles ? `${puzzles.attempts.length} puzzles tried` : ''}</span>
        </div>
      </div>

      {unreviewed.length > 0 && (
        <section className="card unreviewed">
          {batch ? (
            <BatchReviewer ids={batch} onFinished={finishBatch} />
          ) : (
            <>
              <p>
                <strong>
                  {unreviewed.length} game{unreviewed.length === 1 ? ' is' : 's are'} not reviewed yet
                </strong>{' '}
                <span className="muted">and not counted below.</span>
              </p>
              <button type="button" className="primary" onClick={() => setBatch(unreviewed.map((g) => g.id))}>
                Review {unreviewed.length === 1 ? 'it' : 'them'} now
              </button>
            </>
          )}
        </section>
      )}

      <div className="progress-grid">
        <section className="card chart-card">
          <h2 className="card-title">Accuracy over time</h2>
          <AccuracyChart points={stats.accuracyTrend} />
        </section>

        <section className="card" aria-label="Losses by game phase" data-testid="phase-card">
          <h2 className="card-title">Where you lose points: game phase</h2>
          <p className="muted small">Average winning chances lost per move. Book moves don't count.</p>
          <ul className="bars">
            {stats.phases.map((p) => (
              <li key={p.phase} className={stats.weakestPhase === p.phase ? 'weakest' : ''}>
                <span className="bar-label">
                  {PHASE_LABEL[p.phase]}
                  {stats.weakestPhase === p.phase && <span className="flag">weakest</span>}
                </span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${(p.perMove / maxPerMove) * 100}%` }} />
                </span>
                <span className="bar-value">{p.moves ? `${p.perMove.toFixed(1)}%` : '–'}</span>
                <span className="bar-sub muted">
                  {plural(p.moves, 'move')} · {plural(p.mistakes, 'mistake')} · {plural(p.blunders, 'blunder')}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card" aria-label="Losses by kind of mistake" data-testid="pattern-card">
          <h2 className="card-title">Where you lose points: kind of mistake</h2>
          {stats.patterns.length === 0 ? (
            <p className="muted">No mistakes or blunders in reviewed games yet.</p>
          ) : (
            <ul className="bars">
              {stats.patterns.map((p) => (
                <li key={p.category}>
                  <span className="bar-label">{CATEGORY_LABEL[p.category]}</span>
                  <span className="bar-track">
                    <span className="bar-fill warn" style={{ width: `${(p.winLost / maxPattern) * 100}%` }} />
                  </span>
                  <span className="bar-value">{Math.round(p.winLost)}%</span>
                  <span className="bar-sub muted">
                    {p.count} time{p.count === 1 ? '' : 's'} ·{' '}
                    <a href={routeHref({ name: 'puzzles', theme: CATEGORY_THEMES[p.category][0] })}>
                      practise {THEME_LABEL[CATEGORY_THEMES[p.category][0]].toLowerCase()}
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-label="Puzzles">
          <h2 className="card-title">Practise your weak spots</h2>
          {mistakeInfo && mistakeInfo.total > 0 && (
            <a className="mistakes-link" href={routeHref({ name: 'puzzles', theme: 'mistakes' })} data-testid="progress-mistakes">
              <strong>Your own mistakes:</strong> {mistakeInfo.due} due, {mistakeInfo.learning} learning,{' '}
              {mistakeInfo.mastered} mastered
            </a>
          )}
          <div className="theme-chips">
            {themes.map((t) => (
              <a key={t} className="chip" href={routeHref({ name: 'puzzles', theme: t })}>
                {THEME_LABEL[t] ?? t}
              </a>
            ))}
          </div>
          {puzzles && puzzles.attempts.length > 0 && (
            <ul className="puzzle-record">
              {themeRecords(puzzles.attempts)
                .filter((r) => THEME_LABEL[r.theme])
                .slice(0, 8)
                .map((r) => (
                  <li key={r.theme}>
                    <span>{THEME_LABEL[r.theme]}</span>
                    <span className="muted">
                      {r.solved}/{r.tried} solved
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
