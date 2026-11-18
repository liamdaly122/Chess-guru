// Bot levels. Edit this table to tune how the bot plays.
//
// 400 to 1800: Maia-3, a neural network trained on millions of Lichess games to play like a
// human of a given rating. It makes the kind of mistakes real players at that level make.
// 2000 and up: Stockfish with UCI_LimitStrength, which is reliable at strong levels.
//
// Each Maia level has a Stockfish fallback, used only if the Maia model can't load
// (for example an old browser). Stockfish notes:
// - UCI_Elo is supported from 1320 to 3190 in Stockfish 19 (checked by asking the engine).
// - UCI_Elo 1320 equals Skill Level 0 (see Skill in Stockfish's search.h), so below that the
//   fallback adds random moves (`randomMoveChance`).
//
// Ratings are approximate. Maia's ratings are Lichess ratings; Stockfish's Elo scale was
// calibrated against engines.

export type StockfishSettings =
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

export interface MaiaSettings {
  kind: 'maia'
  /** The rating Maia plays as. */
  elo: number
  /** Used if Maia can't load. */
  fallback: StockfishSettings
}

export type EngineSettings = StockfishSettings | MaiaSettings

export interface Level {
  /** Approximate rating shown in the level picker. */
  rating: number
  label: string
  engine: EngineSettings
}

export const ENGINE_ELO_MIN = 1320
export const ENGINE_ELO_MAX = 3190

/** Minimum time Stockfish waits before moving, so instant replies don't feel jarring. */
export const MIN_BOT_DELAY_MS = 400

const maia = (elo: number, fallback: StockfishSettings): MaiaSettings => ({ kind: 'maia', elo, fallback })
const sfElo = (elo: number, moveTimeMs = 600): StockfishSettings => ({ kind: 'elo', elo, moveTimeMs })
const sfSkill = (depth: number, randomMoveChance: number): StockfishSettings => ({
  kind: 'skill',
  skill: 0,
  depth,
  randomMoveChance,
})

export const LEVELS: Level[] = [
  { rating: 400, label: 'Beginner', engine: maia(400, sfSkill(1, 0.5)) },
  { rating: 600, label: 'Novice', engine: maia(600, sfSkill(1, 0.35)) },
  { rating: 800, label: 'Casual', engine: maia(800, sfSkill(2, 0.22)) },
  { rating: 1000, label: 'Club beginner', engine: maia(1000, sfSkill(3, 0.12)) },
  { rating: 1200, label: 'Improver', engine: maia(1200, sfSkill(4, 0.05)) },
  { rating: 1400, label: 'Club player', engine: maia(1400, sfElo(1400)) },
  { rating: 1600, label: 'Strong club', engine: maia(1600, sfElo(1600)) },
  { rating: 1800, label: 'Advanced', engine: maia(1800, sfElo(1800, 700)) },
  { rating: 2000, label: 'Expert', engine: sfElo(2000, 800) },
  { rating: 2200, label: 'Master', engine: sfElo(2200, 900) },
  { rating: 2500, label: 'Grandmaster', engine: sfElo(2500, 1000) },
  { rating: 3190, label: 'Full limited strength', engine: sfElo(3190, 1000) },
]

export const DEFAULT_LEVEL_RATING = 1200

export function findLevel(rating: number): Level {
  return LEVELS.find((l) => l.rating === rating) ?? LEVELS.find((l) => l.rating === DEFAULT_LEVEL_RATING)!
}

/** Name shown for the bot at this level. */
export function botName(level: Level): string {
  return level.engine.kind === 'maia' ? 'Maia' : 'Stockfish'
}

/** The Stockfish settings for a level: its own, or the fallback for a Maia level. */
export function stockfishSettings(level: Level): StockfishSettings {
  return level.engine.kind === 'maia' ? level.engine.fallback : level.engine
}
