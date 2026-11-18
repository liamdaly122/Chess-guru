// Bot levels. Edit this table to tune how the bot plays.
//
// How Stockfish weakens itself:
// - UCI_LimitStrength + UCI_Elo: supported from 1320 to 3190 in Stockfish 19
//   (checked by asking the engine for its options).
// - Internally, UCI_Elo is converted to Skill Level, and UCI_Elo 1320 equals
//   Skill Level 0 (see Skill in Stockfish's search.h). So Skill Level alone
//   cannot play much below about 1320.
// - For the levels below 1320 we use Skill Level 0, a shallow search depth and a
//   chance of playing a random legal move instead of the engine's choice.
//   These mistakes are random rather than human-like. Phase 6 replaces the low
//   levels with Maia, which is trained to make human mistakes.
//
// The ratings are approximate. Stockfish's Elo scale was calibrated against
// other engines, not against Lichess or Chess.com players.

export type EngineSettings =
  | {
      kind: 'elo'
      /** Passed to UCI_Elo. Must be between ENGINE_ELO_MIN and ENGINE_ELO_MAX. */
      elo: number
      /** Thinking time per move in milliseconds. */
      moveTimeMs: number
    }
  | {
      kind: 'skill'
      /** Stockfish Skill Level, 0 to 20. */
      skill: number
      /** Maximum search depth in plies. */
      depth: number
      /** Chance (0 to 1) of playing a random legal move instead of the engine move. */
      randomMoveChance: number
    }

export interface Level {
  /** Approximate rating shown in the level picker. */
  rating: number
  label: string
  engine: EngineSettings
}

export const ENGINE_ELO_MIN = 1320
export const ENGINE_ELO_MAX = 3190

/** Minimum time the bot waits before moving, so instant replies don't feel jarring. */
export const MIN_BOT_DELAY_MS = 400

export const LEVELS: Level[] = [
  { rating: 400, label: 'Beginner', engine: { kind: 'skill', skill: 0, depth: 1, randomMoveChance: 0.5 } },
  { rating: 600, label: 'Novice', engine: { kind: 'skill', skill: 0, depth: 1, randomMoveChance: 0.35 } },
  { rating: 800, label: 'Casual', engine: { kind: 'skill', skill: 0, depth: 2, randomMoveChance: 0.22 } },
  { rating: 1000, label: 'Club beginner', engine: { kind: 'skill', skill: 0, depth: 3, randomMoveChance: 0.12 } },
  { rating: 1200, label: 'Improver', engine: { kind: 'skill', skill: 0, depth: 4, randomMoveChance: 0.05 } },
  { rating: 1400, label: 'Club player', engine: { kind: 'elo', elo: 1400, moveTimeMs: 600 } },
  { rating: 1600, label: 'Strong club', engine: { kind: 'elo', elo: 1600, moveTimeMs: 600 } },
  { rating: 1800, label: 'Advanced', engine: { kind: 'elo', elo: 1800, moveTimeMs: 700 } },
  { rating: 2000, label: 'Expert', engine: { kind: 'elo', elo: 2000, moveTimeMs: 800 } },
  { rating: 2200, label: 'Master', engine: { kind: 'elo', elo: 2200, moveTimeMs: 900 } },
  { rating: 2500, label: 'Grandmaster', engine: { kind: 'elo', elo: 2500, moveTimeMs: 1000 } },
  { rating: 3190, label: 'Full limited strength', engine: { kind: 'elo', elo: 3190, moveTimeMs: 1000 } },
]

export const DEFAULT_LEVEL_RATING = 1200

export function findLevel(rating: number): Level {
  return LEVELS.find((l) => l.rating === rating) ?? LEVELS.find((l) => l.rating === DEFAULT_LEVEL_RATING)!
}
