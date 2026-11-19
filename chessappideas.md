# Chess Guru: ideas for later

By Liam Daly. A list of possible improvements, roughly in the order I'd consider them. Effort is a rough guide: small (an afternoon), medium (a day or two), large (several days).

Done so far: human-like Maia-3 bots, installable app, puzzles from your own mistakes (with spaced repetition), backup to Files / iCloud Drive, the opening trainer, automatic Lichess import (with background reviews), the rating estimate, the adaptive bot, the daily goal with streaks, mistakes grouped by pattern, and a Chess.com-style game review (key moments, Retry, Follow-up and Explore, which cover the old "guess the move" and "try alternatives" ideas), blunder check mode, Play it out (win the won position, hold the bad position), endgame drills, lessons for each mistake type, the threat quiz ("What does my opponent want?"), a Train home page with today's plan, the weekly report, board vision drills and the opening report.

## Becoming a better player

Ideas aimed at playing better, built on what the app already has (the engine, reviewed games, Lichess imports and the coaching facts). None need a server or AI, and none can help in a live game elsewhere. The first set of ideas here is all built; this is the second set. Suggested order: the clock report, then the candidate moves drill, then calculate the line.

### Think better during a game

**Candidate moves drill** (small)
A position from one of my games: I pick my top 3 moves before the engine shows its ranking. The app tracks how often the best move was among my candidates. Trains comparing options before committing to one.

**Calculate the line** (medium)
Positions from my games where the winning idea is 3 or more moves deep. I play the whole line while the engine defends, and only the full line counts. Today's puzzles mostly reward finding one move; this trains seeing further ahead.

**Annotate before the engine** (small)
After a game, I mark the moves I think were mistakes before opening the review. The app then compares my marks with the engine's ("You spotted 2 of your 4 mistakes, and 1 move you worried about was fine"). Trains judging my own play.

### Learn from how I play, not just what I play

**Clock report** (small)
Import my clock times from Lichess with each game (`clocks=true`) and show where I go wrong against the clock, for example "You blunder 3 times as often under 30 seconds" or "You use 40% of your time in the opening".

**Tilt check** (small)
From game times and results, for example "After a loss, you lose 65% of your next games within 10 minutes". The coach suggests a break or a puzzle set instead of another game.

**Conversion and defence rates** (small)
How often I win positions where I was clearly better, and how often I save worse ones, over time. Shows whether Play it out practice is working.

### Openings and endgames from my own games

**Repertoire builder** (medium)
Instead of single lines, pick one reply in each position and build a tree. The opening trainer drills the whole tree, and the opening report flags games where I left my own repertoire.

**My endgames** (small)
Endgames I reached in my own games and handled badly, played out against the engine. Play it out limited to endgames, to go with the endgame drills.

### Board vision, one step further

**Blindfold mode** (small)
Play the bot at a low level with the pieces hidden or shown only as dots, and a "peek" button that counts against me. Builds on the board vision drills.

### Before a game, not during one

**Scout an opponent** (small)
Import a Lichess player's recent games and see which openings they play, to prepare before a game. Normal preparation, but the app can't tell whether that player's game has already started, so it relies on me using it only beforehand. Given the "no help during live games" rule, this one may be better left out.

## Accounts and saving progress

**Accounts and sync between devices** (medium)
Use Supabase (free tier): sign in with a magic link sent by email, and games, reviews and puzzle history sync between phone and laptop. The app stays offline-first: everything is saved locally as now and synced in the background when online.
Trade-offs: changes the original "no accounts or cloud database" rule; needs a Supabase project and its public key in the app (safe with row-level security); personal data then lives on a third-party server.

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
