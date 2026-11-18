import { describe, expect, it } from 'vitest'
import type { MoveJudgement } from '../chess/classify'
import { countsForRating } from '../rating/estimate'
import type { GameRecord } from '../storage/types'
import { needsBlunderCheck } from './blunderCheck'

const j = (rating: MoveJudgement['rating'], winBefore = 50): MoveJudgement => ({
  rating,
  played: 'e2e4',
  bestMove: 'd2d4',
  scoreBefore: { kind: 'cp', cp: 0 },
  scoreAfter: { kind: 'cp', cp: 0 },
  winBefore,
  winAfter: winBefore - 30,
  drop: 30,
})
const on = { on: true, gameOver: false, alreadyAsked: false }

describe('blunder check', () => {
  it('stops you after a blunder', () => {
    expect(needsBlunderCheck(j('blunder'), on)).toBe(true)
  })

  it('stays quiet for other moves, while rating, when off, already asked, already lost or after the game', () => {
    expect(needsBlunderCheck(j('mistake'), on)).toBe(false)
    expect(needsBlunderCheck('pending', on)).toBe(false)
    expect(needsBlunderCheck(null, on)).toBe(false)
    expect(needsBlunderCheck(j('blunder'), { ...on, on: false })).toBe(false)
    expect(needsBlunderCheck(j('blunder'), { ...on, alreadyAsked: true })).toBe(false)
    expect(needsBlunderCheck(j('blunder', 8), on)).toBe(false)
    expect(needsBlunderCheck(j('blunder'), { ...on, gameOver: true })).toBe(false)
  })

  it('games played with it on leave the rating estimate', () => {
    const g = { source: 'bot', botLevel: 1200, result: '1-0', userColor: 'w' } as GameRecord
    expect(countsForRating(g)).toBe(true)
    expect(countsForRating({ ...g, blunderCheck: true })).toBe(false)
  })
})
