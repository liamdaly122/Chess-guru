import { Chess } from 'chess.js'
import type { GameRecord } from '../storage/types'

/**
 * Imports finished games from Lichess's public API for review.
 * Imported games are only ever reviewed after they have finished. Ongoing games are never
 * requested (ongoing=false) and any game whose status says it is still in progress is dropped,
 * so this can't be used to get help during a live game.
 */

/** The fields we use from Lichess's game JSON (see lichess-org/api, schemas/GameJson.yaml). */
export interface LichessGameJson {
  id: string
  rated?: boolean
  variant: string
  speed?: string
  createdAt?: number
  lastMoveAt?: number
  status: string
  players: {
    white: { user?: { name: string; id: string }; rating?: number; aiLevel?: number }
    black: { user?: { name: string; id: string }; rating?: number; aiLevel?: number }
  }
  initialFen?: string
  winner?: 'white' | 'black'
  opening?: { name?: string }
  moves?: string
}

/** Statuses that mean the game is not over (or never really started). Never imported. */
const NOT_FINISHED = new Set(['created', 'started', 'aborted', 'noStart'])

const TERMINATION: Record<string, string> = {
  mate: 'checkmate',
  resign: 'resignation',
  stalemate: 'stalemate',
  timeout: 'time',
  outoftime: 'time',
  draw: 'draw',
  insufficientMaterialClaim: 'insufficient material',
  cheat: 'fair play',
  unknownFinish: 'unknown',
}

export const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/

function playerName(p: LichessGameJson['players']['white']): string {
  if (p.user) return p.user.name
  if (p.aiLevel) return `Stockfish level ${p.aiLevel}`
  return 'Anonymous'
}

/** Convert one Lichess game into our format. Returns null for games we don't import. */
export function parseLichessGame(json: LichessGameJson, username: string): GameRecord | null {
  if (NOT_FINISHED.has(json.status)) return null
  if (json.variant !== 'standard' && json.variant !== 'fromPosition') return null

  const me = username.toLowerCase()
  const userColor = json.players.white.user?.id === me ? 'w' : json.players.black.user?.id === me ? 'b' : null
  if (!userColor) return null

  const startFen = json.variant === 'fromPosition' && json.initialFen ? json.initialFen : undefined
  const chess = startFen ? new Chess(startFen) : new Chess()
  const moves: string[] = []
  for (const san of (json.moves ?? '').split(' ').filter(Boolean)) {
    try {
      moves.push(chess.move(san).lan)
    } catch {
      return null
    }
  }
  if (moves.length === 0) return null

  const result = json.winner === 'white' ? '1-0' : json.winner === 'black' ? '0-1' : '1/2-1/2'
  return {
    id: `lichess:${json.id}`,
    source: 'lichess',
    endedAt: json.lastMoveAt ?? json.createdAt ?? Date.now(),
    white: { name: playerName(json.players.white), rating: json.players.white.rating },
    black: { name: playerName(json.players.black), rating: json.players.black.rating },
    userColor,
    result,
    termination: TERMINATION[json.status] ?? json.status,
    startFen,
    moves,
    url: `https://lichess.org/${json.id}${userColor === 'b' ? '/black' : ''}`,
    speed: json.speed,
    opening: json.opening?.name,
  }
}

export class LichessError extends Error {}

/**
 * Download a user's most recent finished games. Lichess sends one JSON object per line.
 * Lichess asks API users to make one request at a time and to wait a minute after a 429.
 */
export async function fetchLichessGames(
  username: string,
  max: number,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<{ games: GameRecord[]; skipped: number }> {
  const name = username.trim()
  if (!USERNAME_PATTERN.test(name)) throw new LichessError('That doesn’t look like a Lichess username.')
  const url =
    `https://lichess.org/api/games/user/${encodeURIComponent(name)}` +
    `?max=${max}&moves=true&opening=true&ongoing=false&finished=true`

  let res: Response
  try {
    res = await fetchImpl(url, { headers: { Accept: 'application/x-ndjson' }, signal })
  } catch {
    throw new LichessError('Couldn’t reach Lichess. Check your connection and try again.')
  }
  if (res.status === 404) throw new LichessError(`Lichess has no user called “${name}”.`)
  if (res.status === 429) throw new LichessError('Lichess asked us to slow down. Wait a minute and try again.')
  if (!res.ok) throw new LichessError(`Lichess returned an error (${res.status}). Try again later.`)

  const text = await res.text()
  const games: GameRecord[] = []
  let skipped = 0
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let json: LichessGameJson
    try {
      json = JSON.parse(line)
    } catch {
      skipped++
      continue
    }
    const g = parseLichessGame(json, name)
    if (g) games.push(g)
    else skipped++
  }
  return { games, skipped }
}
