import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LICHESS_SYNC } from '../config/lichess'
import { clearReviewQueue, reviewQueue } from '../review/reviewQueue'
import { resetDbForTests } from '../storage/db'
import { listGames } from '../storage/games'
import { checkForNewGames, getSync, markSeen, updateSync } from './autoSync'
import type { LichessGameJson } from './importGames'

const DAY = 24 * 60 * 60 * 1000
const T0 = 1_700_000_000_000

const game = (id: string, createdAt: number): LichessGameJson => ({
  id,
  variant: 'standard',
  createdAt,
  lastMoveAt: createdAt + 60_000,
  status: 'mate',
  players: {
    white: { user: { name: 'Liam', id: 'liam' } },
    black: { user: { name: 'Opp', id: 'opp' } },
  },
  winner: 'white',
  moves: 'e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#',
})

/** A fake Lichess that answers with these games, and records each URL asked for. */
function lichess(...games: LichessGameJson[]) {
  return vi.fn(async (_url: string | URL | Request) => new Response(games.map((g) => JSON.stringify(g)).join('\n'), { status: 200 }))
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  resetDbForTests()
  clearReviewQueue()
})

describe('automatic Lichess import', () => {
  it('does nothing until it is switched on', async () => {
    const f = lichess(game('aaaa0001', T0))
    expect(await checkForNewGames({ now: T0, fetchImpl: f })).toBeNull()
    await updateSync({ username: 'Liam', auto: false })
    expect(await checkForNewGames({ now: T0, fetchImpl: f })).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })

  it('first imports recent games, then only newer ones, at most every few minutes', async () => {
    await updateSync({ username: 'Liam', auto: true })
    const first = lichess(game('aaaa0001', T0), game('aaaa0002', T0 - DAY))
    expect(await checkForNewGames({ now: T0, fetchImpl: first })).toEqual({ added: 2 })
    const url1 = String(first.mock.calls[0][0])
    expect(url1).toContain(`max=${LICHESS_SYNC.firstImport}`)
    expect(url1).toContain('ongoing=false')
    expect(url1).not.toContain('since=')
    expect(await getSync()).toMatchObject({ lastCheckAt: T0, lastCreatedAt: T0, lastAdded: 2, unseen: 2 })

    // Too soon: no request.
    const soon = lichess()
    expect(await checkForNewGames({ now: T0 + 60_000, fetchImpl: soon })).toBeNull()
    expect(soon).not.toHaveBeenCalled()

    // Later: asks from the newest game's start, minus the overlap; games already here don't count.
    const later = T0 + LICHESS_SYNC.minMinutesBetweenChecks * 60_000
    const second = lichess(game('aaaa0003', T0 + DAY), game('aaaa0001', T0))
    expect(await checkForNewGames({ now: later, fetchImpl: second })).toEqual({ added: 1 })
    const url2 = String(second.mock.calls[0][0])
    expect(url2).toContain(`since=${T0 - LICHESS_SYNC.overlapDays * DAY}`)
    expect(url2).toContain(`max=${LICHESS_SYNC.maxPerCheck}`)
    expect((await listGames()).map((g) => g.id)).toEqual(['lichess:aaaa0003', 'lichess:aaaa0001', 'lichess:aaaa0002'])
    expect(await getSync()).toMatchObject({ lastCreatedAt: T0 + DAY, lastAdded: 1, unseen: 3 })

    await markSeen()
    expect((await getSync())?.unseen).toBe(0)
  })

  it('"Check now" works even when automatic import is off', async () => {
    await updateSync({ username: 'Liam', auto: false })
    expect(await checkForNewGames({ force: true, now: T0, fetchImpl: lichess(game('aaaa0001', T0)) })).toEqual({ added: 1 })
  })

  it('records an error and tries again later', async () => {
    await updateSync({ username: 'Liam', auto: true })
    const down = vi.fn(async () => new Response('', { status: 429 }))
    expect(await checkForNewGames({ now: T0, fetchImpl: down })).toMatchObject({ added: 0, error: expect.stringMatching(/slow down/) })
    expect(await getSync()).toMatchObject({ lastCheckAt: T0, lastError: expect.stringMatching(/slow down/) })
    const ok = await checkForNewGames({ now: T0 + DAY, fetchImpl: lichess(game('aaaa0001', T0)) })
    expect(ok).toEqual({ added: 1 })
    expect((await getSync())?.lastError).toBeUndefined()
  })

  it('queues new games for review when automatic review is on', async () => {
    await updateSync({ username: 'Liam', auto: true, autoReview: true })
    await checkForNewGames({ now: T0, fetchImpl: lichess(game('aaaa0001', T0), game('aaaa0002', T0 - DAY)) })
    expect(reviewQueue()).toEqual(['lichess:aaaa0001', 'lichess:aaaa0002'])
  })

  it('starts afresh for a different username', async () => {
    await updateSync({ username: 'Liam', auto: true })
    await checkForNewGames({ now: T0, fetchImpl: lichess(game('aaaa0001', T0)) })
    const s = await updateSync({ username: 'SomeoneElse', auto: true })
    expect(s).toEqual({ username: 'SomeoneElse', auto: true, autoReview: false })
    expect(await updateSync({ username: 'someoneelse', autoReview: true })).toMatchObject({ auto: true, autoReview: true })
  })
})
