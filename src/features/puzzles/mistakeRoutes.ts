/** Route themes: the mistakes home, today's set, more after today's set, and one pattern. */
export const MISTAKES = 'mistakes'
export const MISTAKES_TODAY = 'mistakes-today'
export const MISTAKES_MORE = 'mistakes-more'
export const MISTAKE_PATTERN_PREFIX = 'mistakes-p-'

export function isMistakesRoute(theme: string | undefined): boolean {
  return !!theme && (theme === MISTAKES || theme.startsWith(`${MISTAKES}-`))
}
