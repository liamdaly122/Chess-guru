import { Chess, type Color } from 'chess.js'
import { parseUci, uciToSan } from '../chess/moves'
import { negate, winPercent, type Score } from '../chess/score'
import { THREAT_QUIZ } from '../config/threatQuiz'
import type { PositionAnalysis } from '../engine/uciInfo'
import { COLOR_NAME, other, PIECE_NAME, type PlacedPiece } from '../patterns/board'
import { findForks } from '../patterns/forks'
import { findHangingPieces } from '../patterns/hanging'
import { findLineTactics } from '../patterns/lines'
import { nullMoveFen } from '../patterns/threats'

/**
 * "What does my opponent want?" A question about the position on your turn: if you passed,
 * what would your opponent play? Worked out from two engine searches: the real position and
 * the null-move position (the same position with your opponent to move).
 */
export interface ThreatQuestion {
  fen: string
  nullFen: string
  kind: 'threat' | 'quiet'
  opponent: Color
  /** Your opponent's best move if you passed (UCI), for a threat. */
  move: string | null
  san: string | null
  /** Moves that count as the answer: the threat, and the second line if it is a real threat too. */
  accepted: string[]
  /** Win% your opponent would gain if you passed. */
  gain: number
  /** Your Win% in the real position. */
  yourWin: number
  /** What the coach says when showing the answer. */
  explanation: string
}

export type ThreatVerdict = 'right' | 'close' | 'wrong'

/** The question for a position, or null when it isn't a clear case either way. */
export function threatQuestion(fen: string, real: PositionAnalysis, nullMove: PositionAnalysis): ThreatQuestion | null {
  const nullFen = nullMoveFen(fen)
  const now = real.lines[0]
  const top = nullMove.lines[0]
  if (!nullFen || !now || !top || nullMove.fen !== nullFen) return null
  const you = new Chess(fen).turn()
  const opponent = other(you)
  const theirNow = winPercent(negate(now.score))
  const gain = winPercent(top.score) - theirNow
  const yourWin = winPercent(now.score)
  const base = { fen, nullFen, opponent, gain, yourWin }

  if (gain < THREAT_QUIZ.quietBelow) {
    return {
      ...base,
      kind: 'quiet',
      move: null,
      san: null,
      accepted: [],
      explanation: `${COLOR_NAME[opponent]} has no real threat here: nothing they could play next would hurt you much. You're free to follow your own plan.`,
    }
  }
  if (gain < THREAT_QUIZ.minGain) return null

  const move = top.pv[0] ?? nullMove.bestMove
  const san = move ? uciToSan(nullFen, move) : null
  if (!move || !san) return null
  const accepted = [move]
  const second = nullMove.lines[1]
  if (second?.pv[0] && winPercent(second.score) - theirNow >= THREAT_QUIZ.minGain) accepted.push(second.pv[0])
  return {
    ...base,
    kind: 'threat',
    move,
    san,
    accepted,
    explanation: describeThreat(fen, nullFen, move, san, top.score, theirNow),
  }
}

/** Whether to ask now. `sinceLast` is your moves since the last question (Infinity if none yet). */
export function shouldAskThreat(q: ThreatQuestion, ctx: { sinceLast: number }): boolean {
  if (new Chess(q.fen).moveNumber() < THREAT_QUIZ.fromMove) return false
  if (q.yourWin < THREAT_QUIZ.minWin || q.yourWin > THREAT_QUIZ.maxWin) return false
  return ctx.sinceLast >= (q.kind === 'threat' ? THREAT_QUIZ.threatEvery : THREAT_QUIZ.quietEvery)
}

/** Check your answer: one of your opponent's moves (UCI) in the null-move position, or 'none'. */
export function checkThreatAnswer(q: ThreatQuestion, answer: string | 'none'): ThreatVerdict {
  if (q.kind === 'quiet') return answer === 'none' ? 'right' : 'wrong'
  if (answer === 'none' || !q.move) return 'wrong'
  if (q.accepted.some((m) => m.slice(0, 4) === answer.slice(0, 4))) return 'right'
  // Any checkmate counts, like in puzzles.
  try {
    const game = new Chess(q.nullFen)
    game.move(parseUci(answer))
    if (game.isCheckmate()) return 'right'
  } catch {
    return 'wrong'
  }
  if (answer.slice(0, 2) === q.move.slice(0, 2) || answer.slice(2, 4) === q.move.slice(2, 4)) return 'close'
  return 'wrong'
}

/**
 * The position after your answer (one of your opponent's moves in the null-move position), to
 * check with the engine whether it is a real threat too. Null for "none" or an illegal move.
 */
export function positionAfterAnswer(q: ThreatQuestion, answer: string | 'none'): string | null {
  if (answer === 'none') return null
  try {
    const game = new Chess(q.nullFen)
    game.move(parseUci(answer))
    return game.isGameOver() ? null : game.fen()
  } catch {
    return null
  }
}

/** Whether the engine's look at the position after your answer shows it is a real threat as well. */
export function answerIsThreatToo(q: ThreatQuestion, after: PositionAnalysis): boolean {
  const top = after.lines[0]
  if (!top || q.kind !== 'threat') return false
  // You are to move after their move, so the score is from your side.
  const theirs = 100 - winPercent(top.score)
  return theirs - (100 - q.yourWin) >= THREAT_QUIZ.minGain
}

/** The coach's reply to your answer. */
export function threatAnswerText(q: ThreatQuestion, verdict: ThreatVerdict, answer: string | 'none'): { title: string; text: string } {
  const them = COLOR_NAME[q.opponent]
  const after = ' Now find your move.'
  if (q.kind === 'quiet') {
    if (verdict === 'right') return { title: 'Right, no real threat', text: q.explanation }
    const san = answer === 'none' ? null : uciToSan(q.nullFen, answer)
    return { title: 'Not a real threat', text: `${san ? `${san} wouldn't hurt you much. ` : ''}${q.explanation}` }
  }
  if (verdict === 'right') {
    const different = answer !== 'none' && !q.accepted.some((m) => m.slice(0, 4) === answer.slice(0, 4))
    const san = different ? uciToSan(q.nullFen, answer) : null
    if (different && san && !q.explanation.includes(`${san},`)) {
      return { title: 'That works too', text: `${san} would be a real threat as well. The engine's first choice: ${q.explanation.replace(/^(White|Black) threatens /, '')}${after}` }
    }
    return { title: 'Well spotted', text: q.explanation + after }
  }
  if (answer === 'none') return { title: `${them} does have a threat`, text: q.explanation + after }
  if (verdict === 'close') {
    const samePiece = answer.slice(0, 2) === q.move?.slice(0, 2)
    return { title: samePiece ? 'Right piece, wrong square' : 'Right square, wrong piece', text: q.explanation + after }
  }
  return { title: 'Not quite', text: q.explanation + after }
}

function describeThreat(fen: string, nullFen: string, move: string, san: string, score: Score, theirNow: number): string {
  const opponent = new Chess(nullFen).turn()
  const you = other(opponent)
  const them = COLOR_NAME[opponent]
  const game = new Chess(nullFen)
  const played = game.move(parseUci(move))
  const afterFen = game.fen()

  if (game.isCheckmate()) return `${them} threatens ${san}, checkmate.`
  if (score.kind === 'mate' && score.forUs) return `${them} threatens ${san}, starting a forced mate in ${score.moves}.`
  const lost = findHangingPieces(fen, you).find((h) => h.square === played.to)
  if (lost) return `${them} threatens ${san}, winning your ${PIECE_NAME[lost.type]} on ${lost.square}.`
  const fork = findForks(afterFen, opponent, played.to)[0]
  if (fork) return `${them} threatens ${san}: the ${PIECE_NAME[fork.forker.type]} would attack your ${list(fork.targets)} at once.`
  const line = findLineTactics(afterFen, opponent, played.to)[0]
  if (line) {
    return line.kind === 'pin'
      ? `${them} threatens ${san}, pinning your ${PIECE_NAME[line.front.type]} to your ${PIECE_NAME[line.back.type]}.`
      : `${them} threatens ${san}, skewering your ${PIECE_NAME[line.front.type]}: when it moves, your ${PIECE_NAME[line.back.type]} behind it can be taken.`
  }
  if (played.promotion) return `${them} threatens ${san}, making a new ${PIECE_NAME[played.promotion]}.`
  return `${them} threatens ${san}. If you ignored it, their winning chances would go from ${Math.round(theirNow)}% to ${Math.round(winPercent(score))}%.`
}

function list(pieces: PlacedPiece[]): string {
  const names = pieces.map((p) => (p.type === 'k' ? 'king' : `${PIECE_NAME[p.type]} on ${p.square}`))
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
