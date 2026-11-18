import { dayKey, previousDay } from '../../goal/streak'
import { outcomeOf } from '../../storage/gameInfo'
import type { GameRecord } from '../../storage/types'

export interface GameGroup {
  /** "Today", "Yesterday", "Last 7 days", or a month such as "October 2026". */
  label: string
  games: GameRecord[]
  won: number
  lost: number
  drawn: number
}

const MONTH = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })

/** Games (newest first) grouped for the games list: today, yesterday, the last week, then by month. */
export function groupGames(games: GameRecord[], now = Date.now()): GameGroup[] {
  const today = dayKey(now)
  const yesterday = previousDay(today)
  let weekStart = yesterday
  for (let i = 0; i < 5; i++) weekStart = previousDay(weekStart)

  const groups: GameGroup[] = []
  for (const g of [...games].sort((a, b) => b.endedAt - a.endedAt)) {
    const day = dayKey(g.endedAt)
    const label =
      day >= today ? 'Today' : day === yesterday ? 'Yesterday' : day >= weekStart ? 'Last 7 days' : MONTH.format(new Date(g.endedAt))
    let group = groups[groups.length - 1]
    if (!group || group.label !== label) {
      group = { label, games: [], won: 0, lost: 0, drawn: 0 }
      groups.push(group)
    }
    group.games.push(g)
    const o = outcomeOf(g)
    if (o === 'win') group.won++
    else if (o === 'loss') group.lost++
    else if (o === 'draw') group.drawn++
  }
  return groups
}
