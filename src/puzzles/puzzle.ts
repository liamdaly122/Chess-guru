import { Chess, type Color } from 'chess.js'
import { parseUci } from '../chess/moves'

export interface Puzzle {
  id: string
  /** Position before the opponent's move that sets up the puzzle. */
  fen: string
  /** UCI moves: the opponent's set-up move, then the solution (yours and their replies). */
  moves: string[]
  rating: number
  themes: string[]
}

/** The compact form stored in src/data/puzzles.json. */
export type RawPuzzle = [string, string, string, number, string]

export function parsePuzzles(raw: RawPuzzle[]): Puzzle[] {
  return raw.map(([id, fen, moves, rating, themes]) => ({
    id,
    fen,
    moves: moves.split(' '),
    rating,
    themes: themes ? themes.split(' ') : [],
  }))
}

let loading: Promise<Puzzle[]> | null = null

/** Loads the puzzle set on first use (a separate download). */
export function loadPuzzles(): Promise<Puzzle[]> {
  loading ??= import('../data/puzzles.json').then((m) => parsePuzzles(m.default as unknown as RawPuzzle[]))
  return loading
}

/**
 * Pick a puzzle near `rating` with one of `themes` (any theme if empty), skipping `exclude`.
 * Starts within 100 points and widens the window until something fits.
 */
export function selectPuzzle(
  puzzles: Puzzle[],
  opts: { rating: number; themes?: string[]; exclude?: Set<string>; random?: () => number },
): Puzzle | null {
  const { rating, themes = [], exclude = new Set(), random = Math.random } = opts
  const fits = (p: Puzzle) => !exclude.has(p.id) && (themes.length === 0 || p.themes.some((t) => themes.includes(t)))
  for (const window of [100, 200, 400, 800, Infinity]) {
    const pool = puzzles.filter((p) => fits(p) && Math.abs(p.rating - rating) <= window)
    if (pool.length) return pool[Math.floor(random() * pool.length)]
  }
  return null
}

export interface PuzzleState {
  puzzle: Puzzle
  /** Current position. */
  fen: string
  /** Index in puzzle.moves of the move the user must find next. */
  next: number
  /** The side the user plays. */
  userColor: Color
  status: 'playing' | 'solved'
  /** Wrong tries so far. Any wrong try means the puzzle counts as failed for the rating. */
  wrong: number
  /** Last move played on the board (for highlighting). */
  lastMove: { from: string; to: string } | null
}

function play(fen: string, uci: string): { fen: string; from: string; to: string; mate: boolean } {
  const chess = new Chess(fen)
  const m = chess.move(parseUci(uci))
  return { fen: chess.fen(), from: m.from, to: m.to, mate: chess.isCheckmate() }
}

/** Start a puzzle: play the opponent's set-up move. The user plays the other side. */
export function startPuzzle(puzzle: Puzzle): PuzzleState {
  const first = play(puzzle.fen, puzzle.moves[0])
  return {
    puzzle,
    fen: first.fen,
    next: 1,
    userColor: new Chess(first.fen).turn(),
    status: 'playing',
    wrong: 0,
    lastMove: { from: first.from, to: first.to },
  }
}

export type MoveResult = 'correct' | 'wrong' | 'solved' | 'illegal'

/**
 * Check the user's move. The solution move is accepted, and so is any move that gives
 * checkmate (Lichess does the same, since a different mate is just as good).
 * After a correct move the opponent's reply is played automatically.
 */
export function tryPuzzleMove(state: PuzzleState, uci: string): { state: PuzzleState; result: MoveResult } {
  if (state.status !== 'playing') return { state, result: 'illegal' }
  let played
  try {
    played = play(state.fen, uci)
  } catch {
    return { state, result: 'illegal' }
  }
  const expected = state.puzzle.moves[state.next]
  const correct = uci === expected || played.mate
  if (!correct) return { state: { ...state, wrong: state.wrong + 1 }, result: 'wrong' }

  const after = state.next + 1
  if (played.mate || after >= state.puzzle.moves.length) {
    return {
      state: { ...state, fen: played.fen, next: after, status: 'solved', lastMove: { from: played.from, to: played.to } },
      result: 'solved',
    }
  }
  const reply = play(played.fen, state.puzzle.moves[after])
  return {
    state: { ...state, fen: reply.fen, next: after + 1, lastMove: { from: reply.from, to: reply.to } },
    result: 'correct',
  }
}

/** Play the next solution move for the user (the "show solution" button). */
export function revealNextMove(state: PuzzleState): PuzzleState {
  if (state.status !== 'playing') return state
  const { state: next } = tryPuzzleMove({ ...state }, state.puzzle.moves[state.next])
  // Revealing counts as a wrong try so the rating isn't rewarded.
  return { ...next, wrong: Math.max(next.wrong, 1) }
}

/** The solution move the user should play now (for hints). */
export function expectedMove(state: PuzzleState): { from: string; to: string } | null {
  const uci = state.puzzle.moves[state.next]
  return uci ? { from: uci.slice(0, 2), to: uci.slice(2, 4) } : null
}

/** Elo-style update of the user's puzzle rating. A puzzle counts as solved only with no wrong tries. */
export function updatePuzzleRating(rating: number, puzzleRating: number, solved: boolean, k = 32): number {
  const expected = 1 / (1 + 10 ** ((puzzleRating - rating) / 400))
  return Math.round(rating + k * ((solved ? 1 : 0) - expected))
}
