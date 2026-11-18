import { describe, expect, it } from 'vitest'
import type { MoveRating } from '../chess/classify'
import type { GameRecord } from '../storage/types'
import { gameVerdict, keyMoments, phaseGrade, phaseScores } from './keyMoments'
import type { GameReview, PlyReview } from './types'

/** Plies alternating White, Black: [rating, winBefore, winAfter]. */
function review(moves: [MoveRating | null, number, number][]): GameReview {
  const plies: PlyReview[] = moves.map(([rating, winBefore, winAfter], i) => ({
    san: `m${i}`,
    uci: 'e2e4',
    color: i % 2 === 0 ? 'w' : 'b',
    fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    fenAfter: '',
    evalAfter: null,
    phase: i < 4 ? 'opening' : 'middlegame',
    judgement: rating
      ? { rating, bestUci: null, bestSan: null, winBefore, winAfter, scoreBefore: { kind: 'cp', cp: 0 }, scoreAfter: { kind: 'cp', cp: 0 }, bestLineSan: [] }
      : undefined,
  }))
  return { startEval: null, plies, accuracy: 80, opponentAccuracy: 70, lessons: [], complete: true, version: 2 }
}

describe('key moments', () => {
  const r = review([
    ['book', 50, 50], // 0 you
    ['book', 50, 50], // 1 them
    ['great', 55, 55], // 2 you: great
    ['blunder', 50, 20], // 3 them: blunder
    ['mistake', 80, 60], // 4 you: didn't punish -> miss
    ['best', 40, 40], // 5
    ['blunder', 60, 10], // 6 you: blunder
    ['good', 90, 88], // 7
  ])

  it('picks your best and worst moves, their mistakes and your missed chances', () => {
    expect(keyMoments(r, 'w').map((m) => [m.ply, m.kind])).toEqual([
      [2, 'great'],
      [3, 'opponent-mistake'],
      [4, 'miss'],
      [6, 'blunder'],
    ])
  })

  it('keeps only the most important when there are too many', () => {
    expect(keyMoments(r, 'w', 2).map((m) => m.ply)).toEqual([2, 6]) // your blunder, then your great move
  })

  it('works for Black too', () => {
    expect(keyMoments(r, 'b').map((m) => [m.ply, m.kind])).toEqual([
      [3, 'blunder'],
      [4, 'opponent-mistake'],
      [6, 'opponent-mistake'],
    ])
  })

  it('scores each phase and sums up the game', () => {
    expect(phaseScores(r, 'w').map((p) => [p.phase, p.moves])).toEqual([
      ['opening', 1],
      ['middlegame', 2],
      ['endgame', 0],
    ])
    expect(phaseGrade(95)).toBe('Excellent')
    expect(phaseGrade(null)).toBe('–')
    const game = { userColor: 'w', result: '0-1', termination: 'resignation', white: { name: 'You' }, black: { name: 'Maia' } } as GameRecord
    expect(gameVerdict(game, r, keyMoments(r, 'w'))).toBe(
      "You lost to Maia by resignation. Your accuracy was 80%, Maia's 70%. The turning point was 4. m6, a blunder. Your best moment: 2. m2, a great move.",
    )
  })
})
