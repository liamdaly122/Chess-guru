import { Chess } from 'chess.js'
import { parseUci } from '../chess/moves'
import { piecesOf, VALUE } from './board'
import { see } from './see'

/**
 * How much material a move offers up, in pawns: the most the opponent can win by capturing
 * straight after it, minus anything the move itself captured. 0 if the move gives nothing away.
 * Used to spot brilliant moves (a sacrifice the engine says is the best move).
 */
export function sacrificedMaterial(fenBefore: string, uci: string): number {
  const game = new Chess(fenBefore)
  let move
  try {
    move = game.move(parseUci(uci))
  } catch {
    return 0
  }
  const fenAfter = game.fen()
  const opponent = game.turn()
  let maxLoss = 0
  for (const p of piecesOf(game, move.color)) {
    if (p.type === 'k') continue
    maxLoss = Math.max(maxLoss, see(fenAfter, p.square, opponent))
  }
  const captured = move.captured ? VALUE[move.captured] : 0
  return Math.max(0, maxLoss - captured)
}
