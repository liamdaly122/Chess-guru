import type { Chess, Color } from 'chess.js'

export type GameResult = '1-0' | '0-1' | '1/2-1/2'

export type GameOverReason =
  | 'checkmate'
  | 'stalemate'
  | 'threefold repetition'
  | 'fifty-move rule'
  | 'insufficient material'

export type GameStatus =
  | { over: false; turn: Color; inCheck: boolean }
  | { over: true; result: GameResult; reason: GameOverReason; winner: Color | null }

/** Work out whether the game has ended, and why. */
export function getGameStatus(game: Chess): GameStatus {
  const turn = game.turn()
  if (game.isCheckmate()) {
    const winner: Color = turn === 'w' ? 'b' : 'w'
    return { over: true, result: winner === 'w' ? '1-0' : '0-1', reason: 'checkmate', winner }
  }
  if (game.isStalemate()) return draw('stalemate')
  if (game.isInsufficientMaterial()) return draw('insufficient material')
  if (game.isThreefoldRepetition()) return draw('threefold repetition')
  if (game.isDrawByFiftyMoves()) return draw('fifty-move rule')
  return { over: false, turn, inCheck: game.inCheck() }
}

function draw(reason: GameOverReason): GameStatus {
  return { over: true, result: '1/2-1/2', reason, winner: null }
}

/** Plain-English description of the status from the user's point of view. */
export function describeStatus(status: GameStatus, userColor: Color): string {
  if (!status.over) {
    const whose = status.turn === userColor ? 'Your move' : 'Bot is thinking'
    return status.inCheck ? `${whose} (check)` : whose
  }
  if (status.reason === 'checkmate') {
    return status.winner === userColor ? 'Checkmate. You win!' : 'Checkmate. The bot wins.'
  }
  return `Draw by ${status.reason}.`
}
