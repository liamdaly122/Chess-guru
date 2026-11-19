import { useEffect, useRef, useState } from 'react'
import { checkThreatAnswer, shouldAskThreat, threatQuestion, type ThreatQuestion, type ThreatVerdict } from '../../coach/threatQuiz'
import { recordThreatResult } from '../../coach/threatQuizStore'
import { THREAT_QUIZ } from '../../config/threatQuiz'
import { useAnalyser } from '../../engine/useAnalyser'
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
}

export interface ThreatQuiz {
  /** The question waiting for your answer, if any. */
  asking: ThreatQuestion | null
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
  const analyse = useAnalyser()
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
    void (async () => {
      const nullMove = await analyse(nullFen, limits)
      if (!live || !nullMove) return
      const real = await analyse(fen, limits)
      if (!live || !real) return
      const question = threatQuestion(fen, real, nullMove)
      if (!question || !shouldAskThreat(question, { sinceLast })) return
      lastAsked.current = { game: gameKey, at: yourMoves }
      setState({ fen, question })
    })()
    return () => {
      live = false
    }
  }, [enabled, isUserTurn, fen, yourMoves, gameKey, analyse])

  const current = state && state.fen === fen && enabled && isUserTurn ? state : null

  function answer(move: string | 'none') {
    if (!current || current.answer || current.skipped) return
    const verdict = checkThreatAnswer(current.question, move)
    setState({ ...current, answer: { verdict, move } })
    void recordThreatResult({ at: Date.now(), kind: current.question.kind, verdict })
  }

  return {
    asking: current && !current.answer && !current.skipped ? current.question : null,
    answered: current?.answer ? { question: current.question, ...current.answer } : null,
    answer,
    skip: () => current && setState({ ...current, skipped: true }),
  }
}
