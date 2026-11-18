import { describe, expect, it } from 'vitest'
import { ENGINE_ELO_MAX, ENGINE_ELO_MIN, LEVELS } from './levels'

describe('LEVELS', () => {
  it('is sorted by rating with no duplicates', () => {
    const ratings = LEVELS.map((l) => l.rating)
    expect([...ratings].sort((a, b) => a - b)).toEqual(ratings)
    expect(new Set(ratings).size).toBe(ratings.length)
  })

  it('only uses UCI_Elo values the engine supports', () => {
    for (const l of LEVELS) {
      if (l.engine.kind === 'elo') {
        expect(l.engine.elo).toBeGreaterThanOrEqual(ENGINE_ELO_MIN)
        expect(l.engine.elo).toBeLessThanOrEqual(ENGINE_ELO_MAX)
      }
    }
  })

  it('uses Skill Level settings only below the UCI_Elo minimum', () => {
    for (const l of LEVELS) {
      if (l.engine.kind === 'skill') {
        expect(l.rating).toBeLessThan(ENGINE_ELO_MIN)
        expect(l.engine.skill).toBeGreaterThanOrEqual(0)
        expect(l.engine.skill).toBeLessThanOrEqual(20)
        expect(l.engine.randomMoveChance).toBeGreaterThanOrEqual(0)
        expect(l.engine.randomMoveChance).toBeLessThanOrEqual(1)
      }
    }
  })
})
