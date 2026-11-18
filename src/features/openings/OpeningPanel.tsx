import type { Move } from 'chess.js'
import { bookMoves, type BookData, type BookStatus } from '../../openings/book'
import { BookIcon } from '../../ui/icons'

interface Props {
  info: { book: BookData; status: BookStatus } | null
  history: Move[]
  /** Position whose book moves can be listed (the current one), or null to hide the list. */
  movesFrom: string | null
  /** Optional: jump to a half-move (review screen). */
  onJump?: (ply: number) => void
}

function moveName(ply: number, m: Move): string {
  return `${Math.floor(ply / 2) + 1}.${m.color === 'b' ? '..' : ''} ${m.san}`
}

/** Which opening this is, how long the game stayed in theory, and the book moves from here. */
export function OpeningPanel({ info, history, movesFrom, onJump }: Props) {
  if (!info) return null
  const { status, book } = info
  const bookLength = status.inBook.filter(Boolean).length
  const stillInBook = status.leftBookAt === null && (history.length === 0 || status.inBook[history.length - 1])
  const candidates = movesFrom && stillInBook ? bookMoves(book, movesFrom) : []

  let title: string
  if (status.opening) title = status.opening.name
  else if (history.length === 0) title = 'Starting position'
  else if (bookLength === 0) title = 'Not a known opening line'
  else title = 'Opening theory'

  return (
    <section className="card opening-card" aria-label="Opening" data-testid="opening">
      <header className="opening-head">
        <span className="opening-icon" aria-hidden>
          <BookIcon width={18} height={18} />
        </span>
        <span className="opening-title">
          {status.opening && <span className="eco">{status.opening.eco}</span>} {title}
        </span>
      </header>
      {history.length > 0 && (
        <p className="opening-status muted">
          {status.leftBookAt === null ? (
            stillInBook ? (
              <>Still in book after {Math.ceil(bookLength / 2)} move{bookLength > 2 ? 's' : ''}.</>
            ) : (
              <>Not from the normal starting position.</>
            )
          ) : (
            <>
              Left the book with{' '}
              {onJump ? (
                <button type="button" className="inline-link" onClick={() => onJump(status.leftBookAt!)}>
                  {moveName(status.leftBookAt, history[status.leftBookAt])}
                </button>
              ) : (
                <strong>{moveName(status.leftBookAt, history[status.leftBookAt])}</strong>
              )}
              {history[status.leftBookAt].color === 'w' ? ' (White)' : ' (Black)'}.
            </>
          )}
        </p>
      )}
      {candidates.length > 0 && (
        <details className="book-moves">
          <summary>Book moves here ({candidates.length})</summary>
          <ul>
            {candidates.slice(0, 8).map((c) => (
              <li key={c.san}>
                <strong>{c.san}</strong>
                {c.opening && <span className="muted"> {c.opening.name}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
