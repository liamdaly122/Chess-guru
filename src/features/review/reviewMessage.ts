import { Chess, type Color } from 'chess.js'
import { formatScore, type Score } from '../../chess/score'
import type { GameReview } from '../../review/types'
import { isMissedChance } from '../../review/keyMoments'
import type { CoachMessage } from '../play/coachMessage'
import { praiseText, RATING_VERDICT } from '../play/ratingText'

function evalInfo(white: Score | null): Pick<CoachMessage, 'evalText' | 'evalFavours'> {
  if (!white) return {}
  const favoursWhite = white.kind === 'cp' ? white.cp >= 0 : white.forUs
  return { evalText: formatScore(white), evalFavours: favoursWhite ? 'w' : 'b' }
}

/**
 * What the coach says about the half-move shown in the review (-1 = the start position).
 * Same bubble as during play: rating, evaluation, why the move was good or bad, and a tip.
 * Your opponent's mistakes are told from your side (what they let you do).
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
        ? 'The starting position. Use Next to go through the key moments, or step through every move.'
        : 'Analysing your game. Ratings and notes appear as each move is checked.',
      ...evalInfo(review.startEval),
    }
  }

  const p = review.plies[ply]
  const j = p.judgement
  const extra = bookNote ? ` ${bookNote}` : ''

  if (p.color !== userColor) {
    if (p.fenAfter && new Chess(p.fenAfter).isCheckmate()) {
      return { tone: 'neutral', title: `${p.san} by ${opponentName} is checkmate`, text: 'The game ends here.', ...evalInfo(p.evalAfter) }
    }
    if (!j) return { tone: 'neutral', title: `${p.san} by ${opponentName}`, text: "Your opponent's move.", ...evalInfo(p.evalAfter) }
    const bad = j.rating === 'mistake' || j.rating === 'blunder'
    return {
      tone: 'neutral',
      badge: j.rating,
      title: `${p.san} by ${opponentName} ${RATING_VERDICT[j.rating]}`,
      text: bad
        ? (p.opponentNote ?? 'This gives you a chance.') + extra
        : j.rating === 'book'
          ? `Known opening theory.${extra}`
          : `Your opponent's move.${extra}`,
      ...evalInfo(p.evalAfter),
    }
  }

  if (!j) return { tone: 'pending', badge: 'pending', text: `Checking ${p.san}…` }

  const miss = isMissedChance(review, ply, userColor)
  const mate = !!p.fenAfter && new Chess(p.fenAfter).isCheckmate()
  const title = miss ? `${p.san} misses a chance` : mate ? `${p.san} is checkmate` : `${p.san} ${RATING_VERDICT[j.rating]}`
  const best = j.bestSan && j.bestUci !== p.uci ? j.bestSan : null
  if ((j.rating === 'mistake' || j.rating === 'blunder') && p.note) {
    const bestLine = best && !p.note.text.includes(best) ? ` The best move was ${best}.` : ''
    return { tone: j.rating, badge: j.rating, title, text: p.note.text + bestLine + extra, tip: p.note.tip, ...evalInfo(p.evalAfter) }
  }
  if (miss) {
    return {
      tone: j.rating,
      badge: j.rating,
      title,
      text: `Your opponent had just made a mistake.${best ? ` ${best} was the way to punish it.` : ''}${extra}`,
      ...evalInfo(p.evalAfter),
    }
  }
  return { tone: j.rating, badge: j.rating, title, text: (mate ? 'Well done: you win the game.' : (p.why ?? praiseText(j.rating, best))) + extra, ...evalInfo(p.evalAfter) }
}
