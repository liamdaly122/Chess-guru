import type { Move } from 'chess.js'
import type { PlyNote, PlyRating } from '../../analysis/useGameAnalysis'
import type { MoveRating } from '../../chess/classify'
import { uciToSan } from '../../chess/moves'
import { formatScore, toWhitePov } from '../../chess/score'
import type { Hint } from '../../coach/hints'
import { countLabel, praiseText, RATING_VERDICT } from './ratingText'

/** One short message from the coach, for the bubble above the board on phones. */
export interface CoachMessage {
  tone: 'neutral' | 'pending' | 'hint' | 'warning' | MoveRating
  /** Rating badge to show, if any. */
  badge?: MoveRating | 'pending'
  /** Bold heading, e.g. "Nf3 is a mistake". */
  title?: string
  text: string
  /** The "next time" tip, shown when the Tip button is tapped. */
  tip?: string
  /** Evaluation after the move, White's point of view, e.g. "+0.4" or "-M2". */
  evalText?: string
  /** Which side the evaluation favours, for the chip's colour. */
  evalFavours?: 'w' | 'b'
  /**
   * Keeps the bubble in place while the text updates (for example the engine line in Explore,
   * which changes as the search deepens). Without it, each new message slides in.
   */
  id?: string
}

export interface CoachInput {
  history: Move[]
  ratings: PlyRating[]
  notes: PlyNote[]
  liveCoaching: boolean
  gameOver: boolean
  /** Short result, e.g. "You won by checkmate". */
  resultText?: string
  hint: Hint | null
  hintStep: number
  /** Maia download or fallback message. */
  botNote?: string | null
  /** "This move left the opening book..." */
  bookNote?: string | null
}

function moveName(ply: number, move: Move): string {
  return `${Math.floor(ply / 2) + 1}.${move.color === 'b' ? '..' : ''} ${move.san}`
}

/** Decide what the coach says right now, most important first. */
export function coachMessage(input: CoachInput): CoachMessage {
  const { history, ratings, notes, liveCoaching, gameOver, hint, hintStep } = input

  if (input.botNote) return { tone: 'neutral', text: input.botNote }

  if (hint && hintStep > 0 && !gameOver) {
    const steps = [hint.nudge, hint.pieceText, hint.moveText]
    return { tone: 'hint', title: `Hint ${hintStep} of 3`, text: steps[hintStep - 1] }
  }

  if (gameOver) {
    const judged = ratings.flatMap((r) => (r && r !== 'pending' ? [r.rating] : []))
    const mistakes = judged.filter((r) => r === 'mistake').length
    const blunders = judged.filter((r) => r === 'blunder').length
    const tally =
      mistakes + blunders === 0
        ? 'No mistakes or blunders. Well played!'
        : [mistakes && countLabel('mistake', mistakes), blunders && countLabel('blunder', blunders)].filter(Boolean).join(' and ') +
          '. The summary below explains them.'
    return { tone: 'neutral', title: input.resultText ?? 'Game over', text: tally }
  }

  if (!liveCoaching) {
    return { tone: 'neutral', text: 'Live coaching is off. Your ratings and notes will appear when the game ends.' }
  }

  let ply = -1
  for (let i = ratings.length - 1; i >= 0; i--) {
    if (ratings[i]) {
      ply = i
      break
    }
  }
  if (ply === -1) return { tone: 'neutral', text: "Your move. I'll rate each one and explain any mistakes." }

  const move = history[ply]
  const r = ratings[ply]!
  if (r === 'pending') return { tone: 'pending', badge: 'pending', text: `Checking ${moveName(ply, move)}…` }

  const title = `${move.san} ${RATING_VERDICT[r.rating]}`
  const white = toWhitePov(r.scoreAfter, move.color)
  const evalInfo = {
    evalText: formatScore(white),
    evalFavours: (white.kind === 'cp' ? white.cp >= 0 : white.forUs) ? ('w' as const) : ('b' as const),
  }
  const note = notes[ply]
  const best = r.bestMove ? uciToSan(move.before, r.bestMove) : null
  if (r.rating === 'mistake' || r.rating === 'blunder') {
    if (!note || note === 'pending') {
      return { tone: r.rating, badge: r.rating, title, text: 'Working out what went wrong…', ...evalInfo }
    }
    // Name the better move unless the note already does.
    const bestLine = best && !note.text.includes(best) ? ` The best move was ${best}.` : ''
    return { tone: r.rating, badge: r.rating, title, text: note.text + bestLine, tip: note.tip, ...evalInfo }
  }
  const text = [praiseText(r.rating, best), input.bookNote].filter(Boolean).join(' ')
  return { tone: r.rating, badge: r.rating, title, text, ...evalInfo }
}
