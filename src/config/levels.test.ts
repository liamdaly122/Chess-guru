import { describe, expect, it } from 'vitest'
import { botName, ENGINE_ELO_MAX, ENGINE_ELO_MIN, LEVELS, stockfishSettings, type StockfishSettings } from './levels'

function checkStockfish(s: StockfishSettings, rating: number) {
  if (s.kind === 'elo') {
    expect(s.elo).toBeGreaterThanOrEqual(ENGINE_ELO_MIN)
    expect(s.elo).toBeLessThanOrEqual(ENGINE_ELO_MAX)
  } else {
    // Skill settings are only needed below the UCI_Elo minimum.
    expect(rating).toBeLessThan(ENGINE_ELO_MIN)
    expect(s.skill).toBeGreaterThanOrEqual(0)
    expect(s.skill).toBeLessThanOrEqual(20)
    expect(s.randomMoveChance).toBeGreaterThanOrEqual(0)
    expect(s.randomMoveChance).toBeLessThanOrEqual(1)
  }
}

describe('LEVELS', () => {
  it('is sorted by rating with no duplicates', () => {
    const ratings = LEVELS.map((l) => l.rating)
    expect([...ratings].sort((a, b) => a - b)).toEqual(ratings)
    expect(new Set(ratings).size).toBe(ratings.length)
  })

  it('uses Maia from 400 to 1800 and Stockfish from 2000', () => {
    for (const l of LEVELS) {
      expect(l.engine.kind === 'maia').toBe(l.rating <= 1800)
      expect(botName(l)).toBe(l.rating <= 1800 ? 'Maia' : 'Stockfish')
    }
  })

  it('plays Maia at the level rating', () => {
    for (const l of LEVELS) if (l.engine.kind === 'maia') expect(l.engine.elo).toBe(l.rating)
  })

  it('only uses Stockfish settings the engine supports, including Maia fallbacks', () => {
    for (const l of LEVELS) checkStockfish(stockfishSettings(l), l.rating)
  })
})
