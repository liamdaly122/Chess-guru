import type { Color } from 'chess.js'
import { useEffect, useMemo, useState } from 'react'
import { navigate } from '../../app/route'
import { OPENING_TRAINER } from '../../config/openingTrainer'
import { loadBook, type BookData } from '../../openings/book'
import { drillId, isMastered, newDrill, type OpeningDrill } from '../../openings/drill'
import { suggestionsFromGames } from '../../openings/fromGames'
import { lineText, loadLines, movesFor, searchLines, type OpeningLine } from '../../openings/lines'
import { addDrills, deleteDrill } from '../../storage/openingStore'
import { useGames } from '../../storage/useGames'
import { whenText } from '../../training/srs'
import { CloseIcon } from '../../ui/icons'
import { OPENING_LINES } from '../train/trainRoutes'

const SIDE = { w: 'White', b: 'Black' } as const

/** Choose the lines to learn: from where you leave the book in your games, or by name. */
export function OpeningLines({ drills }: { drills: OpeningDrill[] }) {
  const games = useGames()
  const [lines, setLines] = useState<OpeningLine[] | null>(null)
  const [book, setBook] = useState<BookData | null>(null)
  const [query, setQuery] = useState('')
  const [now] = useState(() => Date.now())

  useEffect(() => {
    let live = true
    Promise.all([loadLines(), loadBook()]).then(([l, b]) => {
      if (!live) return
      setLines(l)
      setBook(b)
    })
    return () => {
      live = false
    }
  }, [])

  const have = useMemo(() => new Set(drills.map((d) => d.id)), [drills])
  const suggestions = useMemo(
    () =>
      lines && book && games
        ? suggestionsFromGames(games, book, lines, OPENING_TRAINER.maxSuggestions, (id, side) => have.has(drillId(id, side)))
        : [],
    [lines, book, games, have],
  )
  const results = useMemo(() => (lines ? searchLines(lines, query, OPENING_TRAINER.maxResults) : []), [lines, query])

  const add = (line: OpeningLine, side: Color) => {
    // The first line: stay on this list (the Openings page would otherwise switch to practice).
    if (drills.length === 0) navigate({ name: 'train', theme: OPENING_LINES }, { keepScroll: true })
    void addDrills([newDrill(line, side)])
  }

  if (!lines || !book) return <p className="muted">Loading the opening list…</p>

  return (
    <div className="opening-lines">
      {drills.length === 0 && (
        <p className="muted intro">
          Pick the openings you want to know by heart. You play your side, the app plays the other, and each line comes back
          until you know it.
        </p>
      )}

      <div className="lines-columns">
        <div className="lines-side">
          {suggestions.length > 0 && (
            <section className="card" aria-label="From your games" data-testid="opening-suggestions">
              <h2 className="card-title">From your games</h2>
              <ul className="line-list">
                {suggestions.map((s) => (
                  <li key={`${s.side}:${s.line.id}`} className="line-row">
                    <div className="line-info">
                      <p className="line-name">{s.line.name}</p>
                      <p className="muted small">
                        As {SIDE[s.side]}, you left the book at move {s.moveNumber} with {s.played}
                        {s.games > 1 ? ` (${s.games} games)` : ''}. Book moves there: {s.bookSans.join(', ')}.
                      </p>
                    </div>
                    <button type="button" className="primary" onClick={() => add(s.line, s.side)}>
                      Learn
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {drills.length > 0 && (
            <section className="card" aria-label="Your lines" data-testid="your-lines">
              <h2 className="card-title">Your lines ({drills.length})</h2>
              <ul className="line-list">
                {[...drills]
                  .sort((a, b) => a.name.localeCompare(b.name) || a.san.length - b.san.length)
                  .map((d) => (
                    <li key={d.id} className="line-row">
                      <div className="line-info">
                        <p className="line-name">
                          <span className={`side-chip side-${d.side}`} /> {d.name}
                        </p>
                        <p className="muted small">
                          {lineText(d.san)} ·{' '}
                          {!d.learned ? 'new' : isMastered(d) ? 'mastered' : d.dueAt <= now ? 'due now' : `next ${whenText(d.dueAt, now)}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remove ${d.name} as ${SIDE[d.side]}`}
                        onClick={() => void deleteDrill(d.id)}
                      >
                        <CloseIcon />
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>
        <div className="lines-main">
          <section className="card" aria-label="Find a line">
            <h2 className="card-title">Find a line</h2>
            <input
              type="search"
              className="line-search"
              placeholder="Opening name, e.g. Caro-Kann"
              aria-label="Search openings"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="theme-chips chip-row">
              {OPENING_TRAINER.popular.map((name) => (
                <button key={name} type="button" className={`chip ${query === name ? 'active' : ''}`} onClick={() => setQuery(name)}>
                  {name}
                </button>
              ))}
            </div>
            {query.trim() && results.length === 0 && <p className="muted">No openings match "{query}".</p>}
            {results.length > 0 && (
              <ul className="line-list" data-testid="line-results">
                {results.map((l) => (
                  <li key={l.id} className="line-row">
                    <div className="line-info">
                      <p className="line-name">
                        <span className="eco">{l.eco}</span> {l.name}
                      </p>
                      <p className="muted small line-moves">{lineText(l.san)}</p>
                    </div>
                    <div className="side-buttons" role="group" aria-label={`Learn ${l.name} as`}>
                      {(['w', 'b'] as const).map((side) => {
                        const added = have.has(drillId(l.id, side))
                        return (
                          <button
                            key={side}
                            type="button"
                            className={added ? 'added' : ''}
                            disabled={added || movesFor(l, side) === 0}
                            onClick={() => add(l, side)}
                            aria-label={`Learn as ${SIDE[side]}`}
                          >
                            <span className={`side-chip side-${side}`} /> {added ? 'Added' : SIDE[side]}
                          </button>
                        )
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}
