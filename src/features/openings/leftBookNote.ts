import type { Move } from 'chess.js'
import { bookMoves, type BookData, type BookStatus } from '../../openings/book'

type Info = { book: BookData; status: BookStatus } | null

/** "This move left the opening book. Book moves were: Nf3, Bc4." for the user's own move, or null. */
export function leftBookNote(info: Info, history: Move[], ply: number, userColor: Move['color']): string | null {
  if (!info || info.status.leftBookAt !== ply || ply < 0) return null
  const m = history[ply]
  if (!m || m.color !== userColor) return null
  const options = bookMoves(info.book, m.before).slice(0, 4).map((b) => b.san)
  if (options.length === 0) return 'This move left the opening book.'
  return `This move left the opening book. Book moves here were ${options.join(', ')}.`
}
