import type { Fact } from '../coach/facts'
import type { LessonCategory } from '../review/types'

/**
 * Mistake patterns: a finer grouping than the lesson categories, taken from the coaching fact
 * behind each mistake (for example which piece did the forking). Used to group your mistake
 * puzzles so the same mistake is practised as one pattern instead of one puzzle per game.
 * Keys are lowercase words joined by hyphens, so they can go in a URL.
 */
export const PATTERNS = {
  'loose-piece': {
    label: 'Leaving pieces unprotected',
    tip: 'Before each move, check which of your pieces are attacked and whether they are defended enough.',
  },
  'fork-knight': {
    label: 'Walking into knight forks',
    tip: 'Look at every square an enemy knight can reach in one move, and what it would attack from there.',
  },
  'fork-queen': {
    label: 'Walking into queen forks',
    tip: 'A queen check that also attacks a loose piece is a fork. Keep pieces protected when the enemy queen is active.',
  },
  'fork-pawn': {
    label: 'Walking into pawn forks',
    tip: 'Keep your pieces off squares that a pawn push could attack two at a time.',
  },
  fork: {
    label: 'Walking into forks',
    tip: 'Look for squares where an enemy piece could attack two of yours at once, especially with check.',
  },
  pin: {
    label: 'Getting pinned',
    tip: 'Be careful when a piece stands in front of your king or queen on a line an enemy bishop, rook or queen can use.',
  },
  skewer: {
    label: 'Getting skewered',
    tip: 'Keep your valuable pieces off the same line, where a bishop, rook or queen can attack both.',
  },
  'pin-skewer': {
    label: 'Pins and skewers against you',
    tip: 'Notice when two of your pieces stand on the same line as an enemy bishop, rook or queen.',
  },
  'ignored-threat': {
    label: "Missing your opponent's threat",
    tip: 'After each of your opponent\'s moves, ask: what does that move threaten?',
  },
  'allowed-mate': {
    label: 'Allowing checkmate',
    tip: 'Before you move, look at every check your opponent could give next.',
  },
  'missed-free-piece': {
    label: 'Missing free material',
    tip: 'Each move, look for enemy pieces that are attacked and not defended enough.',
  },
  'missed-fork': {
    label: 'Missing a fork',
    tip: 'Look for a move that attacks two enemy pieces at once, especially with check.',
  },
  'missed-pin-skewer': {
    label: 'Missing a pin or skewer',
    tip: 'When two enemy pieces stand on one line, see if a bishop, rook or queen can attack along it.',
  },
  'missed-tactic': {
    label: 'Missing a winning tactic',
    tip: 'Before a quiet move, look at checks, captures and threats first.',
  },
  'missed-mate': {
    label: 'Missing a checkmate',
    tip: 'When the enemy king is exposed, look at every check before anything else.',
  },
  general: {
    label: 'Other slips (no simple tactic)',
    tip: 'Compare a few candidate moves before you play, and ask what each one does.',
  },
} as const satisfies Record<string, { label: string; tip: string }>

export type MistakePattern = keyof typeof PATTERNS

export function isPattern(key: string): key is MistakePattern {
  return Object.hasOwn(PATTERNS, key)
}

/** The pattern of the coaching fact behind a mistake. */
export function patternOf(fact: Fact | undefined): MistakePattern {
  if (!fact) return 'general'
  switch (fact.type) {
    case 'piece-lost':
    case 'left-hanging':
      return 'loose-piece'
    case 'allowed-fork':
      return fact.forker.type === 'n' ? 'fork-knight' : fact.forker.type === 'q' ? 'fork-queen' : fact.forker.type === 'p' ? 'fork-pawn' : 'fork'
    case 'allowed-line':
      return fact.tactic.kind
    case 'threat-ignored':
      return 'ignored-threat'
    case 'allowed-mate':
      return 'allowed-mate'
    case 'missed-capture':
      return 'missed-free-piece'
    case 'missed-fork':
      return 'missed-fork'
    case 'missed-line':
      return 'missed-pin-skewer'
    case 'missed-mate':
      return 'missed-mate'
  }
}

/** Older reviews only stored the lesson category: the closest pattern to it. */
export function patternFromCategory(c: LessonCategory): MistakePattern {
  const map: Record<LessonCategory, MistakePattern> = {
    'loose-pieces': 'loose-piece',
    forks: 'fork',
    'pins-skewers': 'pin-skewer',
    threats: 'ignored-threat',
    'king-safety': 'allowed-mate',
    'missed-tactics': 'missed-tactic',
    'missed-mates': 'missed-mate',
    general: 'general',
  }
  return map[c]
}

/** The most common pattern among a game's coaching notes (first one on a tie), or null. */
export function mainPattern(notes: readonly ({ fact?: Fact } | 'pending' | null | undefined)[]): { pattern: MistakePattern; count: number } | null {
  const counts = new Map<MistakePattern, number>()
  for (const n of notes) {
    if (!n || n === 'pending') continue
    const p = patternOf(n.fact)
    counts.set(p, (counts.get(p) ?? 0) + 1)
  }
  let best: { pattern: MistakePattern; count: number } | null = null
  for (const [pattern, count] of counts) if (!best || count > best.count) best = { pattern, count }
  return best
}
