import { Chess } from 'chess.js'
import { describe, expect, it, vi } from 'vitest'
import { findLevel } from '../config/levels'
import { BotOpponent } from './BotOpponent'
import type { MaiaEngine, MaiaStatus } from './MaiaEngine'
import type { OpponentEngine } from './OpponentEngine'

const START = new Chess().fen()

function fakeStockfish(move = 'd2d4'): OpponentEngine & { chooseMove: ReturnType<typeof vi.fn> } {
  return {
    whenReady: async () => {},
    newGame: async () => {},
    chooseMove: vi.fn(async () => move),
    dispose: () => {},
  }
}

function fakeMaia(behaviour: { move?: string; fail?: boolean; status?: MaiaStatus['state'] }) {
  const maia = {
    getStatus: (): MaiaStatus =>
      behaviour.status === 'failed' ? { state: 'failed', message: 'x' } : { state: 'ready' },
    onStatus: () => () => {},
    load: vi.fn(async () => {}),
    move: vi.fn(async () => {
      if (behaviour.fail) throw new Error('boom')
      return behaviour.move ?? 'e2e4'
    }),
    dispose: () => {},
  }
  return maia as unknown as MaiaEngine & { move: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn> }
}

describe('BotOpponent', () => {
  it('asks Maia at the level rating, passing the earlier positions', async () => {
    const sf = fakeStockfish()
    const maia = fakeMaia({ move: 'e2e4' })
    const bot = new BotOpponent(sf, () => maia)
    const move = await bot.chooseMove(START, findLevel(1200), undefined, ['earlier'])
    expect(move).toBe('e2e4')
    expect(maia.move).toHaveBeenCalledWith(START, 1200, ['earlier'])
    expect(sf.chooseMove).not.toHaveBeenCalled()
  })

  it('starts loading Maia when a Maia game starts', async () => {
    const maia = fakeMaia({})
    const bot = new BotOpponent(fakeStockfish(), () => maia)
    await bot.newGame(findLevel(800))
    expect(maia.load).toHaveBeenCalled()
  })

  it('uses Stockfish for strong levels without touching Maia', async () => {
    const sf = fakeStockfish('g1f3')
    const make = vi.fn(() => fakeMaia({}))
    const bot = new BotOpponent(sf, make)
    await bot.newGame(findLevel(2200))
    expect(await bot.chooseMove(START, findLevel(2200))).toBe('g1f3')
    expect(make).not.toHaveBeenCalled()
  })

  it('falls back to Stockfish when Maia fails', async () => {
    const sf = fakeStockfish('d2d4')
    const bot = new BotOpponent(sf, () => fakeMaia({ fail: true }))
    expect(await bot.chooseMove(START, findLevel(600))).toBe('d2d4')
    expect(sf.chooseMove).toHaveBeenCalled()
  })

  it('falls back to Stockfish when Maia could not load at all', async () => {
    const maia = fakeMaia({ status: 'failed' })
    const sf = fakeStockfish('d2d4')
    const bot = new BotOpponent(sf, () => maia)
    expect(await bot.chooseMove(START, findLevel(600))).toBe('d2d4')
    expect(maia.move).not.toHaveBeenCalled()
  })

  it('never plays an illegal move from Maia', async () => {
    const sf = fakeStockfish('d2d4')
    const bot = new BotOpponent(sf, () => fakeMaia({ move: 'e2e5' }))
    expect(await bot.chooseMove(START, findLevel(1000))).toBe('d2d4')
  })
})
