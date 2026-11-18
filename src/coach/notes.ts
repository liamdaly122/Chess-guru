import type { Color } from 'chess.js'
import { COLOR_NAME, PIECE_NAME, type PlacedPiece } from '../patterns/board'
import type { HangingPiece } from '../patterns/hanging'
import type { LineTactic } from '../patterns/lines'
import type { CoachFacts, Fact } from './facts'

export interface CoachNote {
  /** What went wrong, in one sentence. */
  text: string
  /** What to look for next time, in one sentence. */
  tip: string
  /** The fact the note is based on, so the UI can highlight squares. Undefined for the general note. */
  fact?: Fact
}

/**
 * Turn the facts about a move into a short, friendly note: one sentence on what went wrong
 * and one on what to look for next time. Only facts from the engine and our pattern
 * detectors are used; nothing here guesses about the position.
 */
export function writeNote(facts: CoachFacts, mover: Color): CoachNote {
  const opp = COLOR_NAME[mover === 'w' ? 'b' : 'w']
  const fact = facts.facts[0]
  if (!fact) return generalNote(facts)

  switch (fact.type) {
    case 'missed-mate':
      return {
        fact,
        text: `You had a forced mate in ${fact.mateIn}, starting with ${fact.bestSan}.`,
        tip: 'When the enemy king is exposed, look at every check before anything else.',
      }
    case 'allowed-mate':
      return {
        fact,
        text: `This lets ${opp} force checkmate in ${fact.mateIn}, starting with ${fact.replySan}.`,
        tip: 'Before you move, look at every check your opponent could give next.',
      }
    case 'piece-lost':
      return {
        fact,
        text: `This leaves ${yours(fact.piece)} ${defenceText(fact.piece)}, so ${opp} can win it with ${fact.captureSan}.`,
        tip: 'Before each move, check which of your pieces are attacked and whether they are defended enough.',
      }
    case 'allowed-fork':
      return {
        fact,
        text: `This allows ${fact.replySan}, and the ${PIECE_NAME[fact.forker.type]} forks your ${list(fact.targets)}.`,
        tip: forkTip(fact.forker),
      }
    case 'allowed-line':
      return {
        fact,
        text: `This allows ${fact.replySan}, ${lineText(fact.tactic, 'your')}.`,
        tip: 'Keep your king and queen off lines that enemy bishops, rooks and queens can reach.',
      }
    case 'threat-ignored':
      return {
        fact,
        text: `${opp} was threatening ${fact.threatSan}, and this move didn't deal with it.`,
        tip: 'After every move your opponent makes, ask yourself what they want to do next.',
      }
    case 'missed-capture':
      return {
        fact,
        text: `${fact.bestSan} would have won ${theirs(fact.piece)}, which was ${fact.piece.defenders === 0 ? 'undefended' : 'not defended enough'}.`,
        tip: 'Look for enemy pieces that are undefended or attacked more times than they are defended.',
      }
    case 'missed-fork':
      return {
        fact,
        text: `${fact.bestSan} would have forked ${opp}'s ${list(fact.targets)}.`,
        tip: 'Look for moves that attack two pieces at once, especially with check.',
      }
    case 'missed-line':
      return {
        fact,
        text: `${fact.bestSan} would have ${fact.tactic.kind === 'pin' ? 'pinned' : 'skewered'} ${opp}'s ${PIECE_NAME[fact.tactic.front.type]} ${fact.tactic.kind === 'pin' ? 'to' : 'and won'} the ${PIECE_NAME[fact.tactic.back.type]}.`,
        tip: 'Look for enemy pieces lined up on the same file, rank or diagonal.',
      }
    case 'left-hanging':
      return {
        fact,
        text: `This leaves ${yours(fact.piece)} ${defenceText(fact.piece)}.${facts.bestSan ? ` ${facts.bestSan} was better.` : ''}`,
        tip: 'Before each move, check which of your pieces are attacked and whether they are defended enough.',
      }
  }
}

/**
 * Your opponent's mistake, told from your side: what it lets you do. The facts are built for
 * the opponent's move as usual ("you" there is the opponent), so the wording swaps sides.
 */
export function writeOpponentNote(facts: CoachFacts): CoachNote {
  const fact = facts.facts[0]
  const reply = facts.replyLineSan[0]
  const best = reply ? ` The best reply is ${reply}.` : ''
  if (!fact) {
    return {
      text: `This drops their winning chances from ${Math.round(facts.winBefore)}% to ${Math.round(facts.winAfter)}%.${best}`,
      tip: '',
    }
  }
  switch (fact.type) {
    case 'allowed-mate':
      return { fact, text: `This lets you force checkmate in ${fact.mateIn}, starting with ${fact.replySan}.`, tip: '' }
    case 'missed-mate':
      return { fact, text: `They had a forced mate with ${fact.bestSan} and missed it.${best}`, tip: '' }
    case 'piece-lost':
      return {
        fact,
        text: `This leaves their ${PIECE_NAME[fact.piece.type]} on ${fact.piece.square} ${fact.piece.defenders === 0 ? 'undefended' : 'not defended enough'}: you can win it with ${fact.captureSan}.`,
        tip: '',
      }
    case 'allowed-fork':
      return { fact, text: `This lets you play ${fact.replySan}, forking their ${list(fact.targets)}.`, tip: '' }
    case 'allowed-line':
      return {
        fact,
        text: `This lets you play ${fact.replySan}, ${fact.tactic.kind === 'pin' ? 'pinning' : 'skewering'} their ${PIECE_NAME[fact.tactic.front.type]}.`,
        tip: '',
      }
    case 'threat-ignored':
      return { fact, text: `This ignores your threat: ${fact.threatSan} now works.`, tip: '' }
    case 'missed-capture':
      return { fact, text: `They missed ${fact.bestSan}, which wins your ${PIECE_NAME[fact.piece.type]} on ${fact.piece.square}.${best}`, tip: '' }
    case 'missed-fork':
      return { fact, text: `They missed ${fact.bestSan}, a fork of your ${list(fact.targets)}.${best}`, tip: '' }
    case 'missed-line':
      return { fact, text: `They missed ${fact.bestSan}, which ${fact.tactic.kind === 'pin' ? 'pins' : 'skewers'} your ${PIECE_NAME[fact.tactic.front.type]}.${best}`, tip: '' }
    case 'left-hanging':
      return { fact, text: `This leaves their ${PIECE_NAME[fact.piece.type]} on ${fact.piece.square} loose.${best}`, tip: '' }
  }
}

function generalNote(facts: CoachFacts): CoachNote {
  const idea = facts.bestLineSan.slice(0, 3).join(' ')
  const best = facts.bestSan ? `The engine preferred ${facts.bestSan}${idea ? ` (${idea})` : ''}, and this` : 'This'
  return {
    text: `${best} move dropped your winning chances from ${Math.round(facts.winBefore)}% to ${Math.round(facts.winAfter)}%.`,
    tip: 'Compare two or three candidate moves before you commit to one.',
  }
}

/** "your knight on e5" */
function yours(p: { type: PlacedPiece['type']; square: string }): string {
  return `your ${PIECE_NAME[p.type]} on ${p.square}`
}

/** "the knight on e5" */
function theirs(p: { type: PlacedPiece['type']; square: string }): string {
  return `the ${PIECE_NAME[p.type]} on ${p.square}`
}

function times(n: number): string {
  return n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`
}

function defenceText(p: HangingPiece): string {
  if (p.defenders === 0) return 'with no defender'
  if (p.attackers > p.defenders) return `attacked ${times(p.attackers)} but only defended ${times(p.defenders)}`
  return 'attacked by a less valuable piece'
}

function list(pieces: PlacedPiece[]): string {
  const names = pieces.map((p) => `${PIECE_NAME[p.type]} on ${p.square}`)
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function lineText(t: LineTactic, owner: string): string {
  const front = `${owner} ${PIECE_NAME[t.front.type]}`
  const back = `${owner} ${PIECE_NAME[t.back.type]}`
  if (t.kind === 'pin') return `pinning ${front} to ${back}`
  return `a skewer: ${front} has to move and ${back} behind it can be taken`
}

function forkTip(forker: PlacedPiece): string {
  if (forker.type === 'n') return 'Watch for squares where an enemy knight could attack two of your pieces at once.'
  if (forker.type === 'p') return 'Watch for pawn pushes that attack two of your pieces at once.'
  return 'Watch for enemy moves that attack two things at once, especially with check.'
}
