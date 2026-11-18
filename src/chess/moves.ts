import { Chess, type Color, type Square } from 'chess.js'

export interface MoveInput {
  from: Square
  to: Square
  promotion?: 'q' | 'r' | 'b' | 'n'
}

/** Convert a UCI move like "e7e8q" into chess.js move input. */
export function parseUci(uci: string): MoveInput {
  const promo = uci[4]
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    ...(promo ? { promotion: promo as MoveInput['promotion'] } : {}),
  }
}

/**
 * How many half-moves to take back so that it is the user's turn again and at
 * least one of the user's moves has been removed.
 *
 * - Bot has replied (user to move): take back 2 (bot's reply and the user's move).
 * - Bot hasn't replied yet, or the user's move ended the game: take back 1.
 * - Only the bot has moved (user is Black at move 1): nothing to undo.
 */
export function plyToUndo(historyLength: number, turn: Color, userColor: Color): number {
  if (historyLength === 0) return 0
  if (turn === userColor) {
    // Last move was the bot's. Undo it plus the user's move before it, if there is one.
    return historyLength >= 2 ? 2 : 0
  }
  // Last move was the user's.
  return 1
}

/** Convert a UCI move to standard notation (e.g. "g1f3" -> "Nf3") in the given position. */
export function uciToSan(fen: string, uci: string): string | null {
  try {
    return new Chess(fen).move(parseUci(uci)).san
  } catch {
    return null
  }
}
