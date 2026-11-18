import { Chess, type Move } from 'chess.js'
import type { MoveJudgement } from '../chess/classify'
import { winPercent } from '../chess/score'
import { GREAT_MOVE_GAP } from '../config/coach'
import type { PositionAnalysis } from '../engine/uciInfo'
import { other, PIECE_NAME, type PlacedPiece } from '../patterns/board'
import { findForks } from '../patterns/forks'
import { findHangingPieces, type HangingPiece } from '../patterns/hanging'
import { findLineTactics, type LineTactic } from '../patterns/lines'

/**
 * Why a good move was good. Like the mistake facts, everything here comes from the engine or the
 * pattern detectors: the move gives checkmate, forces mate, wins a loose piece, makes a fork or
 * pin, rescues an attacked piece, was the only good move, or is a sound sacrifice.
 */
export type GoodFact =
  | { type: 'checkmate' }
  | { type: 'forced-mate'; mateIn: number }
  | { type: 'sacrifice'; material: number }
  | { type: 'wins-material'; piece: HangingPiece }
  | { type: 'fork'; forker: PlacedPiece; targets: PlacedPiece[] }
  | { type: 'line'; tactic: LineTactic }
  | { type: 'saves-piece'; piece: HangingPiece; moved: boolean }
  | { type: 'only-move' }
  | { type: 'castles' }
  | { type: 'develops'; piece: PlacedPiece['type'] }

const BACK_RANK = { w: '1', b: '8' } as const

export function goodFacts(move: Move, judgement: MoveJudgement, before: PositionAnalysis, sacrifice = 0): GoodFact[] {
  const out: GoodFact[] = []
  const you = move.color
  const after = new Chess(move.after)

  if (after.isCheckmate()) return [{ type: 'checkmate' }]
  if (judgement.scoreAfter.kind === 'mate' && judgement.scoreAfter.forUs) out.push({ type: 'forced-mate', mateIn: judgement.scoreAfter.moves })
  if (judgement.rating === 'brilliant' && sacrifice > 0) out.push({ type: 'sacrifice', material: sacrifice })

  // Took a piece that was loose (the opponent's piece was hanging on the target square).
  const won = findHangingPieces(move.before, other(you)).find((h) => h.square === move.to)
  if (move.captured && won) out.push({ type: 'wins-material', piece: won })

  for (const f of findForks(move.after, you, move.to)) if (f.targets.length >= 2) out.push({ type: 'fork', forker: f.forker, targets: f.targets })
  for (const t of findLineTactics(move.after, you, move.to)) out.push({ type: 'line', tactic: t })

  // One of your pieces was attacked and isn't any more.
  const nowHanging = new Set(findHangingPieces(move.after, you).map((h) => h.square))
  const saved = findHangingPieces(move.before, you)
    .filter((h) => h.loss >= 2)
    .find((h) => (h.square === move.from ? !nowHanging.has(move.to) : !nowHanging.has(h.square)))
  if (saved) out.push({ type: 'saves-piece', piece: saved, moved: saved.square === move.from })

  const [top, second] = before.lines
  if (top && second && winPercent(top.score) - winPercent(second.score) >= GREAT_MOVE_GAP && judgement.played === judgement.bestMove) {
    out.push({ type: 'only-move' })
  }
  if (move.isKingsideCastle() || move.isQueensideCastle()) out.push({ type: 'castles' })
  if ((move.piece === 'n' || move.piece === 'b') && move.from[1] === BACK_RANK[you] && !move.captured) out.push({ type: 'develops', piece: move.piece })
  return out
}

function pieceList(pieces: PlacedPiece[]): string {
  const names = pieces.map((p) => (p.type === 'k' ? 'king' : `${PIECE_NAME[p.type]} on ${p.square}`))
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function sentence(f: GoodFact): string {
  switch (f.type) {
    case 'checkmate':
      return 'Checkmate.'
    case 'forced-mate':
      return f.mateIn <= 1 ? 'This sets up checkmate next move.' : `This forces checkmate in ${f.mateIn}.`
    case 'sacrifice':
      return `It gives up ${f.material === 1 ? 'a pawn' : `${f.material} pawns' worth of material`}, and the engine says it works.`
    case 'wins-material':
      return `It wins the ${PIECE_NAME[f.piece.type]} on ${f.piece.square}, which was ${f.piece.defenders === 0 ? 'undefended' : 'not defended enough'}.`
    case 'fork':
      return `The ${PIECE_NAME[f.forker.type]} attacks the ${pieceList(f.targets)} at once.`
    case 'line':
      return f.tactic.kind === 'pin'
        ? `It pins the ${PIECE_NAME[f.tactic.front.type]} to the ${PIECE_NAME[f.tactic.back.type]} behind it.`
        : `It skewers the ${PIECE_NAME[f.tactic.front.type]}: when it moves, the ${PIECE_NAME[f.tactic.back.type]} behind it can be taken.`
    case 'saves-piece':
      return f.moved
        ? `It moves your attacked ${PIECE_NAME[f.piece.type]} to safety.`
        : `It saves your ${PIECE_NAME[f.piece.type]} on ${f.piece.square}, which was under attack.`
    case 'only-move':
      return 'It was the only good move here: the next best choice was much worse.'
    case 'castles':
      return 'Castling gets your king safe and brings a rook towards the centre.'
    case 'develops':
      return `It brings your ${PIECE_NAME[f.piece]} into play.`
  }
}

/**
 * One or two sentences on why the move was good, or null if there's nothing specific to say
 * (the screen then just names the rating).
 */
export function writeWhy(facts: GoodFact[]): string | null {
  if (facts.length === 0) return null
  // Tactics first, then the "only move" note; development and castling only on their own.
  const quiet = (t: GoodFact['type']) => t === 'castles' || t === 'develops'
  const tactical = facts.filter((f) => !quiet(f.type))
  const chosen = tactical.length ? tactical.slice(0, 2) : facts.slice(0, 1)
  return chosen.map(sentence).join(' ')
}
