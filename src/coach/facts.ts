import { Chess, type Move } from 'chess.js'
import type { MoveJudgement } from '../chess/classify'
import { parseUci, uciToSan } from '../chess/moves'
import { COACH } from '../config/coach'
import type { PositionAnalysis } from '../engine/uciInfo'
import { other, type PlacedPiece } from '../patterns/board'
import { findForks } from '../patterns/forks'
import { findHangingPieces, type HangingPiece } from '../patterns/hanging'
import { findLineTactics, type LineTactic } from '../patterns/lines'
import { findUnansweredThreat, nullMoveFen } from '../patterns/threats'

/**
 * One thing our code found out about a move. Every field comes from the engine's analysis
 * or from the pattern detectors, never from guesswork.
 * "you" is the player who made the move; "opponent" is the other side.
 */
export type Fact =
  | { type: 'missed-mate'; mateIn: number; bestSan: string }
  | { type: 'allowed-mate'; mateIn: number; replySan: string }
  | { type: 'piece-lost'; piece: HangingPiece; captureSan: string }
  | { type: 'allowed-fork'; replySan: string; forker: PlacedPiece; targets: PlacedPiece[] }
  | { type: 'allowed-line'; replySan: string; tactic: LineTactic }
  | { type: 'threat-ignored'; threatSan: string }
  | { type: 'missed-capture'; bestSan: string; piece: HangingPiece }
  | { type: 'missed-fork'; bestSan: string; forker: PlacedPiece; targets: PlacedPiece[] }
  | { type: 'missed-line'; bestSan: string; tactic: LineTactic }
  | { type: 'left-hanging'; piece: HangingPiece }

/** Everything the coach knows about one move, in a form that is easy to check and to test. */
export interface CoachFacts {
  fen: string
  moveSan: string
  bestSan: string | null
  rating: MoveJudgement['rating']
  winBefore: number
  winAfter: number
  /** Engine's best line from the position before the move, in standard notation. */
  bestLineSan: string[]
  /** Engine's best line for the opponent after the move. */
  replyLineSan: string[]
  /** Most important first. */
  facts: Fact[]
}

export interface MoveContext {
  move: Move
  judgement: MoveJudgement
  before: PositionAnalysis
  after: PositionAnalysis
  /** Analysis of the null-move position, used to find threats. Omit if not available. */
  nullMove?: PositionAnalysis
}

/** Convert an engine line (UCI) into standard notation, stopping at the first illegal move. */
export function lineToSan(fen: string, uciMoves: string[], max = 6): string[] {
  const game = new Chess(fen)
  const out: string[] = []
  for (const uci of uciMoves.slice(0, max)) {
    try {
      out.push(game.move(parseUci(uci)).san)
    } catch {
      break
    }
  }
  return out
}

/** Play one UCI move on a FEN and return the move and resulting FEN, or null if illegal. */
function play(fen: string, uci: string | null): { move: Move; fen: string } | null {
  if (!uci) return null
  try {
    const game = new Chess(fen)
    const move = game.move(parseUci(uci))
    return { move, fen: game.fen() }
  } catch {
    return null
  }
}

export function buildFacts(ctx: MoveContext): CoachFacts {
  const { move, judgement, before, after } = ctx
  const you = move.color
  const opponent = other(you)
  const facts: Fact[] = []

  const bestSan = judgement.bestMove ? uciToSan(move.before, judgement.bestMove) : null
  const bestLineSan = lineToSan(move.before, before.lines[0]?.pv ?? [])
  const replyLineSan = lineToSan(move.after, after.lines[0]?.pv ?? [])
  const replySan = replyLineSan[0] ?? null
  const playedBest = judgement.played === judgement.bestMove

  // Forced mates first: nothing else matters as much.
  if (judgement.mateRule === 'missed-mate' && judgement.scoreBefore.kind === 'mate' && bestSan) {
    facts.push({ type: 'missed-mate', mateIn: judgement.scoreBefore.moves, bestSan })
  }
  if (judgement.mateRule === 'allowed-mate' && judgement.scoreAfter.kind === 'mate' && replySan) {
    facts.push({ type: 'allowed-mate', mateIn: judgement.scoreAfter.moves, replySan })
  }

  // What the opponent's best reply does.
  const yourHanging = findHangingPieces(move.after, you)
  const reply = play(move.after, after.bestMove)
  if (reply && replySan) {
    const lost = yourHanging.find((h) => h.square === reply.move.to)
    if (lost) facts.push({ type: 'piece-lost', piece: lost, captureSan: replySan })

    for (const f of findForks(reply.fen, opponent, reply.move.to)) {
      facts.push({ type: 'allowed-fork', replySan, forker: f.forker, targets: f.targets })
    }
    for (const t of findLineTactics(reply.fen, opponent, reply.move.to)) {
      facts.push({ type: 'allowed-line', replySan, tactic: t })
    }
  }

  // A threat that was already there before the move and is still there after it.
  if (ctx.nullMove) {
    const nullFen = nullMoveFen(move.before)
    const top = ctx.nullMove.lines[0]
    if (nullFen && top) {
      const threat = findUnansweredThreat(
        judgement.scoreBefore,
        top.score,
        ctx.nullMove.bestMove,
        after.bestMove,
        COACH.threatMinGain,
      )
      const threatSan = threat ? uciToSan(nullFen, threat.move) : null
      if (threatSan) facts.push({ type: 'threat-ignored', threatSan })
    }
  }

  // What you missed with the best move.
  if (!playedBest && bestSan) {
    const best = play(move.before, judgement.bestMove)
    if (best) {
      const theirHanging = findHangingPieces(move.before, opponent).find((h) => h.square === best.move.to)
      if (theirHanging) facts.push({ type: 'missed-capture', bestSan, piece: theirHanging })
      for (const f of findForks(best.fen, you, best.move.to)) {
        facts.push({ type: 'missed-fork', bestSan, forker: f.forker, targets: f.targets })
      }
      for (const t of findLineTactics(best.fen, you, best.move.to)) {
        facts.push({ type: 'missed-line', bestSan, tactic: t })
      }
    }
  }

  // A piece left hanging that the engine's reply doesn't take straight away.
  const lostSquare = facts.find((f) => f.type === 'piece-lost')
  const stillHanging = yourHanging.find(
    (h) => h.loss >= 2 && !(lostSquare?.type === 'piece-lost' && lostSquare.piece.square === h.square),
  )
  if (stillHanging) facts.push({ type: 'left-hanging', piece: stillHanging })

  return {
    fen: move.before,
    moveSan: move.san,
    bestSan,
    rating: judgement.rating,
    winBefore: judgement.winBefore,
    winAfter: judgement.winAfter,
    bestLineSan,
    replyLineSan,
    facts: facts.sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type]),
  }
}

const PRIORITY: Record<Fact['type'], number> = {
  'missed-mate': 0,
  'allowed-mate': 1,
  'piece-lost': 2,
  'allowed-fork': 3,
  'allowed-line': 4,
  'threat-ignored': 5,
  'missed-capture': 6,
  'missed-fork': 7,
  'missed-line': 8,
  'left-hanging': 9,
}

