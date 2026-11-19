import { describe, expect, it } from 'vitest'
import { parseHash, routeHref } from './route'

describe('routes', () => {
  it('parses each page', () => {
    expect(parseHash('')).toEqual({ name: 'play' })
    expect(parseHash('#/')).toEqual({ name: 'play' })
    expect(parseHash('#/games')).toEqual({ name: 'games' })
    expect(parseHash('#/review/lichess%3Aabc')).toEqual({ name: 'review', id: 'lichess:abc' })
    expect(parseHash('#/progress')).toEqual({ name: 'progress' })
    expect(parseHash('#/puzzles')).toEqual({ name: 'train' })
    expect(parseHash('#/puzzles/fork')).toEqual({ name: 'train', theme: 'fork' })
    expect(parseHash('#/puzzles/openings-lines')).toEqual({ name: 'train', theme: 'openings-lines' })
    expect(routeHref({ name: 'train', theme: 'mateIn2' })).toBe('#/train/mateIn2')
    expect(parseHash('#/train/lesson-forks')).toEqual({ name: 'train', theme: 'lesson-forks' })
    expect(parseHash('#/train')).toEqual({ name: 'train' })
    expect(parseHash('#/report')).toEqual({ name: 'report' })
    expect(parseHash('#/openings')).toEqual({ name: 'openings' })
    expect(parseHash('#/train/openings')).toEqual({ name: 'train', theme: 'openings' })
    expect(parseHash('#/report/2026-11-16')).toEqual({ name: 'report', week: '2026-11-16' })
    expect(routeHref({ name: 'report', week: '2026-11-16' })).toBe('#/report/2026-11-16')
    expect(parseHash('#/nonsense')).toEqual({ name: 'play' })
  })

  it('round-trips review ids with special characters', () => {
    const id = 'lichess:abc/def'
    expect(parseHash(routeHref({ name: 'review', id }))).toEqual({ name: 'review', id })
  })
})
