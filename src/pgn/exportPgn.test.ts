import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import type { GameRecord } from '../storage/types'
import { buildPgn, evalTag, moveComment } from './exportPgn'

const base: GameRecord = {
  id: 'g1',
  source: 'bot',
  endedAt: new Date(2026, 10, 18, 12).getTime(),
  white: { name: 'You' },
  black: { name: 'Stockfish 1200', rating: 1200 },
  userColor: 'w',
  result: '1-0',
  termination: 'checkmate',
  moves: ['f2f3', 'e7e5', 'g2g4', 'd8h4'],
}

describe('evalTag', () => {
  it('writes centipawns as pawns and mates with #', () => {
    expect(evalTag({ kind: 'cp', cp: 32 })).toBe('[%eval 0.32]')
    expect(evalTag({ kind: 'cp', cp: -150 })).toBe('[%eval -1.50]')
    expect(evalTag({ kind: 'mate', moves: 3, forUs: false })).toBe('[%eval #-3]')
  })
})

describe('moveComment', () => {
  it('includes the eval, rating, best move and note, without braces', () => {
    const c = moveComment({
      san: 'g4',
      uci: 'g2g4',
      color: 'w',
      fenBefore: '',
      fenAfter: '',
      evalAfter: { kind: 'mate', moves: 1, forUs: false },
      judgement: {
        rating: 'blunder',
        bestUci: 'b1c3',
        bestSan: 'Nc3',
        winBefore: 45,
        winAfter: 0.1,
        scoreBefore: { kind: 'cp', cp: -40 },
        scoreAfter: { kind: 'mate', moves: 1, forUs: false },
        bestLineSan: ['Nc3'],
      },
      note: { text: 'This lets Black {force} mate.', tip: 'Check every check.', category: 'king-safety' },
    })
    expect(c).toBe(
      '[%eval #-1] Blunder (??). Best was Nc3. Winning chances 45% to 0%. This lets Black force mate. Next time: Check every check.',
    )
  })
})

describe('buildPgn', () => {
  it('writes headers and moves that load back into chess.js', () => {
    const pgn = buildPgn(base)
    expect(pgn).toContain('[White "You"]')
    expect(pgn).toContain('[BlackElo "1200"]')
    expect(pgn).toContain('[Date "2026.11.18"]')
    expect(pgn).toContain('1. f3 e5 2. g4 Qh4# 1-0')
    const back = new Chess()
    back.loadPgn(pgn)
    expect(back.isCheckmate()).toBe(true)
  })

  it('adds the start position for games that did not start normally', () => {
    const fen = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'
    const pgn = buildPgn({ ...base, startFen: fen, moves: ['a1a8'] })
    expect(pgn).toContain('[SetUp "1"]')
    expect(pgn).toContain(`[FEN "${fen}"]`)
    expect(pgn).toContain('1. Ra8#')
  })
})

describe('buildPgn with a review', () => {
  it('keeps eval tags whole and skips "best was" for book moves', () => {
    const plies = ['f2f3', 'e7e5', 'g2g4', 'd8h4'].map((uci, i) => ({
      san: '',
      uci,
      color: (i % 2 === 0 ? 'w' : 'b') as 'w' | 'b',
      fenBefore: '',
      fenAfter: '',
      evalAfter: { kind: 'cp' as const, cp: -100 * i },
      judgement:
        i === 0
          ? {
              rating: 'book' as const,
              bestUci: 'e2e4',
              bestSan: 'e4',
              winBefore: 53,
              winAfter: 50,
              scoreBefore: { kind: 'cp' as const, cp: 30 },
              scoreAfter: { kind: 'cp' as const, cp: 0 },
              bestLineSan: [],
            }
          : undefined,
    }))
    const pgn = buildPgn({ ...base, review: { startEval: null, plies, accuracy: 50, lessons: [], complete: true } })
    expect(pgn).toContain('1. f3 {[%eval 0.00] Book move (book). Winning chances 53% to 50%.} e5 {[%eval -1.00]}')
    expect(pgn).not.toContain('Best was e4')
    expect(pgn).not.toMatch(/\[%eval\n/)
  })
})
