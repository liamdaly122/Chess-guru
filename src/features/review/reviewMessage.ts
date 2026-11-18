import type { Color } from 'chess.js'
import { formatScore, type Score } from '../../chess/score'
import type { GameReview } from '../../review/types'
import type { CoachMessage } from '../play/coachMessage'
import { praiseText, RATING_VERDICT } from '../play/ratingText'

function evalInfo(white: Score | null): Pick<CoachMessage, 'evalText' | 'evalFavours'> {
  if (!white) return {}
  const favoursWhite = white.kind === 'cp' ? white.cp >= 0 : white.forUs
  return { evalText: formatScore(white), evalFavours: favoursWhite ? 'w' : 'b' }
}

/**
 * What the coach says about the half-move shown in the review (-1 = the start position).
 * Same bubble as during play: rating, evaluation, note and tip.
 */
export function reviewMessage(
  review: GameReview,
  ply: number,
  userColor: Color,
  opponentName: string,
  bookNote?: string | null,
): CoachMessage {
  if (ply < 0) {
    return {
      tone: 'neutral',
      text: review.complete
        ? 'Step through the game with the arrows, or jump straight to a mistake from the summary.'
        : 'Analysing your game. Ratings and notes appear as each move is checked.',
      ...evalInfo(review.startEval),
    }
  }

  const p = review.plies[ply]
  if (p.color !== userColor) {
    return { tone: 'neutral', title: `${p.san} by ${opponentName}`, text: "Your opponent's move.", ...evalInfo(p.evalAfter) }
  }

  const j = p.judgement
  if (!j) return { tone: 'pending', badge: 'pending', text: `Checking ${p.san}…` }

  const title = `${p.san} ${RATING_VERDICT[j.rating]}`
  const extra = bookNote ? ` ${bookNote}` : ''
  if ((j.rating === 'mistake' || j.rating === 'blunder') && p.note) {
    const best = j.bestSan && !p.note.text.includes(j.bestSan) ? ` The best move was ${j.bestSan}.` : ''
    return {
      tone: j.rating,
      badge: j.rating,
      title,
      text: p.note.text + best + extra,
      tip: p.note.tip,
      ...evalInfo(p.evalAfter),
    }
  }
  return { tone: j.rating, badge: j.rating, title, text: praiseText(j.rating, j.bestSan) + extra, ...evalInfo(p.evalAfter) }
}
