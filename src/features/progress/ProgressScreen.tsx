import { useMemo, useState } from 'react'
import { routeHref } from '../../app/route'
import { CATEGORY_THEMES, recommendedThemes, THEME_LABEL } from '../../puzzles/themes'
import { progressStats } from '../../progress/stats'
import { PHASE_LABEL } from '../../review/gamePhase'
import type { LessonCategory } from '../../review/types'
import { themeRecords } from '../../storage/puzzleStore'
import { usePuzzleData } from '../../storage/usePuzzleData'
import { useGames } from '../../storage/useGames'
import { useMistakePuzzles } from '../../storage/useMistakePuzzles'
import { patternStats, todaysSet } from '../../puzzles/mistakes'
import { drillStats } from '../../openings/drill'
import { useOpeningDrills } from '../../storage/openingStore'
import { AccuracyChart } from './AccuracyChart'
import { LESSONS } from '../../lessons/lessons'
import { LESSON_PREFIX } from '../puzzles/mistakeRoutes'
import { GoalCard } from '../goal/GoalCard'
import { queueReviews, useReviewQueue } from '../../review/reviewQueue'
import { RATING } from '../../config/rating'
import { threatScore, useThreatResults } from '../../coach/threatQuizStore'
import { lichessRatings, puzzleStartRating, ratingSummary } from '../../rating/estimate'

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
  const mistakeInfo =
    mistakes && mistakes.length > 0 ? { top: patternStats(mistakes, now)[0], today: todaysSet(mistakes, now).queue.length } : null
  const drills = useOpeningDrills()
  const openingInfo = drills ? drillStats(drills, now) : null
  const [filter, setFilter] = useState<Filter>('all')
  const queued = useReviewQueue()
  const threatResults = useThreatResults()
  const threats = threatResults && threatResults.length > 0 ? threatScore(threatResults) : null

  const filtered = useMemo(() => (games ?? []).filter((g) => filter === 'all' || g.source === filter), [games, filter])
  const stats = useMemo(() => progressStats(filtered), [filtered])
  // The rating estimate always uses every bot game, whatever the filter.
  const strength = useMemo(() => ratingSummary(games ?? []), [games])
  const lichess = useMemo(() => lichessRatings(games ?? []), [games])
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

      <div className="progress-top">
        <GoalCard />
      <section className="card strength-card" data-testid="strength">
        <div className="strength-main">
          <span className="tile-label">Estimated rating</span>
          <span className="strength-value">
            {strength.estimate ? strength.estimate.rating : '–'}
            {strength.estimate && <span className="strength-range"> ± {strength.estimate.plusMinus}</span>}
          </span>
          {strength.trend !== null && (
            <span className={`tile-sub ${strength.trend > 0 ? 'up' : strength.trend < 0 ? 'down' : 'muted'}`}>
              {strength.trend === 0
                ? `same as ${RATING.trendGames} games ago`
                : `${strength.trend > 0 ? '▲' : '▼'} ${Math.abs(strength.trend)} in your last ${RATING.trendGames} games`}
            </span>
          )}
        </div>
        <div className="strength-detail">
          <p className="muted small">
            {strength.estimate
              ? `From your last ${strength.estimate.games} games against the bot (${strength.estimate.wins} won, ${strength.estimate.draws} drawn, ${strength.estimate.losses} lost), using the bot levels as ratings.`
              : `Play ${RATING.minGames - strength.counted} more game${RATING.minGames - strength.counted === 1 ? '' : 's'} against the bot to get an estimate.`}{' '}
            Games with takebacks or hints don't count.
          </p>
          {lichess.length > 0 && (
            <p className="small lichess-ratings" data-testid="lichess-ratings">
              Lichess: {lichess.map((l) => `${l.speed} ${l.rating}`).join(' · ')}
            </p>
          )}
        </div>
      </section>
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
            {trend == null
              ? 'no games yet'
              : Math.abs(trend) < 0.05
                ? 'same as your average'
                : `${trend > 0 ? '▲' : '▼'} ${Math.abs(trend).toFixed(1)} vs your average`}
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
          <span className="tile-value">
            {puzzles ? puzzleStartRating(puzzles.rating, puzzles.attempts.length, strength.estimate) : '–'}
          </span>
          <span className="tile-sub muted">{puzzles ? `${puzzles.attempts.length} puzzles tried` : ''}</span>
        </div>
      </div>

      {/* While they are queued, the status bar at the top shows the reviews. */}
      {unreviewed.length > 0 && !unreviewed.some((g) => queued.includes(g.id)) && (
        <section className="card unreviewed">
          <p>
            <strong>
              {unreviewed.length} game{unreviewed.length === 1 ? ' is' : 's are'} not reviewed yet
            </strong>{' '}
            <span className="muted">and not counted below.</span>
          </p>
          <button type="button" className="primary" onClick={() => queueReviews(unreviewed.map((g) => g.id))}>
            Review {unreviewed.length === 1 ? 'it' : 'them'} now
          </button>
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
                  {p.moves === 0
                    ? 'No moves yet'
                    : `${plural(p.moves, 'move')} · ${plural(p.mistakes, 'mistake')} · ${plural(p.blunders, 'blunder')}`}
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
                    <a href={routeHref({ name: 'puzzles', theme: LESSON_PREFIX + p.category })}>lesson</a> ·{' '}
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
          {stats.patterns[0] && (
            <a
              className="mistakes-link"
              href={routeHref({ name: 'puzzles', theme: LESSON_PREFIX + stats.patterns[0].category })}
              data-testid="progress-lesson"
            >
              <strong>Lesson for your costliest mistake:</strong> {LESSONS[stats.patterns[0].category].title.toLowerCase()}
            </a>
          )}
          {mistakeInfo && (
            <a className="mistakes-link" href={routeHref({ name: 'puzzles', theme: 'mistakes' })} data-testid="progress-mistakes">
              <strong>Your most common mistake:</strong> {mistakeInfo.top.label.toLowerCase()} (
              {mistakeInfo.top.times || mistakeInfo.top.timesEver} times).{' '}
              {mistakeInfo.today > 0 ? `${mistakeInfo.today} to solve today.` : 'Done for today.'}
            </a>
          )}
          <a className="mistakes-link" href={routeHref({ name: 'puzzles', theme: 'openings' })} data-testid="progress-openings">
            <strong>Your openings:</strong>{' '}
            {openingInfo && openingInfo.total > 0
              ? `${openingInfo.due + openingInfo.fresh} to practise, ${openingInfo.mastered} mastered`
              : 'pick lines to learn by heart'}
          </a>
          {threats && (
            <p className="mistakes-link" data-testid="progress-threats">
              <strong>Spotting threats:</strong> {threats.right} of the last {threats.asked} threat quiz{' '}
              {threats.asked === 1 ? 'question' : 'questions'} right.
            </p>
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
