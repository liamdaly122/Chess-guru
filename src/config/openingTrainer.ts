// Opening trainer: learn opening lines from the book with spaced repetition. Edit to tune.

export const OPENING_TRAINER = {
  /**
   * Days until a line comes back after playing it from memory with no mistakes (box 1 = 1 day,
   * box 2 = 3 days, ...). A clean run from the last box marks the line as mastered.
   */
  intervalsDays: [1, 3, 7, 14, 30],
  /** After showing a move, ask for the line again this many minutes later. */
  retryMinutes: 10,
  /** Played with a hint or a wrong move: same box, back after this many days. */
  helpedDays: 1,
  /** Pause before the opponent's move is played, so it can be followed. */
  replyDelayMs: 450,
  /** How many search results to list. */
  maxResults: 20,
  /** Suggestions from your games: at most this many lines. */
  maxSuggestions: 5,
  /** Shortcuts shown above the search box. */
  popular: [
    'Italian Game',
    'Ruy Lopez',
    'Sicilian Defense',
    'French Defense',
    'Caro-Kann Defense',
    "Queen's Gambit",
    'London System',
    'Scandinavian Defense',
    "King's Indian Defense",
    'English Opening',
    'Slav Defense',
    'Vienna Game',
  ],
}
