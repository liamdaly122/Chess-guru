import { describe, expect, it } from 'vitest'
import type { GameRecord } from '../../storage/types'
import { groupGames } from './gameGroups'

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime()
const g = (id: string, endedAt: number, result: GameRecord['result'] = '1-0') =>
  ({ id, endedAt, result, userColor: 'w' }) as GameRecord

describe('games list groups', () => {
  it('groups by today, yesterday, the last week, then month', () => {
    const now = at(2026, 11, 18)
    const groups = groupGames(
      [g('a', at(2026, 11, 18)), g('b', at(2026, 11, 17), '0-1'), g('c', at(2026, 11, 13)), g('d', at(2026, 11, 2), '1/2-1/2'), g('e', at(2026, 10, 30))],
      now,
    )
    expect(groups.map((x) => [x.games.map((y) => y.id).join(''), x.won, x.lost, x.drawn])).toEqual([
      ['a', 1, 0, 0],
      ['b', 0, 1, 0],
      ['c', 1, 0, 0],
      ['d', 0, 0, 1],
      ['e', 1, 0, 0],
    ])
    expect(groups.slice(0, 3).map((x) => x.label)).toEqual(['Today', 'Yesterday', 'Last 7 days'])
    expect(groups[3].label).toMatch(/November|11/)
    expect(groups[4].label).toMatch(/October|10/)
  })
})
