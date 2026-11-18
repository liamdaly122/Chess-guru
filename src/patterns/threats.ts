import { Chess } from 'chess.js'
import { negate, winPercent, type Score } from '../chess/score'

/**
 * The same position with the other side to move (a "null move"). The engine analyses this
 * to find what the opponent is threatening: their best move if we did nothing.
 * Returns null when the side to move is in check, because passing would be illegal.
 */
export function nullMoveFen(fen: string): string | null {
  const game = new Chess(fen)
  if (game.inCheck()) return null
  const parts = fen.split(' ')
  parts[1] = parts[1] === 'w' ? 'b' : 'w'
  parts[3] = '-' // no en passant after a pass
  const flipped = parts.join(' ')
  try {
    // Reject anything chess.js considers invalid. Never send an invalid FEN to Stockfish.
    new Chess(flipped)
    return flipped
  } catch {
    return null
  }
}

export interface Threat {
  /** Opponent's threatening move, UCI. */
  move: string
  /** How many Win% points the threat would gain the opponent if ignored. */
  gain: number
}

/**
 * Work out whether the opponent had a threat before our move, and whether our move ignored it.
 *
 * @param moverScoreBefore engine score of the real position, from the mover's side.
 * @param nullMoveScore engine score of the null-move position, from the opponent's side.
 * @param nullMoveBest the opponent's best move in the null-move position (the threat).
 * @param opponentBestReply the opponent's best reply after our actual move.
 * @param minGain how big (in Win% points) a threat must be to count.
 */
export function findUnansweredThreat(
  moverScoreBefore: Score,
  nullMoveScore: Score,
  nullMoveBest: string | null,
  opponentBestReply: string | null,
  minGain: number,
): Threat | null {
  if (!nullMoveBest || !opponentBestReply) return null
  const opponentNow = winPercent(negate(moverScoreBefore))
  const opponentIfWePass = winPercent(nullMoveScore)
  const gain = opponentIfWePass - opponentNow
  if (gain < minGain) return null
  // The threat is still on after our move if the opponent's best reply is the same move.
  if (opponentBestReply.slice(0, 4) !== nullMoveBest.slice(0, 4)) return null
  return { move: nullMoveBest, gain }
}
