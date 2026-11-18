import type { DailyGoal } from './goalStore'

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** What's left today, in words. */
export function goalStatusText(g: DailyGoal): string {
  if (g.off) return 'No daily goal set.'
  // The streak itself sits next to this text, so it isn't repeated here.
  if (g.met) return 'Done for today.'
  const left: string[] = []
  if (g.done.games < g.goal.games) left.push(plural(g.goal.games - g.done.games, 'game'))
  if (g.done.puzzles < g.goal.puzzles) left.push(plural(g.goal.puzzles - g.done.puzzles, 'puzzle'))
  return `${left.join(' and ')} to go ${g.streak > 0 ? 'to keep your streak' : 'to start a streak'}.`
}
