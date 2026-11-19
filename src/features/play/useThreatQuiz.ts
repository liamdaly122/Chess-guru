import { useEffect, useRef, useState } from 'react'
import {
  answerIsThreatToo,
  checkThreatAnswer,
  positionAfterAnswer,
  shouldAskThreat,
  threatQuestion,
  type ThreatQuestion,
  type ThreatVerdict,
} from '../../coach/threatQuiz'
import { recordThreatResult } from '../../coach/threatQuizStore'
import { THREAT_QUIZ } from '../../config/threatQuiz'
import { Analyser } from '../../engine/Analyser'
import { nullMoveFen } from '../../patterns/threats'

interface Options {
  /** Quiz switched on, live coaching on, a normal bot game that isn't over. */
  enabled: boolean
  fen: string
  isUserTurn: boolean
  /** How many moves you have played in this game. */
  yourMoves: number
  /** Changes with every new game. */
  gameKey: string
}

interface QuizState {
  fen: string
  question: ThreatQuestion
  answer?: { verdict: ThreatVerdict; move: string | 'none' }
  skipped?: boolean
  /** The engine is checking an answer that isn't one of its own lines. */
  checking?: boolean
}

export interface ThreatQuiz {
  /** The question waiting for your answer, if any. */
  asking: ThreatQuestion | null
  /** Your answer is being checked with the engine. */
  checking: boolean
  /** The question you just answered and how you did, until you move. */
  answered: { question: ThreatQuestion; verdict: ThreatVerdict; move: string | 'none' } | null
  answer: (move: string | 'none') => void
  skip: () => void
}

/**
 * "What does my opponent want?" On your turn, now and then, a separate engine looks at the
 * position and at the same position with your opponent to move. If they have a clear threat
 * (or clearly none), the coach asks you to show it before you move. The search runs while you
 * think; if you move first, nothing is asked.
 */
export function useThreatQuiz({ enabled, fen, isUserTurn, yourMoves, gameKey }: Options): ThreatQuiz {
  // Its own engine, created when first needed. Searches queue on an engine, so the one for a
  // position you have already moved on from is stopped rather than left to run.
  const engine = useRef<Analyser | null>(null)
  useEffect(
    () => () => {
      engine.current?.dispose()
      engine.current = null
    },
    [],
  )
  const [state, setState] = useState<QuizState | null>(null)
  // Your move count when the last question in this game was asked.
  const lastAsked = useRef<{ game: string; at: number } | null>(null)

  useEffect(() => {
    if (!enabled || !isUserTurn) return
    const sinceLast = lastAsked.current?.game === gameKey ? yourMoves - lastAsked.current.at : Infinity
    if (sinceLast < THREAT_QUIZ.threatEvery || Number(fen.split(' ')[5]) < THREAT_QUIZ.fromMove) return
    const nullFen = nullMoveFen(fen)
    if (!nullFen) return
    let live = true
    const limits = { depth: THREAT_QUIZ.depth, maxTimeMs: THREAT_QUIZ.maxTimeMs }
    const analyser = (engine.current ??= new Analyser())
    void (async () => {
      const nullMove = await analyser.analyse(nullFen, undefined, limits)
      if (!live || !nullMove) return
      const real = await analyser.analyse(fen, undefined, limits)
      if (!live || !real) return
      const question = threatQuestion(fen, real, nullMove)
      if (!question || !shouldAskThreat(question, { sinceLast })) return
      lastAsked.current = { game: gameKey, at: yourMoves }
      setState({ fen, question })
    })()
    return () => {
      live = false
      analyser.stop()
    }
  }, [enabled, isUserTurn, fen, yourMoves, gameKey])

  const current = state && state.fen === fen && enabled && isUserTurn ? state : null

  function settle(base: QuizState, move: string | 'none', verdict: ThreatVerdict) {
    setState((s) => (s && s.fen === base.fen ? { ...base, checking: false, answer: { verdict, move } } : s))
    void recordThreatResult({ at: Date.now(), kind: base.question.kind, verdict })
  }

  function answer(move: string | 'none') {
    if (!current || current.answer || current.skipped || current.checking) return
    const q = current.question
    const verdict = checkThreatAnswer(q, move)
    const after = verdict === 'right' ? null : positionAfterAnswer(q, move)
    if (!after || q.kind !== 'threat') {
      settle(current, move, verdict)
      return
    }
    // Not one of the engine's lines: check whether it is a real threat too, like a mistake puzzle's answer.
    const base = current
    setState({ ...base, checking: true })
    const analyser = (engine.current ??= new Analyser())
    void analyser.analyse(after, undefined, { depth: THREAT_QUIZ.depth, maxTimeMs: THREAT_QUIZ.maxTimeMs }).then((a) => {
      settle(base, move, a && answerIsThreatToo(q, a) ? 'right' : verdict)
    })
  }

  return {
    asking: current && !current.answer && !current.skipped ? current.question : null,
    checking: !!current?.checking,
    answered: current?.answer ? { question: current.question, ...current.answer } : null,
    answer,
    skip: () => current && setState({ ...current, skipped: true }),
  }
}
