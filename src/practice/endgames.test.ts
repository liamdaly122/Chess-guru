import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { ENDGAME_DRILLS, ENDGAME_LEVEL } from './endgames'
import { drillPosition, practiceSucceeded } from './positions'
import { findLevel } from '../config/levels'

describe('endgame drills', () => {
  it('every position is legal, not over, with unique drill ids', () => {
    expect(new Set(ENDGAME_DRILLS.map((d) => d.id)).size).toBe(ENDGAME_DRILLS.length)
    for (const d of ENDGAME_DRILLS) {
      for (const fen of d.fens) {
        const g = new Chess(fen)
        expect(g.isGameOver(), `${d.id}: ${fen}`).toBe(false)
      }
    }
  })

  it('takes the starting positions in turn and plays the engine at full strength', () => {
    const queen = ENDGAME_DRILLS.find((d) => d.id === 'queen-mate')!
    expect(drillPosition(queen, 0).fen).toBe(queen.fens[0])
    expect(drillPosition(queen, 4).fen).toBe(queen.fens[1])
    expect(drillPosition(queen, 0)).toMatchObject({ id: 'endgame:queen-mate', kind: 'mate', userColor: 'w', levelRating: ENDGAME_LEVEL })
    expect(findLevel(ENDGAME_LEVEL).rating).toBe(ENDGAME_LEVEL)
    const philidor = ENDGAME_DRILLS.find((d) => d.id === 'philidor')!
    expect(drillPosition(philidor, 0).userColor).toBe('b')
  })

  it('a mate drill needs a win; a hold drill a draw or better', () => {
    expect(practiceSucceeded('mate', 'w', 'w')).toBe(true)
    expect(practiceSucceeded('mate', null, 'w')).toBe(false) // stalemate fails
    expect(practiceSucceeded('hold', null, 'b')).toBe(true)
  })
})
