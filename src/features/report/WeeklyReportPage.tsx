import { useEffect, useMemo, useState } from 'react'
import { routeHref } from '../../app/route'
import { LESSONS } from '../../lessons/lessons'
import { markReportSeen, useReportInput } from '../../report/reportStore'
import { hasActivity, nextWeek, previousWeek, weekFromKey, weekLabel, weeklyReport, weekOf, type Focus, type WeeklyReport } from '../../report/weekly'
import { queueReviews, useReviewQueue } from '../../review/reviewQueue'
import { CoachBubble } from '../play/CoachBubble'
import { ENDGAMES, LESSON_PREFIX, MISTAKE_PATTERN_PREFIX, OPENINGS, PUZZLES } from '../train/trainRoutes'

const train = (page: string) => routeHref({ name: 'train', theme: page })
const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`
const PHASE_WORD = { opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame' } as const
const CATEGORY_WORD = {
  'loose-pieces': 'Loose pieces',
  forks: 'Forks against you',
  'pins-skewers': 'Pins and skewers',
  threats: 'Missed threats',
  'king-safety': 'King safety',
  'missed-tactics': 'Missed tactics',
  'missed-mates': 'Missed mates',
  general: 'Other mistakes',
} as const

/**
 * The weekly report: one calendar week (Monday to Sunday) of your games, puzzles and answers,
 * with one thing to work on. Without a week in the route it shows last week if anything
 * happened then, otherwise this week so far.
 */
export function WeeklyReportPage({ weekKey }: { weekKey?: string }) {
  const input = useReportInput()
  const [now] = useState(() => Date.now())
  const thisWeek = useMemo(() => weekOf(now), [now])
  const lastWeek = useMemo(() => previousWeek(thisWeek), [thisWeek])

  const week = useMemo(() => {
    const asked = weekKey ? weekFromKey(weekKey) : null
    if (asked && asked.start <= thisWeek.start) return asked
    if (!input) return null
    return hasActivity(weeklyReport(lastWeek, input)) ? lastWeek : thisWeek
  }, [weekKey, input, thisWeek, lastWeek])
  const report = useMemo(() => (input && week ? weeklyReport(week, input) : null), [input, week])

  // The first week with anything in it, so Previous stops there.
  const firstWeek = useMemo(() => {
    if (!input) return thisWeek
    const times = [...input.games.map((g) => g.endedAt), ...input.attempts.map((a) => a.at)]
    return times.length ? weekOf(Math.min(...times)) : thisWeek
  }, [input, thisWeek])

  useEffect(() => {
    if (week && week.key <= lastWeek.key) void markReportSeen(week.key)
  }, [week, lastWeek])

  if (!report || !week) return <p className="muted page-message">Loading…</p>

  const isThisWeek = week.key === thisWeek.key
  const prev = previousWeek(week)
  const canGoBack = prev.start >= firstWeek.start
  return (
    <div className="report-screen" data-testid="weekly-report" data-week={week.key}>
      <a className="back-link small train-back" href={routeHref({ name: 'progress' })}>
        ← Progress
      </a>
      <div className="games-head">
        <h1>Weekly report</h1>
      </div>

      <nav className="week-nav" aria-label="Week">
        <a
          className={`button-link week-step ${canGoBack ? '' : 'disabled'}`}
          href={canGoBack ? routeHref({ name: 'report', week: prev.key }) : undefined}
          aria-disabled={!canGoBack}
          aria-label="Previous week"
          data-testid="week-prev"
        >
          ‹
        </a>
        <span className="week-name" data-testid="week-name">
          <strong>{isThisWeek ? 'This week so far' : week.key === lastWeek.key ? 'Last week' : weekLabel(week)}</strong>
          <span className="muted small">{weekLabel(week)}</span>
        </span>
        <a
          className={`button-link week-step ${isThisWeek ? 'disabled' : ''}`}
          href={isThisWeek ? undefined : routeHref({ name: 'report', week: nextWeek(week).key })}
          aria-disabled={isThisWeek}
          aria-label="Next week"
          data-testid="week-next"
        >
          ›
        </a>
      </nav>

      <CoachBubble message={{ id: `report:${week.key}`, tone: 'neutral', text: report.summary }} />

      <FocusCard focus={report.focus} report={report} current={isThisWeek} />

      <div className="stat-tiles report-tiles" data-testid="report-tiles">
        <div className="card tile">
          <span className="tile-label">Games</span>
          <span className="tile-value">
            {report.games.win}–{report.games.loss}–{report.games.draw}
          </span>
          <span className="tile-sub muted">
            {report.games.total === 0
              ? 'won, lost, drawn'
              : [report.games.bot && `${report.games.bot} vs bot`, report.games.lichess && `${report.games.lichess} on Lichess`].filter(Boolean).join(' · ')}
          </span>
        </div>
        <div className="card tile">
          <span className="tile-label">Accuracy</span>
          <span className="tile-value">{report.accuracy == null ? '–' : `${Math.round(report.accuracy)}%`}</span>
          <AccuracyChange report={report} />
        </div>
        <div className="card tile">
          <span className="tile-label">Puzzles</span>
          <span className="tile-value">{report.puzzles}</span>
          <span className={`tile-sub ${!report.rated ? 'muted' : report.rated.to >= report.rated.from ? 'up' : 'down'}`}>
            {report.rated ? `rating ${report.rated.from} → ${report.rated.to}` : 'all kinds'}
          </span>
        </div>
        <div className="card tile">
          <span className="tile-label">Daily goal</span>
          <span className="tile-value">{report.goalDays}</span>
          <span className="tile-sub muted">{report.goalDays === 1 ? 'day met' : 'days met'}</span>
        </div>
        {report.rating && (
          <div className="card tile">
            <span className="tile-label">Rating estimate</span>
            <span className="tile-value">{report.rating.now}</span>
            <span className={`tile-sub ${!report.rating.change ? 'muted' : report.rating.change > 0 ? 'up' : 'down'}`}>
              {report.rating.change == null
                ? 'at the end of the week'
                : report.rating.change === 0
                  ? 'no change this week'
                  : `${report.rating.change > 0 ? '▲' : '▼'} ${Math.abs(report.rating.change)} this week`}
            </span>
          </div>
        )}
        {report.threats && (
          <div className="card tile">
            <span className="tile-label">Threat quiz</span>
            <span className="tile-value">
              {report.threats.right}/{report.threats.asked}
            </span>
            <span className="tile-sub muted">threats spotted</span>
          </div>
        )}
      </div>

      {report.games.reviewed > 0 && (
        <section className="card" aria-label="Mistakes" data-testid="report-mistakes">
          <h2 className="card-title">Mistakes</h2>
          <ul className="report-facts">
            <li>
              <span className="muted">Mistakes and blunders</span>
              <strong>
                {plural(report.mistakes, 'mistake')}, {plural(report.blunders, 'blunder')}
              </strong>
            </li>
            {report.topPattern && (
              <li>
                <span className="muted">Most common</span>
                <span>
                  <strong>{report.topPattern.label}</strong> ({report.topPattern.count}×){' '}
                  <a href={train(MISTAKE_PATTERN_PREFIX + report.topPattern.pattern)}>Solve</a>
                </span>
              </li>
            )}
            {report.costliest && (
              <li>
                <span className="muted">Cost you the most</span>
                <span>
                  <strong>{CATEGORY_WORD[report.costliest.category]}</strong>{' '}
                  <a href={train(LESSON_PREFIX + report.costliest.category)}>Lesson</a>
                </span>
              </li>
            )}
            {report.weakestPhase && (
              <li>
                <span className="muted">Weakest phase</span>
                <strong>
                  {PHASE_WORD[report.weakestPhase.phase]} ({report.weakestPhase.perMove.toFixed(1)}% lost per move)
                </strong>
              </li>
            )}
          </ul>
        </section>
      )}

      {report.openings.length > 0 && (
        <section className="card" aria-label="Openings" data-testid="report-openings">
          <h2 className="card-title">Openings</h2>
          <ul className="line-list">
            {report.openings.slice(0, 5).map((o) => (
              <li key={`${o.color}:${o.name}`} className="line-row">
                <div className="line-info">
                  <p className="line-name">
                    {o.name}
                    {report.best === o && <span className="kind-chip kind-win report-chip">Best</span>}
                    {report.worst === o && <span className="kind-chip kind-hold report-chip">Worst</span>}
                  </p>
                  <p className="muted small">
                    As {o.color === 'w' ? 'White' : 'Black'} · {plural(o.games, 'game')}: {o.win} won, {o.loss} lost
                    {o.draw ? `, ${o.draw} drawn` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <a className="small see-all" href={routeHref({ name: 'openings' })}>
            All your openings
          </a>
        </section>
      )}

      {report.games.unreviewed.length > 0 && report.focus.kind !== 'review' && <UnreviewedCard ids={report.games.unreviewed} />}
    </div>
  )
}

function AccuracyChange({ report }: { report: WeeklyReport }) {
  if (report.accuracy == null) return <span className="tile-sub muted">no reviewed games</span>
  if (report.accuracyBefore == null) return <span className="tile-sub muted">no games the week before</span>
  const diff = Math.round(report.accuracy - report.accuracyBefore)
  if (diff === 0) return <span className="tile-sub muted">same as the week before</span>
  return (
    <span className={`tile-sub ${diff > 0 ? 'up' : 'down'}`}>
      {diff > 0 ? '▲' : '▼'} {Math.abs(diff)} on the week before
    </span>
  )
}

function FocusCard({ focus, report, current }: { focus: Focus; report: WeeklyReport; current: boolean }) {
  const queued = useReviewQueue()
  const reviewing = report.games.unreviewed.some((id) => queued.includes(id))
  const action =
    focus.kind === 'play' ? (
      <a className="button-link primary wide" href={routeHref({ name: 'play' })}>
        Play a game
      </a>
    ) : focus.kind === 'review' ? (
      <button type="button" className="primary wide" disabled={reviewing} onClick={() => queueReviews(report.games.unreviewed)}>
        {reviewing ? 'Reviewing…' : `Review ${report.games.unreviewed.length === 1 ? 'it' : 'them'} now`}
      </button>
    ) : (
      <a
        className="button-link primary wide"
        href={train(
          focus.kind === 'lesson' && focus.category
            ? LESSON_PREFIX + focus.category
            : focus.kind === 'endgames'
              ? ENDGAMES
              : focus.kind === 'openings'
                ? OPENINGS
                : PUZZLES,
        )}
      >
        {focus.kind === 'lesson' ? 'Open the lesson' : focus.kind === 'endgames' ? 'Endgame drills' : focus.kind === 'openings' ? 'Opening trainer' : 'Puzzles'}
      </a>
    )
  return (
    <section className="card focus-card" aria-label="Focus" data-testid="report-focus">
      <h2 className="card-title">{current ? 'Work on now' : 'Work on this week'}</h2>
      <p className="focus-title">{focus.kind === 'lesson' && focus.category ? `Lesson: ${LESSONS[focus.category].title}` : focus.title}</p>
      <p className="muted">{focus.text}</p>
      {action}
    </section>
  )
}

function UnreviewedCard({ ids }: { ids: string[] }) {
  const queued = useReviewQueue()
  if (ids.some((id) => queued.includes(id))) return null
  return (
    <section className="card unreviewed">
      <p>
        <strong>{ids.length === 1 ? "1 of these games isn't" : `${ids.length} of these games aren't`} reviewed yet</strong>{' '}
        <span className="muted">and not counted in accuracy and mistakes.</span>
      </p>
      <button type="button" className="primary" onClick={() => queueReviews(ids)}>
        Review {ids.length === 1 ? 'it' : 'them'} now
      </button>
    </section>
  )
}
