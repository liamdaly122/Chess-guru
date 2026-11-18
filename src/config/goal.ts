// Daily goal and streaks. Edit to tune.

export const GOAL = {
  /** Starting goal: games finished and puzzles done each day. */
  defaultGames: 1,
  defaultPuzzles: 5,
  /** Choices offered when changing the goal. */
  gameChoices: [0, 1, 2, 3, 5],
  puzzleChoices: [0, 3, 5, 10, 15, 20, 30],
  /** Days of puzzle counts to keep. */
  keepDays: 90,
  /** The "goal done" message hides itself after this long. */
  messageMs: 8000,
}
