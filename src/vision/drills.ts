import { Chess, type Color, type Square } from 'chess.js'
import { parseUci } from '../chess/moves'
import { attackersOf, COLOR_NAME, PIECE_NAME, piecesOf } from '../patterns/board'
import type { Puzzle } from '../puzzles/puzzle'

/**
 * Board vision drills: questions about a position answered without moving pieces. Every answer
 * is worked out here with chess.js and the pattern helpers, so no engine is needed.
 *  - loose:   tap every piece of yours with no defender
 *  - moves:   tap every square one piece can move to
 *  - checks:  how many checks can you give?
 *  - imagine: read a few moves without the board changing, then tap your pieces that are attacked
 */
export type VisionType = 'loose' | 'moves' | 'checks' | 'imagine'
export const VISION_TYPES: VisionType[] = ['loose', 'moves', 'checks', 'imagine']

/** Questions in a set. */
export const VISION_SET = 10

/** A drill's name, including the mixed set. */
export function drillTitle(d: VisionType | 'mixed'): string {
  return d === 'mixed' ? 'Mixed' : VISION_INFO[d].title
}

export const VISION_INFO: Record<VisionType, { title: string; about: string }> = {
  loose: { title: 'Loose pieces', about: 'Tap every piece of yours that has no defender.' },
  moves: { title: 'Where can it go?', about: 'Tap every square one piece can move to.' },
  checks: { title: 'Count the checks', about: 'Say how many checks you can give.' },
  imagine: { title: 'Imagine the moves', about: 'Read a few moves without the board changing, then tap your attacked pieces.' },
}

export interface VisionQuestion {
  type: VisionType
  /** A stable id, so the same position isn't asked twice in a set. */
  id: string
  /** The position shown. For `imagine`, the position before the moves. */
  fen: string
  /** The side the question is about (and the board's orientation). */
  color: Color
  prompt: string
  /** For `imagine`: the moves to picture, as text ("23...Nf6 24.Bc4 Nxe4"), and the position after them. */
  moves?: string
  finalFen?: string
  /** For `moves`: the piece the question is about. */
  focus?: Square
  answer: { kind: 'squares'; squares: Square[] } | { kind: 'count'; count: number; list: string[] }
}

export interface VisionResult {
  correct: boolean
  right: Square[]
  missed: Square[]
  wrong: Square[]
  text: string
}

const SIDE = (c: Color) => COLOR_NAME[c]
/** "6 or more" is the last count button. */
export const MAX_COUNT = 6

/** The puzzle's position after the opponent's set-up move: the side to move is the solver. */
function afterSetup(p: Puzzle): Chess | null {
  try {
    const g = new Chess(p.fen)
    g.move(parseUci(p.moves[0]))
    return g
  } catch {
    return null
  }
}

/** Your pieces (not the king) with no defender. */
export function undefendedPieces(fen: string, color: Color): Square[] {
  const g = new Chess(fen)
  return piecesOf(g, color)
    .filter((p) => p.type !== 'k' && attackersOf(g, p.square, color).length === 0)
    .map((p) => p.square)
    .sort()
}

/** Your pieces and pawns (not the king) attacked by the other side. */
export function attackedPieces(fen: string, color: Color): Square[] {
  const g = new Chess(fen)
  const enemy = color === 'w' ? 'b' : 'w'
  return piecesOf(g, color)
    .filter((p) => p.type !== 'k' && attackersOf(g, p.square, enemy).length > 0)
    .map((p) => p.square)
    .sort()
}

/** Legal checks for the side to move, in standard notation. */
export function checksFor(fen: string): string[] {
  return new Chess(fen)
    .moves()
    .filter((m) => m.endsWith('+') || m.endsWith('#'))
    .sort()
}

/** Moves as text with move numbers, starting from `fen`: "23...Nf6 24.Bc4 Nxe4". */
export function movesText(fen: string, uci: string[]): { text: string; finalFen: string } | null {
  const g = new Chess(fen)
  const parts: string[] = []
  try {
    for (const u of uci) {
      const n = g.moveNumber()
      const white = g.turn() === 'w'
      const san = g.move(parseUci(u)).san
      parts.push(white ? `${n}.${san}` : parts.length === 0 ? `${n}...${san}` : san)
    }
  } catch {
    return null
  }
  return { text: parts.join(' '), finalFen: g.fen() }
}

/**
 * A question of `type` from a puzzle's position, or null if this position doesn't suit it
 * (too many or too few answers, or nothing to ask). `random` picks among candidate pieces.
 */
export function makeQuestion(type: VisionType, p: Puzzle, random: () => number = Math.random): VisionQuestion | null {
  const game = afterSetup(p)
  if (!game || game.isGameOver()) return null
  const fen = game.fen()
  const color = game.turn()
  const id = `${type}:${p.id}`

  if (type === 'loose') {
    const squares = undefendedPieces(fen, color)
    if (squares.length < 1 || squares.length > 5) return null
    return {
      type, id, fen, color,
      prompt: `Tap every ${SIDE(color)} piece or pawn with no defender (not the king).`,
      answer: { kind: 'squares', squares },
    }
  }

  if (type === 'moves') {
    const candidates = piecesOf(game, color).filter((x) => {
      if (x.type === 'k' || x.type === 'p') return false
      const n = game.moves({ square: x.square }).length
      return n >= 3 && n <= 12
    })
    if (!candidates.length) return null
    const piece = candidates[Math.floor(random() * candidates.length)]
    const squares = [...new Set(game.moves({ square: piece.square, verbose: true }).map((m) => m.to as Square))].sort()
    return {
      type, id, fen, color,
      focus: piece.square,
      prompt: `Tap every square the ${PIECE_NAME[piece.type]} on ${piece.square} can move to.`,
      answer: { kind: 'squares', squares },
    }
  }

  if (type === 'checks') {
    const list = checksFor(fen)
    if (list.length > MAX_COUNT + 2) return null
    // Positions with no check at all are fine now and then, but mostly ask where there are some.
    if (list.length === 0 && random() < 0.7) return null
    return {
      type, id, fen, color,
      prompt: `${SIDE(color)} to play. How many different checks can ${SIDE(color)} give?`,
      answer: { kind: 'count', count: list.length, list },
    }
  }

  // imagine: the set-up move and the first one or two moves of the solution, from the puzzle's start.
  const count = Math.min(3, p.moves.length)
  if (count < 2) return null
  const line = movesText(p.fen, p.moves.slice(0, count))
  if (!line) return null
  const final = new Chess(line.finalFen)
  if (final.isGameOver()) return null
  const asked = final.turn()
  const squares = attackedPieces(line.finalFen, asked)
  if (squares.length < 1 || squares.length > 4) return null
  return {
    type,
    id,
    fen: p.fen,
    color: asked,
    moves: line.text,
    finalFen: line.finalFen,
    prompt: `Picture these moves: ${line.text}. Then tap every ${SIDE(asked)} piece or pawn that is attacked (not the king).`,
    answer: { kind: 'squares', squares },
  }
}

/** A set of `size` questions of one type (or mixed, taking the types in turn), from random puzzles. */
export function makeSet(type: VisionType | 'mixed', puzzles: Puzzle[], size: number, random: () => number = Math.random): VisionQuestion[] {
  const out: VisionQuestion[] = []
  const used = new Set<string>()
  for (let tries = 0; out.length < size && tries < size * 200 && puzzles.length; tries++) {
    const t = type === 'mixed' ? VISION_TYPES[out.length % VISION_TYPES.length] : type
    const p = puzzles[Math.floor(random() * puzzles.length)]
    if (used.has(p.id)) continue
    const q = makeQuestion(t, p, random)
    if (!q) continue
    used.add(p.id)
    out.push(q)
  }
  return out
}

/** Check an answer: the squares you tapped, or the number you picked. */
export function checkVision(q: VisionQuestion, given: Square[] | number): VisionResult {
  if (q.answer.kind === 'count') {
    const n = q.answer.count
    const picked = typeof given === 'number' ? given : -1
    const correct = picked === n || (picked >= MAX_COUNT && n >= MAX_COUNT)
    const list = q.answer.list.length ? `: ${q.answer.list.join(', ')}` : ''
    const text =
      n === 0
        ? `${correct ? 'Right: no' : 'There are no'} checks for ${SIDE(q.color)} here.`
        : `${correct ? 'Right: ' : ''}${SIDE(q.color)} has ${n} ${n === 1 ? 'check' : 'checks'}${list}.`
    return { correct, right: [], missed: [], wrong: [], text }
  }
  const want = new Set(q.answer.squares)
  const tapped = new Set(Array.isArray(given) ? given : [])
  const right = [...tapped].filter((s) => want.has(s)).sort()
  const missed = [...want].filter((s) => !tapped.has(s)).sort()
  const wrong = [...tapped].filter((s) => !want.has(s)).sort()
  const correct = missed.length === 0 && wrong.length === 0
  return { correct, right, missed, wrong, text: resultText(q, correct, missed, wrong) }
}

function resultText(q: VisionQuestion, correct: boolean, missed: Square[], wrong: Square[]): string {
  const fen = q.type === 'imagine' ? q.finalFen! : q.fen
  const g = new Chess(fen)
  const name = (s: Square) => {
    const p = g.get(s)
    return p ? `${PIECE_NAME[p.type]} on ${s}` : s
  }
  const all = q.answer.kind === 'squares' ? q.answer.squares : []
  if (q.type === 'moves') {
    const piece = q.focus ? name(q.focus) : 'piece'
    return correct ? `Right: the ${piece} has ${all.length} squares.` : `The ${piece} can go to ${all.join(', ')}.`
  }
  const what = q.type === 'loose' ? 'undefended' : 'attacked'
  if (correct) return `Right: ${all.length === 1 ? 'one piece is' : `${all.length} pieces are`} ${what}.`
  const parts: string[] = []
  if (missed.length) parts.push(`You missed the ${missed.map(name).join(', the ')}.`)
  if (wrong.length) parts.push(`Not ${what}: the ${wrong.map(name).join(', the ')}.`)
  return parts.join(' ')
}
