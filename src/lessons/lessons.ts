import type { MistakePattern } from '../puzzles/patterns'
import { CATEGORY_THEMES } from '../puzzles/themes'
import type { LessonCategory } from '../review/types'
import type { GameRecord } from '../storage/types'

/**
 * Short lessons, one per kind of mistake the coach finds (the lesson categories). The text
 * describes general technique in plain words; anything about a particular position (the example
 * from your games) comes from the stored review, which came from the engine.
 */
export interface Lesson {
  category: LessonCategory
  title: string
  /** What the mistake is, in two or three sentences. */
  intro: string
  /** Signs to look for. */
  spot: string[]
  /** What to ask before every move. */
  checklist: string[]
  /** Puzzle themes for the practice set. */
  themes: string[]
  /** Your mistake patterns of this kind (for "your own positions"). */
  patterns: MistakePattern[]
}

export const LESSONS: Record<LessonCategory, Lesson> = {
  'loose-pieces': {
    category: 'loose-pieces',
    title: 'Keep your pieces protected',
    intro:
      'Most games at club level are lost by simply leaving a piece where it can be taken. A piece is loose when it is attacked more times than it is defended, or attacked by something cheaper than itself.',
    spot: [
      'After your opponent moves, look at every square their pieces can now reach.',
      'Count attackers and defenders on each of your pieces that is attacked.',
      'A piece defended once but attacked by a pawn or minor piece is still in trouble if it is worth more.',
    ],
    checklist: ['Which of my pieces are attacked?', 'Does my move leave anything undefended?', 'Can they win something with a capture or a check?'],
    themes: CATEGORY_THEMES['loose-pieces'],
    patterns: ['loose-piece'],
  },
  forks: {
    category: 'forks',
    title: 'Watch out for forks',
    intro:
      'A fork is one piece attacking two of yours at once. You can only save one, so you lose the other. Knights are the classic forkers because they jump and their attacks are easy to miss, but queens and pawns fork too.',
    spot: [
      'Pieces lined up a knight jump apart, especially your king and queen, or king and rook.',
      'Undefended pieces: any enemy move that attacks one of them and something else is a fork.',
      'Checks that also attack a piece: you must deal with the check first.',
    ],
    checklist: ['Which squares can their knights reach next move?', 'Does any check also hit a loose piece?', 'Are my valuable pieces a knight jump apart?'],
    themes: CATEGORY_THEMES.forks,
    patterns: ['fork-knight', 'fork-queen', 'fork-pawn', 'fork'],
  },
  'pins-skewers': {
    category: 'pins-skewers',
    title: 'Pins and skewers',
    intro:
      'Bishops, rooks and queens attack along lines. When two of your pieces stand on the same line, the one in front can be pinned (it cannot move without exposing the one behind) or skewered (it has to move, and the one behind is taken).',
    spot: [
      'Your king or queen on the same file, rank or diagonal as another of your pieces.',
      "An open line between their bishop, rook or queen and your pieces.",
      'A pinned piece is not really defending anything: check what it is supposed to guard.',
    ],
    checklist: ['Are two of my pieces on one line with an enemy long-range piece?', 'Is the piece I rely on as a defender pinned?', 'Can I step off the line before they use it?'],
    themes: CATEGORY_THEMES['pins-skewers'],
    patterns: ['pin', 'skewer', 'pin-skewer'],
  },
  threats: {
    category: 'threats',
    title: "Notice your opponent's threats",
    intro:
      'Every move your opponent makes wants something. If you only think about your own plans, their threat lands next move. Spotting it is half the work; the other half is finding a move that deals with it.',
    spot: [
      'Ask after every enemy move: what does that move attack, and what does it make possible?',
      'Pieces that suddenly line up against your king or a loose piece.',
      'A quiet-looking move that adds a second attacker to something.',
    ],
    checklist: ['What is my opponent threatening right now?', 'Does my planned move stop it, or at least not make it worse?', 'If I ignore it, is my own threat bigger?'],
    themes: CATEGORY_THEMES.threats,
    patterns: ['ignored-threat'],
  },
  'king-safety': {
    category: 'king-safety',
    title: 'Guard your king',
    intro:
      'A king without defenders can be mated even when you are ahead in material. Back-rank mates, checks on open lines and queen attacks near the king all start from a king left short of shelter.',
    spot: [
      'Your king on the back rank with all the pawns in front of it still at home.',
      'Pawns in front of your castled king pushed or swapped off.',
      'Enemy queen and pieces gathering on one side of the board.',
    ],
    checklist: ['What checks can they give next move?', 'Does my king have a safe square (an escape square)?', 'Am I taking defenders away from my king?'],
    themes: CATEGORY_THEMES['king-safety'],
    patterns: ['allowed-mate'],
  },
  'missed-tactics': {
    category: 'missed-tactics',
    title: 'Look for your own tactics',
    intro:
      'Sometimes the mistake is a chance not taken: a free piece, a fork or a pin that was there for you. Strong players find these because they look at forcing moves first: checks, captures and threats.',
    spot: [
      'Enemy pieces that are undefended or defended fewer times than you attack them.',
      'Enemy pieces a knight jump apart, or lined up on one line.',
      'Their king exposed or stuck on the back rank.',
    ],
    checklist: ['What checks do I have?', 'What captures do I have, and are they safe?', 'Can I attack two things at once?'],
    themes: CATEGORY_THEMES['missed-tactics'],
    patterns: ['missed-free-piece', 'missed-fork', 'missed-pin-skewer', 'missed-tactic'],
  },
  'missed-mates': {
    category: 'missed-mates',
    title: 'Finish the game: find the mate',
    intro:
      'A missed checkmate is the most expensive kind of missed tactic. When the enemy king is short of squares, the winning move is often a check, even one that looks like it gives material away.',
    spot: [
      'The enemy king with few or no free squares.',
      'Your queen or rook able to reach the king with check.',
      'Their back rank with no escape square.',
    ],
    checklist: ['Can I give check? List every check.', 'After each check, where can the king go?', 'Is there a check that leaves it no squares at all?'],
    themes: CATEGORY_THEMES['missed-mates'],
    patterns: ['missed-mate'],
  },
  general: {
    category: 'general',
    title: 'Choose between candidate moves',
    intro:
      'Not every costly move has a simple tactic behind it. Often the position just needed a better plan, and the first move that came to mind was not it. The cure is to compare a few candidates before you commit.',
    spot: [
      'You played quickly in a position with no obvious move.',
      'You moved a piece that was already doing a job.',
      'You made a move without a purpose, just to do something.',
    ],
    checklist: ['What are two or three sensible moves here?', 'What does each one do, and what does it allow?', 'Which of my pieces is doing the least? Can it do more?'],
    themes: CATEGORY_THEMES.general,
    patterns: ['general'],
  },
}

export const LESSON_ORDER: LessonCategory[] = [
  'loose-pieces',
  'forks',
  'pins-skewers',
  'threats',
  'king-safety',
  'missed-tactics',
  'missed-mates',
  'general',
]

export function isLessonCategory(s: string): s is LessonCategory {
  return (LESSON_ORDER as string[]).includes(s)
}

export interface LessonExample {
  gameId: string
  ply: number
  /** Position before your move. */
  fen: string
  playedSan: string
  playedUci: string
  bestSan: string | null
  bestUci: string | null
  note: string
  winLost: number
  opponent: string
  gameDate: number
}

/** Your costliest mistake of this kind in your reviewed games, to show as the lesson's example. */
export function lessonExample(games: GameRecord[], category: LessonCategory): LessonExample | null {
  let best: LessonExample | null = null
  for (const g of games) {
    if (!g.review?.complete) continue
    g.review.plies.forEach((p, ply) => {
      const j = p.judgement
      if (p.color !== g.userColor || !j || !p.note || p.note.category !== category) return
      const winLost = j.winBefore - j.winAfter
      if (best && winLost <= best.winLost) return
      const opp = g.userColor === 'w' ? g.black : g.white
      best = {
        gameId: g.id,
        ply,
        fen: p.fenBefore,
        playedSan: p.san,
        playedUci: p.uci,
        bestSan: j.bestSan,
        bestUci: j.bestUci,
        note: p.note.text,
        winLost,
        opponent: opp.name,
        gameDate: g.endedAt,
      }
    })
  }
  return best
}

/** How many of your mistakes (in reviewed games) were of each kind. */
export function lessonCounts(games: GameRecord[]): Record<LessonCategory, { times: number; winLost: number }> {
  const out = Object.fromEntries(LESSON_ORDER.map((c) => [c, { times: 0, winLost: 0 }])) as Record<LessonCategory, { times: number; winLost: number }>
  for (const g of games) {
    if (!g.review?.complete) continue
    for (const p of g.review.plies) {
      if (p.color !== g.userColor || !p.note || !p.judgement) continue
      out[p.note.category].times++
      out[p.note.category].winLost += Math.max(0, p.judgement.winBefore - p.judgement.winAfter)
    }
  }
  return out
}

/** Lessons, your costliest kind of mistake first (then the usual order). */
export function lessonsByNeed(games: GameRecord[]): LessonCategory[] {
  const counts = lessonCounts(games)
  return [...LESSON_ORDER].sort((a, b) => counts[b].winLost - counts[a].winLost || LESSON_ORDER.indexOf(a) - LESSON_ORDER.indexOf(b))
}
