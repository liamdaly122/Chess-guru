import { describe, expect, it } from 'vitest'
import { ratingCounts } from '../storage/gameInfo'
import type { GameRecord } from '../storage/types'
import { isCurrentReview, type GameReview, type PlyReview } from './types'

const ply = (color: 'w' | 'b', rating: 'best' | 'blunder'): PlyReview => ({
  san: 'e4',
  uci: 'e2e4',
  color,
  fenBefore: '',
  fenAfter: '',
  evalAfter: null,
  judgement: { rating, bestUci: null, bestSan: null, winBefore: 50, winAfter: 50, scoreBefore: { kind: 'cp', cp: 0 }, scoreAfter: { kind: 'cp', cp: 0 }, bestLineSan: [] },
})

describe('review version 2', () => {
  const review: GameReview = { startEval: null, plies: [ply('w', 'best'), ply('b', 'blunder')], accuracy: 90, lessons: [], complete: true, version: 2 }

  it('knows which reviews are current', () => {
    expect(isCurrentReview(review)).toBe(true)
    expect(isCurrentReview({ ...review, version: undefined })).toBe(false) // older: analysed again
    expect(isCurrentReview({ ...review, complete: false })).toBe(false)
    expect(isCurrentReview(undefined)).toBe(false)
  })

  it("counts only your moves in the games list, now that both sides are rated", () => {
    expect(ratingCounts({ userColor: 'w', review } as GameRecord)).toEqual({ best: 1 })
  })
})
