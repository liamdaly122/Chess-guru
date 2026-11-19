import type { Color } from 'chess.js'

/**
 * Endgame drills: classic endgames to play out against full-strength Stockfish from set
 * positions. The lessons describe the general technique only; every position's result was
 * checked with the engine (scripts/check-endgames.mjs), and while you play, the engine rates
 * your moves as in any game.
 *
 * goal:
 *  - mate: deliver checkmate (no claiming; a draw by stalemate or the fifty-move rule fails)
 *  - win:  win; "Claim the win" appears once the engine rates it overwhelmingly winning
 *  - hold: draw or better; "Count it as held" appears after enough moves still holding
 */
export type EndgameGoal = 'mate' | 'win' | 'hold'

export interface EndgameDrill {
  id: string
  group: 'Basic checkmates' | 'Pawn endings' | 'Rook endings'
  name: string
  goal: EndgameGoal
  /** The technique, in two or three sentences. */
  lesson: string
  /** Starting positions (you are the side to move). Each Play takes the next one. */
  fens: string[]
}

export const ENDGAME_DRILLS: EndgameDrill[] = [
  {
    id: 'two-rooks',
    group: 'Basic checkmates',
    name: 'Two rooks: the ladder',
    goal: 'mate',
    lesson:
      'The rooks take turns: one cuts the king off along a rank or file, the other checks it back a row. Walk the king to the edge like climbing a ladder. If the king attacks a rook, move that rook to the far side of the board.',
    fens: ['8/8/8/4k3/8/8/8/R3K2R w - - 0 1', '8/8/3k4/8/8/8/8/1R2K1R1 w - - 0 1'],
  },
  {
    id: 'queen-mate',
    group: 'Basic checkmates',
    name: 'King and queen',
    goal: 'mate',
    lesson:
      "Use the queen a knight's move away from the enemy king to shrink its box, then bring your own king up. Once the king is on the edge, mate with the queen protected by your king. Always check that the enemy king still has a move: stalemate is the only way to throw this away.",
    fens: ['8/8/8/4k3/8/8/8/3QK3 w - - 0 1', '8/8/2k5/8/8/8/8/Q3K3 w - - 0 1', '7k/8/8/8/8/8/8/KQ6 w - - 0 1'],
  },
  {
    id: 'rook-mate',
    group: 'Basic checkmates',
    name: 'King and rook',
    goal: 'mate',
    lesson:
      'Cut the enemy king off with the rook, then walk your king towards it. When the kings stand face to face, check from the side to push the king back a row. When the king steps away, make a waiting move with the rook. Repeat until it reaches the edge.',
    fens: ['8/8/8/4k3/8/8/8/R3K3 w - - 0 1', '8/8/3k4/8/8/8/8/4K2R w - - 0 1'],
  },
  {
    id: 'two-bishops',
    group: 'Basic checkmates',
    name: 'Two bishops',
    goal: 'mate',
    lesson:
      'Put the bishops side by side in the middle: together they make a wall the king cannot cross. Bring your king up to help, push the enemy king into a corner, and mate it there. Take care with stalemate in the corner.',
    fens: ['8/8/8/3k4/8/2B5/3KB3/8 w - - 0 1', '8/8/8/8/2k5/8/8/2BBK3 w - - 0 1'],
  },
  {
    id: 'pawn-win',
    group: 'Pawn endings',
    name: 'King and pawn: win it',
    goal: 'win',
    lesson:
      'Walk your king in front of the pawn, not behind it. The key is the opposition: when the kings face each other with one square between them, the side that does not have to move wins the fight. Push the pawn only when your king already controls the squares in front of it.',
    fens: ['4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1'],
  },
  {
    id: 'pawn-hold',
    group: 'Pawn endings',
    name: 'King and pawn: hold the draw',
    goal: 'hold',
    lesson:
      "Keep your king straight in front of the pawn. When the enemy king comes level with the pawn, take the opposition. On the back rank, step straight back in front of the pawn: then White's last push gives stalemate or loses the pawn.",
    fens: ['4k3/8/8/4P3/4K3/8/8/8 b - - 0 1'],
  },
  {
    id: 'lucena',
    group: 'Rook endings',
    name: 'Lucena: build a bridge',
    goal: 'win',
    lesson:
      "Your king is stuck in front of its own pawn. First drive the enemy king further away with a rook check from the side. Then bring your rook up to the fourth rank. Now step out with your king, and when the checks come, block with the rook: that is the bridge.",
    fens: ['1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1'],
  },
  {
    id: 'philidor',
    group: 'Rook endings',
    name: 'Philidor: hold with the rook',
    goal: 'hold',
    lesson:
      "Keep your king in front of the pawn and your rook on your third rank (the sixth from White's side), so the enemy king can't come forward. As soon as the pawn steps onto that rank, swing your rook to the back of the board and check from behind.",
    fens: ['4k3/R7/7r/4KP2/8/8/8/8 b - - 0 1'],
  },
]

export const ENDGAME_LEVEL = 3190

export function sideToMove(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w'
}

/** The record key for a drill's tries. */
export function drillRecordId(id: string): string {
  return `endgame:${id}`
}
