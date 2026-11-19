# Chess Guru: ideas for later

By Liam Daly. A list of possible improvements, roughly in the order I'd consider them. Effort is a rough guide: small (an afternoon), medium (a day or two), large (several days).

Done so far: human-like Maia-3 bots, installable app, puzzles from your own mistakes (with spaced repetition), backup to Files / iCloud Drive, the opening trainer, automatic Lichess import (with background reviews), the rating estimate, the adaptive bot, the daily goal with streaks, mistakes grouped by pattern, and a Chess.com-style game review (key moments, Retry, Follow-up and Explore, which cover the old "guess the move" and "try alternatives" ideas), blunder check mode, and Play it out (win the won position, hold the bad position).

## Becoming a better player

Ideas aimed at playing better, built on what the app already has (the engine, reviewed games and the coaching facts). None need a server or AI, and none can help in a live game elsewhere. Suggested order: endgame drills (under Training below), then short lessons for each mistake type.

### Think, don't just react

**What does my opponent want?** (small)
Now and then during a bot game the coach asks me to tap the square my opponent is threatening, then shows the answer. Uses the existing null-move threat analysis. Replaces the earlier "show the opponent's threat" idea.

**Board vision drills** (small)
Short exercises without moving pieces, for example "Which of your pieces are undefended?", "Tap every square the knight attacks" or "After these three moves, where is the bishop?". Trains what calculating needs.

### Learn from patterns in my games

**Weekly report** (small)
Once a week: accuracy trend, most common kind of mistake, weakest game phase, best and worst openings, and one thing to focus on with a link to the right drill. Written from templates using my own numbers.

**Opening report** (small)
For each opening I play: games, score, how long I stay in book, and how the position looks at move 10. Shows which openings cost me points and links to the opening trainer.

**Short lessons for each mistake type** (medium)
A lesson for each of the 8 kinds of mistake the coach already finds (loose pieces, forks, pins and skewers, threats, king safety, missed tactics, missed mates, general): a few paragraphs, then 5 matching puzzles. Progress links to the lesson for my biggest weakness.

## Accounts and saving progress

**Accounts and sync between devices** (medium)
Use Supabase (free tier): sign in with a magic link sent by email, and games, reviews and puzzle history sync between phone and laptop. The app stays offline-first: everything is saved locally as now and synced in the background when online.
Trade-offs: changes the original "no accounts or cloud database" rule; needs a Supabase project and its public key in the app (safe with row-level security); personal data then lives on a third-party server.

## Training

**Endgame drills** (small to medium)
Classic endgames to practise against Stockfish from set positions: king and queen against king, king and rook against king, Lucena and Philidor positions, basic pawn endings.

## Progress and motivation

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
