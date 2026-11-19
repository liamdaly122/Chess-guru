import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { Chess } from 'chess.js'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Score } from '../chess/score'
import type { PositionAnalysis } from '../engine/uciInfo'
import { nullMoveFen } from '../patterns/threats'
import { resetDbForTests } from '../storage/db'
import { answerIsThreatToo, checkThreatAnswer, positionAfterAnswer, shouldAskThreat, threatAnswerText, threatQuestion } from './threatQuiz'
import { getThreatResults, recordThreatResult, threatScore } from './threatQuizStore'

function fenAfter(sans: string[]): string {
  const g = new Chess()
  for (const s of sans) g.move(s)
  return g.fen()
}

function analysis(fen: string, lines: { score: Score; pv: string[] }[]): PositionAnalysis {
  return { fen, depth: 12, bestMove: lines[0]?.pv[0] ?? null, lines: lines.map((l, i) => ({ ...l, multipv: i + 1, depth: 12 })) }
}

const even: Score = { kind: 'cp', cp: 0 }

describe('threat quiz', () => {
  it('finds a mate threat and checks answers', () => {
    // 1.e4 e5 2.Bc4 Bc5 3.Nc3 Qh4: Black threatens Qxf2#.
    const fen = fenAfter(['e4', 'e5', 'Bc4', 'Bc5', 'Nc3', 'Qh4'])
    const q = threatQuestion(
      fen,
      analysis(fen, [{ score: even, pv: ['d1e2'] }]),
      analysis(nullMoveFen(fen)!, [{ score: { kind: 'mate', moves: 1, forUs: true }, pv: ['h4f2'] }]),
    )!
    expect(q.kind).toBe('threat')
    expect(q.san).toBe('Qxf2#')
    expect(q.explanation).toBe('Black threatens Qxf2#, checkmate.')
    expect(checkThreatAnswer(q, 'h4f2')).toBe('right')
    expect(checkThreatAnswer(q, 'c5f2')).toBe('close') // Bxf2+: right square, wrong piece
    expect(checkThreatAnswer(q, 'h4h2')).toBe('close') // right piece, wrong square
    expect(checkThreatAnswer(q, 'a7a6')).toBe('wrong')
    expect(checkThreatAnswer(q, 'none')).toBe('wrong')
    expect(threatAnswerText(q, 'right', 'h4f2').title).toBe('Well spotted')
    expect(threatAnswerText(q, 'wrong', 'none').title).toBe('Black does have a threat')
  })

  it('names a loose piece the threat would win', () => {
    // 1.e4 e5 2.Nf3 Nc6 3.Ng5 h6: the knight on g5 is attacked by a pawn and undefended.
    const fen = fenAfter(['e4', 'e5', 'Nf3', 'Nc6', 'Ng5', 'h6'])
    const q = threatQuestion(
      fen,
      analysis(fen, [{ score: { kind: 'cp', cp: -20 }, pv: ['g5f3'] }]),
      analysis(nullMoveFen(fen)!, [{ score: { kind: 'cp', cp: 300 }, pv: ['h6g5'] }]),
    )!
    expect(q.kind).toBe('threat')
    expect(q.explanation).toBe('Black threatens hxg5, winning your knight on g5.')
  })

  it('accepts a second threat that is just as real', () => {
    const fen = fenAfter(['e4', 'e5', 'Nf3', 'Nc6', 'Ng5', 'h6'])
    const q = threatQuestion(
      fen,
      analysis(fen, [{ score: even, pv: ['g5f3'] }]),
      analysis(nullMoveFen(fen)!, [
        { score: { kind: 'cp', cp: 300 }, pv: ['h6g5'] },
        { score: { kind: 'cp', cp: 250 }, pv: ['d8g5'] },
      ]),
    )!
    expect(checkThreatAnswer(q, 'd8g5')).toBe('right')
  })

  it('checks an answer that is not one of the engine lines', () => {
    // 1.e4 e5 2.Nf3 Nc6 3.Ng5 h6: the engine's threat is hxg5; ...Qxg5 is checked separately.
    const fen = fenAfter(['e4', 'e5', 'Nf3', 'Nc6', 'Ng5', 'h6'])
    const q = threatQuestion(fen, analysis(fen, [{ score: even, pv: ['g5f3'] }]), analysis(nullMoveFen(fen)!, [{ score: { kind: 'cp', cp: 300 }, pv: ['h6g5'] }]))!
    expect(checkThreatAnswer(q, 'd8g5')).toBe('close') // right square, wrong piece
    const after = positionAfterAnswer(q, 'd8g5')!
    expect(new Chess(after).turn()).toBe('w')
    expect(positionAfterAnswer(q, 'none')).toBeNull()
    // White to move and 3 pawns down: a real threat for Black too.
    expect(answerIsThreatToo(q, analysis(after, [{ score: { kind: 'cp', cp: -300 }, pv: ['a2a3'] }]))).toBe(true)
    expect(answerIsThreatToo(q, analysis(after, [{ score: { kind: 'cp', cp: 0 }, pv: ['a2a3'] }]))).toBe(false)
    expect(threatAnswerText(q, 'right', 'd8g5')).toEqual({
      title: 'That works too',
      text: "Qxg5 would be a real threat as well. The engine's first choice: hxg5, winning your knight on g5. Now find your move.",
    })
  })

  it('a quiet position wants "No threat"; in-between positions are not asked', () => {
    const fen = fenAfter(['e4', 'e5', 'Nf3', 'Nc6'])
    const quiet = threatQuestion(fen, analysis(fen, [{ score: { kind: 'cp', cp: 30 }, pv: ['f1b5'] }]), analysis(nullMoveFen(fen)!, [{ score: { kind: 'cp', cp: -10 }, pv: ['g8f6'] }]))!
    expect(quiet.kind).toBe('quiet')
    expect(checkThreatAnswer(quiet, 'none')).toBe('right')
    expect(checkThreatAnswer(quiet, 'g8f6')).toBe('wrong')
    expect(threatAnswerText(quiet, 'wrong', 'g8f6').text).toMatch(/^Nf6 wouldn't hurt you much/)
    // About 7 Win% for Black: not clear either way.
    const middle = threatQuestion(fen, analysis(fen, [{ score: even, pv: ['f1b5'] }]), analysis(nullMoveFen(fen)!, [{ score: { kind: 'cp', cp: 80 }, pv: ['g8f6'] }]))
    expect(middle).toBeNull()
  })

  it('asks now and then, not in the opening or a decided game', () => {
    const fen = fenAfter(['e4', 'e5', 'Nf3', 'Nc6', 'Ng5', 'h6'])
    const q = threatQuestion(fen, analysis(fen, [{ score: even, pv: ['g5f3'] }]), analysis(nullMoveFen(fen)!, [{ score: { kind: 'cp', cp: 300 }, pv: ['h6g5'] }]))!
    // Move 4: still the opening.
    expect(shouldAskThreat(q, { sinceLast: Infinity })).toBe(false)
    const later = { ...q, fen: q.fen.replace(/ 4$/, ' 9') }
    expect(shouldAskThreat(later, { sinceLast: Infinity })).toBe(true)
    expect(shouldAskThreat(later, { sinceLast: 2 })).toBe(false)
    expect(shouldAskThreat({ ...later, yourWin: 3 }, { sinceLast: Infinity })).toBe(false)
    expect(shouldAskThreat({ ...later, kind: 'quiet' }, { sinceLast: 5 })).toBe(false)
    expect(shouldAskThreat({ ...later, kind: 'quiet' }, { sinceLast: 8 })).toBe(true)
  })
})

describe('threat quiz results', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory()
    resetDbForTests()
  })

  it('records answers and scores the recent ones', async () => {
    await recordThreatResult({ at: 1, kind: 'threat', verdict: 'right' })
    await recordThreatResult({ at: 2, kind: 'threat', verdict: 'close' })
    await recordThreatResult({ at: 3, kind: 'quiet', verdict: 'right' })
    const results = await getThreatResults()
    expect(results).toHaveLength(3)
    expect(threatScore(results)).toEqual({ asked: 3, right: 2 })
    expect(threatScore(results, 1)).toEqual({ asked: 1, right: 1 })
  })
})
