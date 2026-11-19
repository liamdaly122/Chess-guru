import type { Color } from 'chess.js'
import { useEffect, useMemo, useState } from 'react'
import { routeHref } from '../../app/route'
import { loadBook, type BookData } from '../../openings/book'
import { drillId, newDrill } from '../../openings/drill'
import { suggestionsFromGames, type LineSuggestion } from '../../openings/fromGames'
import { family, lineText, loadLines, type OpeningLine } from '../../openings/lines'
import { costingAndWorking, openingReport, openingSummary, type OpeningStat } from '../../openings/report'
import { addDrills, useOpeningDrills } from '../../storage/openingStore'
import { useGames } from '../../storage/useGames'
import { CoachBubble } from '../play/CoachBubble'
import { ChevronIcon } from '../../ui/icons'
import { OPENINGS } from '../train/trainRoutes'

type ColorFilter = 'all' | Color
type Period = 'all' | 'recent'
const RECENT_DAYS = 90
const SIDE = { w: 'White', b: 'Black' } as const
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Your openings: for each opening and colour, your results, how long you stay in book, who
 * leaves it first, how you stand at move 10 and your accuracy in the opening, with the line to
 * learn where you leave the book.
 */
export function OpeningReportPage() {
  const games = useGames()
  const drills = useOpeningDrills()
  const [book, setBook] = useState<BookData | null>(null)
  const [lines, setLines] = useState<OpeningLine[] | null>(null)
  const [color, setColor] = useState<ColorFilter>('all')
  const [period, setPeriod] = useState<Period>('all')
  const [now] = useState(() => Date.now())
  useEffect(() => {
    let live = true
    void loadBook().then((b) => live && setBook(b))
    void loadLines().then((l) => live && setLines(l))
    return () => {
      live = false
    }
  }, [])

  const filtered = useMemo(
    () =>
      (games ?? []).filter(
        (g) => (color === 'all' || g.userColor === color) && (period === 'all' || g.endedAt >= now - RECENT_DAYS * 86_400_000),
      ),
    [games, color, period, now],
  )
  const stats = useMemo(() => (book ? openingReport(filtered, book) : null), [filtered, book])
  const suggestions = useMemo(
    () => (book && lines ? suggestionsFromGames(filtered, book, lines, 500) : []),
    [filtered, book, lines],
  )
  const verdict = useMemo(() => (stats ? costingAndWorking(stats) : null), [stats])

  if (!games || !stats || !verdict || !drills) return <p className="muted page-message">Loading…</p>

  const have = new Set(drills.map((d) => d.id))
  const lineFor = (s: OpeningStat) => suggestions.find((x) => x.side === s.color && family(x.line.name) === s.name) ?? null

  return (
    <div className="report-screen opening-report" data-testid="opening-report">
      <a className="back-link small train-back" href={routeHref({ name: 'progress' })}>
        ← Progress
      </a>
      <div className="games-head">
        <h1>Your openings</h1>
      </div>
      <div className="filter-row">
        <div className="filter-chips" role="tablist" aria-label="Colour">
          {(['all', 'w', 'b'] as ColorFilter[]).map((c) => (
            <button key={c} type="button" role="tab" aria-selected={color === c} className={`chip ${color === c ? 'active' : ''}`} onClick={() => setColor(c)}>
              {c === 'all' ? 'Both colours' : `As ${SIDE[c]}`}
            </button>
          ))}
        </div>
        <div className="filter-chips" role="tablist" aria-label="Period">
          {(['all', 'recent'] as Period[]).map((p) => (
            <button key={p} type="button" role="tab" aria-selected={period === p} className={`chip ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
              {p === 'all' ? 'All time' : `Last ${RECENT_DAYS} days`}
            </button>
          ))}
        </div>
      </div>

      <CoachBubble message={{ id: `openings:${color}:${period}`, tone: 'neutral', text: openingSummary(stats) }} />

      {stats.length > 0 && (
        <section className="card" aria-label="Openings" data-testid="opening-list">
          <ul className="opening-stats">
            {stats.map((s) => (
              <OpeningRow
                key={`${s.color}:${s.name}`}
                stat={s}
                tag={verdict.costing.includes(s) ? 'costing' : verdict.working.includes(s) ? 'working' : null}
                suggestion={lineFor(s)}
                have={have}
              />
            ))}
          </ul>
        </section>
      )}
      <p className="muted small">
        Grouped by opening family and your colour. Move 10 and opening accuracy come from reviewed games.
      </p>
    </div>
  )
}

function OpeningRow({
  stat: s,
  tag,
  suggestion,
  have,
}: {
  stat: OpeningStat
  tag: 'costing' | 'working' | null
  suggestion: LineSuggestion | null
  have: Set<string>
}) {
  const [added, setAdded] = useState(false)
  const pct = (n: number) => `${(n / s.games) * 100}%`
  const learnt = suggestion ? have.has(drillId(suggestion.line.id, suggestion.side)) : false
  return (
    <li className="opening-stat" data-testid="opening-row" data-name={s.name} data-color={s.color}>
      <details>
        <summary>
          <span className="opening-stat-head">
            <span className="line-name">
              {s.name}
              {tag === 'costing' && <span className="kind-chip kind-hold report-chip">Costing you</span>}
              {tag === 'working' && <span className="kind-chip kind-win report-chip">Working well</span>}
            </span>
            <span className="muted small">
              As {SIDE[s.color]} · {plural(s.games, 'game')} · {Math.round(s.score * 100)}%
            </span>
          </span>
          <span className="result-bar" aria-label={`${s.win} won, ${s.draw} drawn, ${s.loss} lost`}>
            <span className="bar-win" style={{ width: pct(s.win) }} />
            <span className="bar-draw" style={{ width: pct(s.draw) }} />
            <span className="bar-loss" style={{ width: pct(s.loss) }} />
          </span>
          <ChevronIcon className="train-chevron opening-chevron" />
        </summary>
        <ul className="report-facts">
          <li>
            <span className="muted">Results</span>
            <strong>
              {s.win} won, {s.loss} lost{s.draw ? `, ${s.draw} drawn` : ''}
            </strong>
          </li>
          <li>
            <span className="muted">In book</span>
            <strong>about {Math.round(s.bookMoves)} moves</strong>
          </li>
          <li>
            <span className="muted">Left the book first</span>
            <strong>
              {s.youLeft + s.theyLeft === 0
                ? 'never left it'
                : `you ${s.youLeft}, them ${s.theyLeft}`}
            </strong>
          </li>
          {s.exit && (
            <li>
              <span className="muted">Your usual move out of book</span>
              <strong>
                {s.exit.move} ({s.exit.count}×)
              </strong>
            </li>
          )}
          {s.at10 && (
            <li>
              <span className="muted">At move 10</span>
              <strong>
                ahead {s.at10.ahead}, level {s.at10.level}, behind {s.at10.behind}
              </strong>
            </li>
          )}
          {s.accuracy != null && (
            <li>
              <span className="muted">Opening accuracy</span>
              <strong>{Math.round(s.accuracy)}%</strong>
            </li>
          )}
          <li>
            <span className="muted">Variations</span>
            <span className="opening-variations">
              {s.variations.slice(0, 3).map((v) => (
                <span key={v.name}>
                  {v.name.includes(':') ? v.name.split(':').slice(1).join(':').trim() : v.name} ({v.games})
                </span>
              ))}
            </span>
          </li>
        </ul>
        <div className="opening-actions">
          {suggestion && !learnt && !added ? (
            <>
              <p className="small">
                You leave the book at move {suggestion.moveNumber} with {suggestion.played}. The book line there:{' '}
                <strong>{suggestion.line.name}</strong> ({lineText(suggestion.line.san)}).
              </p>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  void addDrills([newDrill(suggestion.line, suggestion.side)])
                  setAdded(true)
                }}
                data-testid="learn-line"
              >
                Learn this line
              </button>
            </>
          ) : suggestion ? (
            <p className="small" data-testid="line-added">
              <strong>{suggestion.line.name}</strong> is in your opening lines.{' '}
              <a href={routeHref({ name: 'train', theme: OPENINGS })}>Practise it</a>
            </p>
          ) : (
            <a className="button-link" href={routeHref({ name: 'train', theme: OPENINGS })}>
              Opening trainer
            </a>
          )}
          <a className="button-link" href={routeHref({ name: 'review', id: s.gameIds[0] })}>
            Latest game
          </a>
        </div>
      </details>
    </li>
  )
}
