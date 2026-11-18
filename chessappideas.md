# Chess Guru: ideas for later

By Liam Daly. A list of possible improvements, roughly in the order I'd consider them. Effort is a rough guide: small (an afternoon), medium (a day or two), large (several days).

Done so far: human-like Maia-3 bots, installable app, puzzles from your own mistakes (with spaced repetition) and backup to Files / iCloud Drive.

## Accounts and saving progress

**Accounts and sync between devices** (medium)
Use Supabase (free tier): sign in with a magic link sent by email, and games, reviews and puzzle history sync between phone and laptop. The app stays offline-first: everything is saved locally as now and synced in the background when online.
Trade-offs: changes the original "no accounts or cloud database" rule; needs a Supabase project and its public key in the app (safe with row-level security); personal data then lives on a third-party server.

**Automatic Lichess import** (small)
Remember the Lichess username and fetch new finished games each time the app opens. Optionally review them in the background.

## Training

**Opening trainer** (medium)
Pick openings to learn (for White and Black). The app quizzes you on the lines from the opening book, with spaced repetition, and shows where your games usually leave the book.

**Endgame drills** (small to medium)
Classic endgames to practise against Stockfish from set positions: king and queen against king, king and rook against king, Lucena and Philidor positions, basic pawn endings.

**Try alternatives in review** (medium)
From any position in a saved game, play your own moves and see the engine's verdict and line. Only from saved games, so it can't help in a live game elsewhere.

**Show the opponent's threat** (small)
A training toggle in bot games: "what is my opponent threatening?" uses the existing null-move analysis to point at the threat.

## Progress and motivation

**An estimate of your playing rating** (small)
Estimate your rating from results against the bots (and accuracy). Use it to suggest a bot level, to set the starting puzzle rating, and to show progress in a single number.

**Adaptive bot** (small)
Optionally raise or lower the bot level automatically after wins and losses so games stay competitive.

**Daily goal and streaks** (small)
A small daily target (for example one game and five puzzles) with a streak counter.

**Puzzle modes** (small)
A timed "puzzle rush" and a "puzzle streak" mode that gets harder after each correct answer.

## Play experience

**Clocks for bot games** (small)
Optional time controls (for example 10+5), with the bot's thinking time matched to the clock.

**Sounds and haptics** (small)
Move, capture and check sounds, and a light vibration on phones.

**Board and piece themes** (small)
A few board colours and piece sets to choose from in Settings.

## Platform

**iPhone app with Capacitor** (medium)
Wrap the installable web app as a native iPhone app for the App Store or personal install. Needs a Mac with Xcode and an Apple developer account for distribution.
