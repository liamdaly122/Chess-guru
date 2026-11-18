import { Chess, type Color } from 'chess.js'
import { parseUci } from '../chess/moves'
import { STANDARD_START, type GameRecord } from '../storage/types'
import { bookMoves, bookStatus, type BookData } from './book'
import { lineContinuing, type OpeningLine } from './lines'

/** A line worth learning: where you left the book in your own games. */
export interface LineSuggestion {
  line: OpeningLine
  side: Color
  /** Games where you left the book at this point. */
  games: number
  /** Your move number where you left, e.g. 4 for "4. Nxe5". */
  moveNumber: number
  /** What you played instead (most recent game). */
  played: string
  /** The book moves you could have played there. */
  bookSans: string[]
}

/**
 * For each game from the normal start where you (not your opponent) were the first to leave the
 * book, find the shortest named line that continues from there. Lines are counted across games,
 * most common first, then most recent.
 */
export function suggestionsFromGames(
  games: GameRecord[],
  book: BookData,
  lines: OpeningLine[],
  max: number,
  skip: (lineId: string, side: Color) => boolean = () => false,
): LineSuggestion[] {
  const found = new Map<string, LineSuggestion & { last: number }>()
  for (const g of games) {
    if (g.startFen && g.startFen !== STANDARD_START) continue
    const chess = new Chess()
    const positions = [chess.fen()]
    const sans: string[] = []
    try {
      for (const m of g.moves) {
        sans.push(chess.move(parseUci(m)).san)
        positions.push(chess.fen())
      }
    } catch {
      continue
    }
    const status = bookStatus(book, positions)
    const at = status.leftBookAt
    if (at === null) continue
    const mover: Color = at % 2 === 0 ? 'w' : 'b'
    if (mover !== g.userColor) continue
    const line = lineContinuing(lines, sans.slice(0, at))
    if (!line || skip(line.id, mover)) continue
    const key = `${mover}:${line.id}`
    const prev = found.get(key)
    if (prev) {
      prev.games++
      if (g.endedAt > prev.last) Object.assign(prev, { last: g.endedAt, played: sans[at] })
      continue
    }
    found.set(key, {
      line,
      side: mover,
      games: 1,
      moveNumber: Math.floor(at / 2) + 1,
      played: sans[at],
      bookSans: bookMoves(book, positions[at]).map((b) => b.san),
      last: g.endedAt,
    })
  }
  return [...found.values()]
    .sort((a, b) => b.games - a.games || b.last - a.last)
    .slice(0, max)
    .map(({ last: _last, ...s }) => s)
}
