import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import type { MoveJudgement } from '../../chess/classify'
import { coachMessage, type CoachInput } from './coachMessage'

const game = new Chess()
game.move('e4')
game.move('e5')
const history = game.history({ verbose: true })

const judgement = (rating: MoveJudgement['rating']): MoveJudgement => ({
  rating,
  played: 'e2e4',
  bestMove: 'd2d4',
  scoreBefore: { kind: 'cp', cp: 30 },
  scoreAfter: { kind: 'cp', cp: 20 },
  winBefore: 53,
  winAfter: 52,
  drop: 1,
})

const base: CoachInput = {
  history,
  ratings: [judgement('good'), null],
  notes: [null, null],
  liveCoaching: true,
  gameOver: false,
  hint: null,
  hintStep: 0,
}

describe('coachMessage', () => {
  it('rates the last move with praise for a good move', () => {
    const m = coachMessage(base)
    expect(m.title).toBe('1. e4 is a good move')
    expect(m.text).toBe('A solid move. The engine slightly preferred d4.')
    expect(m.badge).toBe('good')
  })

  it('gives the note and tip for a mistake', () => {
    const m = coachMessage({
      ...base,
      ratings: [judgement('mistake'), null],
      notes: [{ text: 'This leaves your pawn loose.', tip: 'Check your pieces.' }, null],
    })
    expect(m).toMatchObject({ tone: 'mistake', text: 'This leaves your pawn loose.', more: 'Next time: Check your pieces.' })
  })

  it('shows a hint step ahead of the move rating', () => {
    const hint = { kind: 'tactic' as const, nudge: 'Look for checks.', pieceText: 'Look at your knight.', moveText: 'Play Nf3.', pieceSquare: 'g1' as const, pieceType: 'n' as const, moveFrom: 'g1' as const, moveTo: 'f3' as const }
    expect(coachMessage({ ...base, hint, hintStep: 2 })).toMatchObject({ tone: 'hint', title: 'Hint 2 of 3', text: 'Look at your knight.' })
  })

  it('shows the bot download note first', () => {
    expect(coachMessage({ ...base, botNote: 'Getting Maia ready…' }).text).toBe('Getting Maia ready…')
  })

  it('sums up the game when it is over', () => {
    const m = coachMessage({ ...base, gameOver: true, resultText: 'You won by checkmate', ratings: [judgement('blunder'), null] })
    expect(m.title).toBe('You won by checkmate')
    expect(m.text).toBe('1 blunder. The summary below explains them.')
  })

  it('says when live coaching is off', () => {
    expect(coachMessage({ ...base, liveCoaching: false }).text).toMatch(/Live coaching is off/)
  })

  it('welcomes you before any move', () => {
    expect(coachMessage({ ...base, history: [], ratings: [], notes: [] }).text).toMatch(/Your move/)
  })
})
