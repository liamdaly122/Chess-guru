import { Chess } from 'chess.js'
import { STANDARD_START } from '../storage/types'

/**
 * Opening book from the Lichess opening list (public domain). Positions are matched rather
 * than move orders, so transpositions into a known line are recognised.
 * Built by scripts/build-openings.mjs into src/data/openings.json.
 */
export type BookData = Record<string, [string, string] | 0>

export interface Opening {
  eco: string
  name: string
}

export interface BookStatus {
  /** One entry per half-move: true while the game is still in known theory after that move. */
  inBook: boolean[]
  /** The most specific named opening reached while in book. */
  opening: Opening | null
  /** Half-move index of the first move that left the book, or null if still in book. */
  leftBookAt: number | null
}

let loading: Promise<BookData> | null = null

/** Loads the opening table on first use (it's a separate download, about 90 KB). */
export function loadBook(): Promise<BookData> {
  loading ??= import('../data/openings.json').then((m) => m.default as unknown as BookData)
  return loading
}

/** Position key used by the table: board, side to move, castling and en passant. */
export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ')
}

/**
 * Book status of a game, given every position from the start (positions[0]) to now.
 * Only games from the normal starting position can be in book. Once a move leaves the
 * book, the game stays out of book even if it later transposes back.
 */
export function bookStatus(book: BookData, positions: string[]): BookStatus {
  const inBook: boolean[] = []
  let opening: Opening | null = null
  let leftBookAt: number | null = null
  let still = positionKey(positions[0]) === positionKey(STANDARD_START)

  for (let i = 1; i < positions.length; i++) {
    const entry = still ? book[positionKey(positions[i])] : undefined
    if (still && entry !== undefined) {
      inBook.push(true)
      if (entry) opening = { eco: entry[0], name: entry[1] }
    } else {
      if (still) leftBookAt = i - 1
      still = false
      inBook.push(false)
    }
  }
  return { inBook, opening, leftBookAt }
}

export interface BookMove {
  san: string
  /** Name of the line this move leads to, if it has one. */
  opening: Opening | null
}

/** Legal moves from `fen` that stay in the book, named lines first. */
export function bookMoves(book: BookData, fen: string): BookMove[] {
  const chess = new Chess(fen)
  const out: BookMove[] = []
  for (const m of chess.moves({ verbose: true })) {
    const entry = book[positionKey(m.after)]
    if (entry === undefined) continue
    out.push({ san: m.san, opening: entry ? { eco: entry[0], name: entry[1] } : null })
  }
  return out.sort((a, b) => Number(!!b.opening) - Number(!!a.opening))
}
