import type { Fact } from '../coach/facts'
import type { Lesson, LessonCategory, PlyReview } from './types'

/** Which lesson group a coaching fact belongs to. */
export function categoryOf(fact: Fact['type'] | undefined): LessonCategory {
  switch (fact) {
    case 'piece-lost':
    case 'left-hanging':
      return 'loose-pieces'
    case 'allowed-fork':
      return 'forks'
    case 'allowed-line':
      return 'pins-skewers'
    case 'threat-ignored':
      return 'threats'
    case 'allowed-mate':
      return 'king-safety'
    case 'missed-capture':
    case 'missed-fork':
    case 'missed-line':
      return 'missed-tactics'
    case 'missed-mate':
      return 'missed-mates'
    default:
      return 'general'
  }
}

const TEXT: Record<LessonCategory, { title: string; what: (n: number) => string; tip: string }> = {
  'loose-pieces': {
    title: 'Keep your pieces protected',
    what: (n) => `${times(n, 'You left a piece where it could be taken')}`,
    tip: 'Before each move, check which of your pieces are attacked and whether they are defended enough.',
  },
  forks: {
    title: 'Watch out for forks',
    what: (n) => `${times(n, 'You allowed a fork')}`,
    tip: 'Look for squares where an enemy piece could attack two of yours at once, especially knights and checks.',
  },
  'pins-skewers': {
    title: 'Mind your lines',
    what: (n) => `${times(n, 'You allowed a pin or skewer')}`,
    tip: 'Keep your king and queen off lines that enemy bishops, rooks and queens can reach.',
  },
  threats: {
    title: "Ask what your opponent wants",
    what: (n) => `${times(n, "You missed what your opponent was threatening")}`,
    tip: 'After every move your opponent makes, ask yourself what they want to do next.',
  },
  'king-safety': {
    title: 'Guard your king',
    what: (n) => `${times(n, 'You allowed a forced mate')}`,
    tip: 'Before you move, look at every check your opponent could give next.',
  },
  'missed-tactics': {
    title: 'Look for your own tactics',
    what: (n) => `${times(n, 'You missed a move that won material')}`,
    tip: 'Each move, look for checks, captures and attacks on undefended pieces.',
  },
  'missed-mates': {
    title: 'Look for checkmate',
    what: (n) => `${times(n, 'You missed a forced mate')}`,
    tip: 'When the enemy king is exposed, look at every check before anything else.',
  },
  general: {
    title: 'Compare candidate moves',
    what: (n) => `${times(n, 'A move cost you a lot of winning chances without an obvious tactic')}`,
    tip: 'Before you commit, compare two or three candidate moves and pick the safest good one.',
  },
}

function times(n: number, sentence: string): string {
  return n === 1 ? `${sentence} once` : `${sentence} ${n} times`
}

function moveLabel(ply: number, p: PlyReview): string {
  return `${Math.floor(ply / 2) + 1}.${p.color === 'b' ? '..' : ''} ${p.san}`
}

/**
 * The biggest lessons from the user's mistakes and blunders: group them by kind,
 * rank the groups by total winning chances lost, and keep the top `max`.
 */
export function buildLessons(plies: PlyReview[], max = 3): Lesson[] {
  const groups = new Map<LessonCategory, { plies: number[]; winLost: number }>()
  plies.forEach((p, i) => {
    if (!p.note || !p.judgement) return
    const g = groups.get(p.note.category) ?? { plies: [], winLost: 0 }
    g.plies.push(i)
    g.winLost += Math.max(0, p.judgement.winBefore - p.judgement.winAfter)
    groups.set(p.note.category, g)
  })

  return [...groups.entries()]
    .sort((a, b) => b[1].winLost - a[1].winLost)
    .slice(0, max)
    .map(([category, g]) => {
      const t = TEXT[category]
      const examples = g.plies.slice(0, 3).map((i) => moveLabel(i, plies[i]))
      return {
        category,
        title: t.title,
        text: `${t.what(g.plies.length)} (${examples.join(', ')}).`,
        tip: t.tip,
        plies: g.plies,
        winLost: g.winLost,
      }
    })
}
