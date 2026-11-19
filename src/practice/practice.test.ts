import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import type { PlyReview } from '../review/types'
import { resetDbForTests } from '../storage/db'
import type { GameRecord } from '../storage/types'
import { practiceFromGame, practicePositions, practiceSucceeded } from './positions'
import { getPracticeRecords, recordPracticeTry } from './practiceStore'

/** A reviewed game where White (you) has these winning chances before each of your moves. */
function game(id: string, result: GameRecord['result'], yourWins: number[], extra: Partial<GameRecord> = {}): GameRecord {
  const plies: PlyReview[] = []
  yourWins.forEach((w, i) => {
    plies.push({
      san: `m${i}`,
      uci: 'e2e4',
      color: 'w',
      fenBefore: `fen${i} w - - 0 1`,
      fenAfter: '',
      evalAfter: null,
      judgement: {
        rating: 'good',
        bestUci: null,
        bestSan: null,
        winBefore: w,
        winAfter: w,
        scoreBefore: { kind: 'cp', cp: Math.round((w - 50) * 10) },
        scoreAfter: { kind: 'cp', cp: 0 },
        bestLineSan: [],
      },
    })
    plies.push({ san: `r${i}`, uci: 'e7e5', color: 'b', fenBefore: '', fenAfter: '', evalAfter: null })
  })
  return {
    id,
    source: 'bot',
    endedAt: 1000,
    white: { name: 'You' },
    black: { name: 'Maia 1400', rating: 1400 },
    userColor: 'w',
    result,
    termination: 'checkmate',
    moves: [],
    botLevel: 1400,
    review: { startEval: null, plies, accuracy: 70, lessons: [], complete: true, version: 2 },
    ...extra,
  }
}

describe('play it out: positions from your games', () => {
  it('finds the last winning position in a game you lost', () => {
    // Moves 0-3 are too early; you were winning at moves 5 and 7 (half-moves 10 and 14), then lost.
    const ps = practiceFromGame(game('g', '0-1', [50, 50, 50, 50, 50, 80, 60, 90, 40, 30]))
    const win = ps.find((p) => p.kind === 'win')!
    expect(win).toMatchObject({ id: 'g:14:win', ply: 14, fen: 'fen7 w - - 0 1', win: 90, played: '8. m7', opponent: 'Maia 1400', levelRating: 1400 })
    expect(win.evalText).toBe('+4.0')
    // And the last savable position before it was lost for good.
    expect(ps.find((p) => p.kind === 'hold')).toMatchObject({ ply: 18, win: 30 })
  })

  it('a draw gives only a winning position, a win gives none', () => {
    expect(practiceFromGame(game('d', '1/2-1/2', [50, 50, 50, 50, 50, 80, 40])).map((p) => p.kind)).toEqual(['win'])
    expect(practiceFromGame(game('w', '1-0', [50, 50, 50, 50, 50, 80, 40]))).toEqual([])
  })

  it('skips unreviewed games and early positions', () => {
    expect(practiceFromGame(game('u', '0-1', [90, 90, 90], { review: undefined }))).toEqual([])
    expect(practiceFromGame(game('e', '0-1', [90, 90, 90, 90]))).toEqual([]) // all before half-move 8
  })

  it('uses the nearest bot level to the opponent you faced', () => {
    const lichess = game('l', '0-1', [50, 50, 50, 50, 50, 80], { source: 'lichess', botLevel: undefined, black: { name: 'Opp', rating: 1530 } })
    expect(practiceFromGame(lichess)[0].levelRating).toBe(1600)
  })

  it('lists newest games first', () => {
    const a = game('a', '0-1', [50, 50, 50, 50, 50, 80], { endedAt: 1 })
    const b = game('b', '0-1', [50, 50, 50, 50, 50, 80], { endedAt: 2 })
    expect(practicePositions([a, b]).map((p) => p.gameId)).toEqual(['b', 'a'])
  })

  it('knows what counts as success', () => {
    expect(practiceSucceeded('win', 'w', 'w')).toBe(true)
    expect(practiceSucceeded('win', null, 'w')).toBe(false)
    expect(practiceSucceeded('hold', null, 'w')).toBe(true)
    expect(practiceSucceeded('hold', 'b', 'w')).toBe(false)
  })
})

describe('play it out: your tries', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory()
    resetDbForTests()
  })

  it('records tries and successes', async () => {
    await recordPracticeTry('g:14:win', false, 1)
    await recordPracticeTry('g:14:win', true, 2)
    expect((await getPracticeRecords())['g:14:win']).toEqual({ tries: 2, successes: 1, lastAt: 2, lastSuccess: true })
  })
})
