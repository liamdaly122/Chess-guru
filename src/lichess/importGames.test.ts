import { describe, expect, it, vi } from 'vitest'
import { fetchLichessGames, LichessError, parseLichessGame, type LichessGameJson } from './importGames'

const finished: LichessGameJson = {
  id: 'abcd1234',
  rated: true,
  variant: 'standard',
  speed: 'blitz',
  createdAt: 1_700_000_000_000,
  lastMoveAt: 1_700_000_300_000,
  status: 'mate',
  players: {
    white: { user: { name: 'Liam', id: 'liam' }, rating: 1450 },
    black: { user: { name: 'Opponent', id: 'opponent' }, rating: 1500 },
  },
  winner: 'black',
  opening: { name: "Bird Opening" },
  moves: 'f3 e5 g4 Qh4#',
}

describe('parseLichessGame', () => {
  it('converts a finished game', () => {
    expect(parseLichessGame(finished, 'Liam')).toEqual({
      id: 'lichess:abcd1234',
      source: 'lichess',
      endedAt: 1_700_000_300_000,
      white: { name: 'Liam', rating: 1450 },
      black: { name: 'Opponent', rating: 1500 },
      userColor: 'w',
      result: '0-1',
      termination: 'checkmate',
      startFen: undefined,
      moves: ['f2f3', 'e7e5', 'g2g4', 'd8h4'],
      url: 'https://lichess.org/abcd1234',
      speed: 'blitz',
      opening: 'Bird Opening',
    })
  })

  it('works out the user colour from the username, ignoring case', () => {
    const g = parseLichessGame(finished, 'OPPONENT')!
    expect(g.userColor).toBe('b')
    expect(g.url).toBe('https://lichess.org/abcd1234/black')
  })

  it('never imports a game that is still being played', () => {
    expect(parseLichessGame({ ...finished, status: 'started' }, 'liam')).toBeNull()
    expect(parseLichessGame({ ...finished, status: 'created' }, 'liam')).toBeNull()
  })

  it('skips aborted games, other variants, and games without the user', () => {
    expect(parseLichessGame({ ...finished, status: 'aborted' }, 'liam')).toBeNull()
    expect(parseLichessGame({ ...finished, variant: 'chess960' }, 'liam')).toBeNull()
    expect(parseLichessGame(finished, 'someone-else')).toBeNull()
  })

  it('treats games without a winner as draws', () => {
    expect(parseLichessGame({ ...finished, status: 'draw', winner: undefined }, 'liam')?.result).toBe('1/2-1/2')
  })

  it('names Lichess AI opponents', () => {
    const g = parseLichessGame(
      { ...finished, players: { ...finished.players, black: { aiLevel: 3 } } },
      'liam',
    )
    expect(g?.black.name).toBe('Stockfish level 3')
  })
})

function response(status: number, body = ''): Response {
  return new Response(body, { status })
}

describe('fetchLichessGames', () => {
  it('asks only for finished games and parses each line', async () => {
    const ongoing = { ...finished, id: 'live0001', status: 'started' }
    const body = [JSON.stringify(finished), JSON.stringify(ongoing), ''].join('\n')
    const fetchMock = vi.fn().mockResolvedValue(response(200, body))
    const { games, skipped } = await fetchLichessGames('Liam', 20, fetchMock)
    expect(games.map((g) => g.id)).toEqual(['lichess:abcd1234'])
    expect(skipped).toBe(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/games/user/Liam?')
    expect(url).toContain('ongoing=false')
    expect(url).toContain('finished=true')
    expect(init.headers.Accept).toBe('application/x-ndjson')
  })

  it('explains a missing user and rate limiting', async () => {
    await expect(fetchLichessGames('nobody', 5, vi.fn().mockResolvedValue(response(404)))).rejects.toThrow(
      'Lichess has no user called “nobody”.',
    )
    await expect(fetchLichessGames('liam', 5, vi.fn().mockResolvedValue(response(429)))).rejects.toThrow(
      /slow down/,
    )
  })

  it('rejects usernames that cannot exist without calling Lichess', async () => {
    const fetchMock = vi.fn()
    await expect(fetchLichessGames('bad name!', 5, fetchMock)).rejects.toBeInstanceOf(LichessError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
