# Chess Guru: ideas for later

By Liam Daly. A list of possible improvements, roughly in the order I'd consider them. Effort is a rough guide: small (an afternoon), medium (a day or two), large (several days).

Done so far: human-like Maia-3 bots, installable app, puzzles from your own mistakes (with spaced repetition), backup to Files / iCloud Drive, the opening trainer, automatic Lichess import (with background reviews), the rating estimate, the adaptive bot, the daily goal with streaks, mistakes grouped by pattern, and a Chess.com-style game review (key moments, Retry, Follow-up and Explore, which cover the old "guess the move" and "try alternatives" ideas), blunder check mode, Play it out (win the won position, hold the bad position), endgame drills, lessons for each mistake type, the threat quiz ("What does my opponent want?"), a Train home page with today's plan, the weekly report, board vision drills and the opening report.

## Becoming a better player

Ideas aimed at playing better, built on what the app already has (the engine, reviewed games and the coaching facts). None need a server or AI, and none can help in a live game elsewhere. Every idea from this section has been built; new ones go here.

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
