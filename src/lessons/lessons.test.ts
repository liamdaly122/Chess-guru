import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { PATTERNS } from '../puzzles/patterns'
import { THEME_LABEL } from '../puzzles/themes'
import type { LessonCategory, PlyReview } from '../review/types'
import { resetDbForTests } from '../storage/db'
import type { GameRecord } from '../storage/types'
import { getLessonRecords, recordLessonSet } from './lessonStore'
import { LESSON_ORDER, LESSONS, lessonCounts, lessonExample, lessonsByNeed } from './lessons'

function game(id: string, mistakes: [LessonCategory, number][]): GameRecord {
  const plies: PlyReview[] = mistakes.map(([category, lost], i) => ({
    san: `m${i}`,
    uci: 'e2e4',
    color: 'w',
    fenBefore: `fen${id}${i}`,
    fenAfter: '',
    evalAfter: null,
    judgement: { rating: 'blunder', bestUci: 'd2d4', bestSan: 'd4', winBefore: 60, winAfter: 60 - lost, scoreBefore: { kind: 'cp', cp: 0 }, scoreAfter: { kind: 'cp', cp: 0 }, bestLineSan: [] },
    note: { text: `note ${id}${i}`, tip: 't', category },
  }))
  return { id, source: 'bot', endedAt: 1, white: { name: 'You' }, black: { name: 'Maia' }, userColor: 'w', result: '0-1', termination: 'checkmate', moves: [], review: { startEval: null, plies, accuracy: 50, lessons: [], complete: true } }
}

describe('lessons', () => {
  it('has a complete lesson for every kind of mistake, with real themes and patterns', () => {
    for (const c of LESSON_ORDER) {
      const l = LESSONS[c]
      expect(l.category).toBe(c)
      expect(l.spot.length).toBeGreaterThan(1)
      expect(l.checklist.length).toBeGreaterThan(1)
      for (const t of l.themes) expect(THEME_LABEL[t], t).toBeDefined()
      for (const p of l.patterns) expect(PATTERNS[p], p).toBeDefined()
    }
    // Every pattern belongs to exactly one lesson.
    const all = LESSON_ORDER.flatMap((c) => LESSONS[c].patterns)
    expect(new Set(all).size).toBe(all.length)
    expect([...all].sort()).toEqual(Object.keys(PATTERNS).sort())
  })

  it('counts your mistakes by kind and puts the costliest first', () => {
    const games = [game('a', [['forks', 30], ['loose-pieces', 10]]), game('b', [['forks', 20], ['missed-mates', 40]])]
    expect(lessonCounts(games).forks).toEqual({ times: 2, winLost: 50 })
    expect(lessonsByNeed(games).slice(0, 3)).toEqual(['forks', 'missed-mates', 'loose-pieces'])
  })

  it('picks your costliest mistake of a kind as the example', () => {
    const games = [game('a', [['forks', 30]]), game('b', [['forks', 45]])]
    expect(lessonExample(games, 'forks')).toMatchObject({ gameId: 'b', fen: 'fenb0', note: 'note b0', bestSan: 'd4', winLost: 45 })
    expect(lessonExample(games, 'threats')).toBeNull()
  })
})

describe('lesson progress', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory()
    resetDbForTests()
  })

  it('keeps sets done and the best score', async () => {
    await recordLessonSet('forks', 3, 1)
    await recordLessonSet('forks', 2, 2)
    expect((await getLessonRecords()).forks).toEqual({ sets: 2, best: 3, last: 2, lastAt: 2 })
  })
})
