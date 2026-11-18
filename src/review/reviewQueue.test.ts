import { describe, expect, it } from 'vitest'
import { clearReviewQueue, queueReviews, reviewQueue } from './reviewQueue'

describe('review queue', () => {
  it('adds games once, in order, and clears', () => {
    clearReviewQueue()
    queueReviews(['a', 'b', 'a'])
    queueReviews(['b', 'c'])
    expect(reviewQueue()).toEqual(['a', 'b', 'c'])
    clearReviewQueue()
    expect(reviewQueue()).toEqual([])
  })
})
