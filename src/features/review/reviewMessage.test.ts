import { describe, expect, it } from 'vitest'
import type { GameReview, PlyReview } from '../../review/types'
import { reviewMessage } from './reviewMessage'

const ply = (extra: Partial<PlyReview>): PlyReview => ({
  san: 'Nd4',
  uci: 'f3d4',
  color: 'w',
  fenBefore: '',
  fenAfter: '',
  evalAfter: { kind: 'cp', cp: -300 },
  ...extra,
})

const review: GameReview = {
  startEval: { kind: 'cp', cp: 20 },
  accuracy: 70,
  lessons: [],
  complete: true,
  plies: [
    ply({
      judgement: {
        rating: 'blunder',
        bestUci: 'f1b5',
        bestSan: 'Bb5',
        winBefore: 55,
        winAfter: 10,
        scoreBefore: { kind: 'cp', cp: 30 },
        scoreAfter: { kind: 'cp', cp: -300 },
        bestLineSan: [],
      },
      note: { text: 'This leaves your knight loose.', tip: 'Check your pieces.', category: 'loose-pieces' },
    }),
    ply({ san: 'exd4', color: 'b', evalAfter: { kind: 'cp', cp: -320 } }),
  ],
}

describe('reviewMessage', () => {
  it('explains a blunder, names the best move and gives the tip', () => {
    expect(reviewMessage(review, 0, 'w', 'Trapper')).toEqual({
      tone: 'blunder',
      badge: 'blunder',
      title: 'Nd4 is a blunder',
      text: 'This leaves your knight loose. The best move was Bb5.',
      tip: 'Check your pieces.',
      evalText: '-3.0',
      evalFavours: 'b',
    })
  })

  it("labels the opponent's moves", () => {
    expect(reviewMessage(review, 1, 'w', 'Trapper')).toMatchObject({ title: 'exd4 by Trapper', evalText: '-3.2' })
  })

  it('introduces the game at the start', () => {
    expect(reviewMessage(review, -1, 'w', 'Trapper')).toMatchObject({ tone: 'neutral', evalText: '+0.2' })
  })
})
