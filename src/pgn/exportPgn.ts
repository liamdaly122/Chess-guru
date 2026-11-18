import { Chess } from 'chess.js'
import { parseUci } from '../chess/moves'
import type { Score } from '../chess/score'
import type { PlyReview } from '../review/types'
import type { GameRecord } from '../storage/types'
import { RATING_SYMBOL, RATING_WORD } from '../review/ratingWords'

/** "[%eval 0.32]" or "[%eval #-3]", the format Lichess and most PGN tools understand. White's view. */
export function evalTag(s: Score): string {
  if (s.kind === 'cp') return `[%eval ${(s.cp / 100).toFixed(2)}]`
  const n = s.forUs ? s.moves : -s.moves
  return `[%eval #${n}]`
}

function pgnDate(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

/** Comments can't contain "}" in PGN, and stray newlines make files hard to read. */
function clean(text: string): string {
  return text.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim()
}

/** The comment written after one move: eval, then rating, best move and coaching note. */
export function moveComment(p: PlyReview): string {
  const parts: string[] = []
  if (p.evalAfter) parts.push(evalTag(p.evalAfter))
  const j = p.judgement
  if (j) {
    parts.push(`${RATING_WORD[j.rating]} (${RATING_SYMBOL[j.rating]}).`)
    if (j.bestSan && j.bestUci !== p.uci && j.rating !== 'book') parts.push(`Best was ${j.bestSan}.`)
    parts.push(`Winning chances ${Math.round(j.winBefore)}% to ${Math.round(j.winAfter)}%.`)
  }
  if (p.note) parts.push(p.note.text, `Next time: ${p.note.tip}`)
  return clean(parts.join(' '))
}

/** Build a PGN for a saved game, with ratings and coaching notes as move comments. */
export function buildPgn(game: GameRecord): string {
  const chess = game.startFen ? new Chess(game.startFen) : new Chess()
  chess.setHeader('Event', game.source === 'bot' ? 'Chess Guru vs bot' : 'Lichess game')
  chess.setHeader('Site', game.url ?? 'Chess Guru')
  chess.setHeader('Date', pgnDate(game.endedAt))
  chess.setHeader('White', game.white.name)
  chess.setHeader('Black', game.black.name)
  chess.setHeader('Result', game.result)
  if (game.white.rating) chess.setHeader('WhiteElo', String(game.white.rating))
  if (game.black.rating) chess.setHeader('BlackElo', String(game.black.rating))
  if (game.opening) chess.setHeader('Opening', game.opening)
  chess.setHeader('Termination', game.termination)
  if (game.review?.accuracy != null) chess.setHeader('Annotator', `Chess Guru (accuracy ${Math.round(game.review.accuracy)}%)`)
  if (game.startFen) {
    chess.setHeader('SetUp', '1')
    chess.setHeader('FEN', game.startFen)
  }

  game.moves.forEach((uci, i) => {
    chess.move(parseUci(uci))
    const p = game.review?.plies[i]
    if (p) {
      const c = moveComment(p)
      if (c) chess.setComment(c)
    }
  })
  // No line wrapping: chess.js would break "[%eval 0.37]" tags across lines.
  return chess.pgn()
}
