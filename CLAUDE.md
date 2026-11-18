# Chess Guru: project notes

Author: Liam Daly. Personal chess coaching app. Plays against the user at set rating levels and coaches during and after games.

## The core rule

The chess engine is the source of truth for all analysis. Coaching text is built in code from facts the engine and our own code have already worked out. Nothing guesses about a position.

## How to run

```bash
npm install      # also copies the Stockfish files into public/engine/
npm run dev      # http://localhost:5173
npm test         # unit tests (Vitest)
npm run lint     # oxlint
npm run build    # type-check and production build into dist/
npm run build:openings   # rebuild src/data/openings.json from Lichess's opening list
npm run build:puzzles    # rebuild src/data/puzzles.json from the Lichess puzzle database (~300 MB stream)
npm run ui:tour          # with npm run dev running: screenshots of every page into ui-shots/ (needs Playwright)
```

Testing tip: open `http://localhost:5173/?fen=<FEN>` to start a game from any position. You play the side to move. Useful for promotion, mates and draws. **Development server only** (`import.meta.env.DEV`): on the live site it would let anyone paste a position from a game they are playing elsewhere and get engine help. e.g.
`?fen=k7%2F4P3%2F8%2F8%2F8%2F8%2F8%2F4K3%20w%20-%20-%200%201`

## Hosting (Vercel)

- Hosted on Vercel, connected to the GitHub repo, so every push deploys automatically.
- `vercel.json` sets the Vite build (`npm install`, `npm run build`, output `dist`). Install runs `postinstall`, which copies the engine, so `dist/engine/` is included.
- The repo's only branch, `claude/stoic-archimedes-udsblu`, is GitHub's default branch, so Vercel treats it as production. If a `main` branch is added later, check Vercel's production branch setting.
- The app is fully static (no server), so no environment variables are needed on Vercel.

## Decisions

- **No Claude API, no server.** The user decided not to pay for API credits. Coaching notes will be generated in code from structured engine facts (templates). Keep coaching text generation in one module (`src/coach/`, from Phase 3) so an AI layer could be added later if wanted. With no server, there is no `.env`; `.env` is still gitignored in case one is added.
- **Stockfish 19, lite single-threaded WASM build** (npm `stockfish@19.0.1`, pinned). No cross-origin isolation headers needed, about 1.8 MB, works in iOS web views. Trade-off: a little weaker and slower per move than the full multi-threaded build, but far stronger than any human. Each engine instance runs in its own Web Worker, so the bot and the analyser (Phase 2) still use separate CPU cores.
- `scripts/copy-engine.mjs` copies the engine into `public/engine/stockfish.js` and `.wasm` (version-free names; the engine finds its `.wasm` by swapping the extension). Runs on `postinstall`, `predev` and `prebuild`. `public/engine/` is gitignored.
- **UCI_Elo range is 1320 to 3190** (checked by asking the engine). In Stockfish's source, UCI_Elo is converted to Skill Level and 1320 equals Skill Level 0, so Skill Level alone cannot play below about 1320. Since Phase 6 the levels below 2000 are played by Maia; the old Skill Level + random-move settings remain only as Maia's fallback.
- Levels are approximate. Stockfish's Elo is calibrated against engines, not Lichess or Chess.com players. Elo levels use a fixed `movetime` per move so they stay consistent.
- The opponent sits behind `OpponentEngine` (`src/engine/OpponentEngine.ts`). `BotOpponent` routes each level to Maia or Stockfish.
- Game state is a list of UCI moves (plus an optional start FEN). The chess.js game is rebuilt from it with `useMemo`, so undo, threefold repetition and the move list all come from one source.
- Undo takes back your move and the bot's reply (or just your move if the bot hasn't replied). Each undo increments a `takebacks` counter, kept for later phases (games with takebacks should be marked, and undone moves should not count in stats).
- **Analysis (Phase 2):** a second Stockfish worker at full strength (`src/engine/Analyser.ts`) analyses every position of the game in order, through `src/analysis/AnalysisQueue.ts`. Results are cached by FEN, so undo and replay don't redo work. Positions that drop out of the game are skipped and their search stopped. Settings (depth 16, 4 s cap, MultiPV 2) live in `src/config/analysis.ts`. Depth 16 measured at 0.4 to 0.8 s per position on a laptop; phones are slower, hence the time cap.
- Never send an engine a position chess.js hasn't validated. An illegal FEN (e.g. side not to move in check) crashes the Stockfish WASM worker.
- The analyser is given only the FEN, not the move history, so it can't see threefold repetition. Acceptable for ratings.
- **Scores** (`src/chess/score.ts`): `{ kind: 'cp' }` or `{ kind: 'mate', moves, forUs }`. "mate 0" from UCI means the side to move is checkmated; storing who mates (not a signed number) avoids the +0/-0 problem.
- **Win% and ratings** follow Lichess: Win% = 50 + 50 * (2 / (1 + e^(-0.00368208 * cp)) - 1), cp capped at +/-1000, mate in N counted as (21 - min(N, 10)) * 100 cp. Rating by Win% drop: 5 inaccuracy, 10 mistake, 15 blunder (Lichess's 0.1/0.2/0.3 on its -1..1 scale). Plus Lichess's mate rules: allowing a forced mate is a blunder (mistake below -7, inaccuracy below -10); missing a forced mate is a blunder (mistake if still above +7, inaccuracy if above +10). The worse of the two ratings is used. The engine's top move is always "best"; delivering checkmate is always "best". Thresholds in `src/config/analysis.ts`.
- Ratings are derived (not stored) from the analysis cache and the move list, so undone moves simply disappear.
- The eval bar uses Win% for its fill, like Lichess. It can be hidden (setting stored in localStorage).
- **Ratings, extra levels (Phase 3):** "great" (!) = engine's top move and the second-best line is at least `GREAT_MOVE_GAP` (10) Win% worse. "brilliant" (!!) = best or great, gives up at least 2 pawns of material (`patterns/sacrifice.ts`, via SEE), not already above 97% Win% before, and not below 40% after. Settings in `src/config/coach.ts`. Glyphs: !! ! ★ ✓ ?! ? ✕ (blunder uses ✕ at the user's request).
- **Pattern detectors** (`src/patterns/`, all unit tested): static exchange evaluation (`see.ts`) with x-rays and the king-capture rule; hanging pieces = SEE > 0 (not raw attacker counting); forks (target counts if king, worth more than the forker, or undefended; forker must not be winnable); pins and skewers by ray scanning; threats via a null-move position analysed by the engine (`threats.ts`), counted only if worth at least `threatMinGain` Win% and the opponent's best reply after our move is still the threat move.
- **Coaching** (`src/coach/`): `facts.ts` gathers facts from the engine lines plus the detectors, run on the position after the opponent's best reply and after the engine's best move. `notes.ts` turns the top fact into one sentence on what went wrong plus one "next time" tip. Templates only; no AI. Notes only for mistakes and blunders (`COACH.noteRatings`). No caching needed since there is no API cost.
- Null-move positions are requested from the analysis queue as "extras" only after a mistake or blunder, and processed after the game positions.
- **Hints** (`coach/hints.ts`): step 1 says there's something here only if best beats second best by `HINTS.tacticGap` Win% (or there's a forced mate); otherwise it says the position is quiet. Step 2 glows the piece's square, step 3 draws the arrow. Hinted moves are recorded (`hintedPlies`) and shown with a bulb in the move list.
- **Live coaching**: with it on, the bot waits for the rating of your move (max `COACH.botWaitsForRatingMs`, 2.5 s) so the badge appears on your piece before the bot replies. With it off, ratings and notes are hidden until the game ends, and the coach card then shows a summary.
- **Board badge** is drawn on an overlay layer (not react-chessboard's `squareRenderer`, which would replace its square styling). It stays on your last move's square until your next move, and hides if the bot captured that piece. Sized with container query units (`cqw`).
- UI: system font stack, CSS variables for light and dark themes, sage board colours, `<dialog>` for New game and Settings (bottom sheet on phones), preferences in localStorage (`usePreferences`).
- **Saving games (Phase 4)**: IndexedDB via `idb` (`src/storage/`). One store, `games`, keyed by id, indexed by `endedAt`. Bot games are saved when they end and again when the review is complete; games where the user never moved aren't saved. Starting a new game mid-game saves it as a loss by resignation (the New game sheet says so and also offers "Just resign"). Bump `DB_VERSION` in `storage/db.ts` with an upgrade step when the stores change.
- **GameRecord** (`storage/types.ts`) stores UCI moves, players, result, termination, opening/ECO, takebacks, hinted plies and a `review` (`review/types.ts`). The `pgn` field is rebuilt on every save from the record: headers, `[%eval]` tags, rating, best move, win chances and coaching note as comments. No line wrapping, because chess.js's `maxWidth` splits `[%eval x]` tags across lines.
- **Review** (`features/review/`): if `game.review.complete`, it is shown straight from storage with no engine. Otherwise the analyser runs (`useGameAnalysis(..., { enabled })`) and the finished review is saved. Board read-only with the badge, a "Best" button that shows the position before the move with a green arrow for the engine's move (hidden for best/great/brilliant/book moves; an arrow drawn on the position after the move was confusing), eval bar, eval graph (tap to jump), arrow keys, move list jumps, summary with accuracy, rating counts and lessons, PGN download/copy, delete.
- **Accuracy**: Lichess per-move formula (with its +1 bonus, exact constants), game accuracy = plain average of the user's moves (Lichess also weights by volatility; not worth it here).
- **Lessons** (`review/lessons.ts`): the user's mistakes/blunders grouped by the coaching fact behind them (loose pieces, forks, pins/skewers, threats, king safety, missed tactics, missed mates, general), ranked by total Win% lost, top 3. Templates, no AI.
- **Lichess import** (`lichess/importGames.ts`): `GET /api/games/user/{name}?max=N&moves=true&opening=true&ongoing=false&finished=true`, `Accept: application/x-ndjson`, straight from the browser (Lichess allows CORS). Games with status created/started/aborted/noStart are dropped, as are variants other than standard/fromPosition and games without the user. Re-importing keeps any existing review. Note: from this cloud dev container Lichess returns 404 for game exports (it seems to block data-centre IPs), so the importer is tested with mocked responses; it works from a normal browser.
- **Backups** (`storage/backup.ts`): JSON backup of every record (restore validates entries), and all games as one PGN. Needed because Safari can clear site storage.
- **Navigation**: hash routes (`#/`, `#/games`, `#/review/<id>`) in `app/route.ts`, no router library. The play screen stays mounted (hidden) so a game in progress survives visiting other pages.
- **Opening book**: Lichess `chess-openings` list (public domain/CC0), turned into `src/data/openings.json` by `scripts/build-openings.mjs` (committed; rerun the script to update). Keys are positions (FEN without move counters), so transpositions count. Value `[eco, name]` or `0` for an unnamed position on the way to a named line. Loaded lazily (~90 KB gzipped). Book = every position since the normal start is in the table; once out, the game stays out. Book moves get the `book` rating (set in `useGameAnalysis` via `bookPlies`), no coaching note, and no "best was". The play screen shows the opening name, how long it stayed in book, the book moves from the current position (folded away, only with live coaching on), and a note when your move left the book listing the book moves there. The opening and ECO are saved with bot games.
- **Game phases (Phase 5)** (`review/gamePhase.ts`, settings in `config/phases.ts`): endgame when at most 6 queens/rooks/bishops/knights are left; opening while in book, or before half-move 20 with more than 10 such pieces; otherwise middlegame. Stored on each `PlyReview` as `phase`; older reviews are classed on the fly.
- **Progress** (`progress/stats.ts`, `features/progress/`): only complete reviews count; book moves are excluded from losses. Losses by phase use average Win% lost per move (fair across phases of different length; the weakest phase needs at least 5 moves). Losses by kind of mistake use the coaching fact category of each mistake/blunder. Accuracy trend: one dot per reviewed game, rolling average of 5. "Review them now" runs `BatchReviewer`, which reuses `useGameReview` (shared with the review screen) one game at a time.
- **Puzzles**: `scripts/build-puzzles.mjs` streams Lichess's puzzle CSV (CC0). Lichess compresses it with pzstd: many zstd frames, each preceded by a 12-byte skippable frame holding its size. Node's streaming zstd stops after the first frame, so the script splits frames itself and decompresses each with `zstdDecompressSync`. Keeps popular, well-tested puzzles (popularity >= 85, plays >= 1000, rating deviation <= 80), up to 20 per (theme, 200-point band) for 26 themes: about 3,800 puzzles, ~180 KB gzipped, lazy loaded. Format `[id, fen, moves, rating, themes]`; the first move is the opponent's set-up move.
- **Puzzle trainer** (`puzzles/puzzle.ts`, `features/puzzles/`): the solution move or any mating move is accepted (like Lichess); wrong tries leave the board unchanged. Hint (glows the piece) and "show solution" count as not solved. Rating is Elo-style (K=32, starts at 1200), stored in the IndexedDB `meta` store; every attempt goes in `puzzleAttempts` (DB version 2). Themes: "your weak spots" mixes `recommendedThemes()` (themes mapped from your costliest mistake categories, then your weakest phase, then common tactics); each theme can be picked directly. Puzzles already tried are skipped.
- **Navigation**: four sections (Play, Games, Progress, Train). On screens up to 700px wide the tabs become a fixed bottom tab bar.
- Board square styles use `backgroundImage` for dots/check gradients and `backgroundColor` for highlights; mixing the `background` shorthand with `backgroundColor` makes React warn.
- **Maia (Phase 6)**: Maia-3 (CSSLab, University of Toronto, 2026; code and weights AGPL-3.0), 5M model, run in the browser with `maia3-js` (MIT, third-party, by Cem Unuvar) and `onnxruntime-web` (CPU/WebAssembly build only, single-threaded, so no COOP/COEP). Chosen over Maia-2 (MIT, older) by the user, accepting the AGPL condition: the app links to its source code (Settings > About). Levels 400 to 1800 are Maia at that rating; 2000+ are limited Stockfish (`config/levels.ts`). Each Maia level keeps a Stockfish fallback, used if the model can't load or returns an illegal move (`engine/BotOpponent.ts`).
  - Research results (80 puzzle positions, Stockfish depth 12, `scripts/maia-strength.mjs`): loss per move falls with rating (400: 33 Win% avg, 60% blunders; 800: 26/49%; 1200: 25/49%; 1800: 19/38%; 2100: 18/35%). Ratings 1000 to 1500 look similar on tactical positions. Maia's rating input is continuous (clamped 0 to 5000), not buckets.
  - Sampling: temperature 0 plays the same game every time; `MAIA.temperature` 0.6 with `topP` 0.95 gives variety (several replies to 1.e4) for a small strength cost. Human-like think time 0.6 to 1.6 s (`config/maia.ts`).
  - Maia gets the game's previous positions (`priorFens`, up to 8) for better predictions.
  - Runs in a module Web Worker (`engine/maia.worker.ts`, `worker.format: 'es'` in Vite). The model (22.5 MB) is self-hosted at `/maia/maia3-5m.onnx`; ONNX Runtime's wasm (14.8 MB) at `/ort/`. Both are copied by `scripts/copy-engine.mjs` (gitignored). `onnxruntime-web` is aliased to `onnxruntime-web/wasm` (avoids the 24 MB WebGPU build). Only `{ wasm: url }` is passed as `wasmPaths`: pointing at the `.mjs` loader in public/ breaks the Vite dev server, and the bundled build already contains the loader. Vite also emits an unused copy of the wasm into `dist/assets/`; the service worker never downloads it.
  - Loaded lazily when a Maia level starts; maia3-js keeps the model in Cache Storage. The play screen shows download progress, or a note if it fell back to Stockfish.
- **Installable app (PWA)**: `public/manifest.webmanifest`, icons in `public/icons/` (rendered from the brand mark), Apple meta tags in `index.html`. Service worker template `src/sw/sw-template.js`, turned into `dist/sw.js` at build time by the `serviceWorker()` plugin in `vite.config.ts` with the list of files to cache up front (everything except Maia, ONNX Runtime and the unused wasm copy) and a version hash. Page loads are network-first with the cached app as offline fallback; other files cache-first. Cache lookups use `ignoreVary` (the server sends `Vary: Origin`, which made module requests miss). A new version waits and shows the "new version ready" banner; the page reloads only when the user taps Reload (never on first install, which would lose a game). Registered in production builds only. `navigator.storage.persist()` is requested at start-up; Settings shows the storage status and install instructions (Install button on Chrome/Android, Share > Add to Home Screen on iOS). `vercel.json` sends `no-cache` for `/sw.js` and long caching for hashed `/assets/`.
- **Phone layout (up to 700px)**: on the Play screen the logo is hidden and a coach speech bubble sits at the top (like Chess.com), then a one-line scrolling move strip, then the board edge to edge (7px eval bar, slim player strips), the action buttons and the bottom tab bar. The bubble's content comes from `features/play/coachMessage.ts` (pure, tested): bot download note, then hint step, then game-over tally, then the last move's rating with note (two lines, "More" shows the tip). On phones the full coach card is hidden during play (shown after the game for the summary) and the moves card is hidden (the strip replaces it). Classes `mobile-only` / `desktop-only`; `App` adds `route-<name>` to the root. Measured: iPhone 13 board 383px wide (was 334px) and everything fits above the tab bar in Safari; the small iPhone SE needs a short scroll.
- **Coach bubble**, styled after Chess.com's coach (user's request), used everywhere the coach speaks: above the board on phones, in the side column on desktop Play, and on Review (phone and desktop, text from `features/review/reviewMessage.ts`). Mistakes and blunders also name the best move if the note doesn't. Parts: avatar, speech bubble with tail, heading row (rating badge, "Nf3 is a mistake", Tip button, evaluation chip light/dark by side), full note text (never truncated; an earlier 2-line clamp hid text with no way to expand). The tip shows on tapping Tip. Content from `coachMessage.ts`.
- **Mistake puzzles** (`puzzles/mistakes.ts`, settings `config/mistakes.ts`, UI `features/puzzles/MistakeTrainer.tsx`, route `#/puzzles/mistakes`): every mistake/blunder of yours in a complete review becomes a puzzle (position before your move, solution = engine best move, with the game's coach note and tip). Correct = the engine move, any checkmate, or a move the engine (depth 14, 3 s, `useAnalyser`) rates within 5 Win% of the best. Spaced repetition: clean solve moves up a box (due after 1, 3, 7, 14 days), a clean solve from the last box = mastered (dueAt = `NEVER`, a large number so JSON backups keep it); hint or wrong tries then solved = same box, tomorrow; show answer = box 0, back in 10 minutes. New puzzles are due from the game's end time so they show at once. The puzzle on screen is pinned until Next (a list reload once swapped it mid-solve), and ordering is stable (`byDue`). Stored in IndexedDB `mistakePuzzles` (DB version 3), synced from reviewed games by `useMistakePuzzles` (existing schedules kept). Counts on the Puzzles switch and the Progress page.
- **Opening trainer** (`openings/lines.ts`, `openings/drill.ts`, `openings/fromGames.ts`, settings `config/openingTrainer.ts`, UI `features/openings/OpeningTrainer.tsx` and `OpeningLines.tsx`, routes `#/puzzles/openings` and `#/puzzles/openings-lines`). Lines are the named lines of the Lichess opening list with their moves: `scripts/build-openings.mjs` also writes `src/data/openingLines.json` (`[eco, name, "e4 e5 Nf3"]`, about 3,900 lines, ~50 KB gzipped, lazy loaded). Names repeat across move orders, so a line's id is its moves. You pick lines by name (search plus shortcut chips) or from "From your games": for each game where you (not the opponent) left the book, the shortest named line that continues from that position, counted across games (games where the book simply ran out are skipped). Each line is learnt from one side (`OpeningDrill`, id `<w|b>:<moves>`, moves stored with it). First run: the arrow shows your moves and slips aren't counted; the line then comes straight back to play from memory. The app plays the other side after `replyDelayMs`. Another book move that isn't this line's says so with no penalty; a non-book move counts as wrong. Hint glows the piece, "Show move" draws the arrow (counts as failed). Schedule: shared `training/srs.ts` (also used by mistake puzzles), boxes 1, 3, 7, 14, 30 days. Stored in IndexedDB `openingDrills` (DB version 4). The Puzzles section is now called **Train** (tab and title), with three modes: Mistakes, Puzzles, Openings, each with a count of what's due. Progress links to it.
- **Automatic Lichess import** (`lichess/autoSync.ts`, settings `config/lichess.ts`, switches in the Games page import card). Settings and status in the `meta` store (key `lichessSync`: username, auto, autoReview, lastCheckAt, lastCreatedAt, lastAdded, unseen, lastError; not in backups). `useAutoLichessCheck` (in `App`) checks when the app opens, comes back on screen or goes back online, at most every 15 minutes, never while offline; "Check now" forces it. First check: last 20 games; later checks use Lichess's `since` (games *started* after a time) from the newest game seen minus a 3-day overlap, so long games that finish later aren't missed, up to 100 per check. Games already stored are skipped. Same finished-games-only request as the manual import. A different username starts afresh. New games show a banner ("2 new games from Lichess. See them") on every page except Play, cleared on the Games page or with ×. With "Review them automatically", unreviewed Lichess games (newest first, up to 20) are queued at start-up and after each check.
- **Background reviews** (`review/reviewQueue.ts`, `features/review/BackgroundReviewer.tsx`): one in-memory queue, worked through by one reviewer mounted in `App` with a status bar at the top. Paused (unmounted) on Play and Review, so it never competes with a game or an open review for the engine. Progress's "Review them now" queues there too (its card hides while they are queued). Deleted games are skipped. Not persisted: after a reload, automatic review queues unreviewed games again.
- **Rating estimate** (`rating/estimate.ts`, settings `config/rating.ts`): a performance rating from your last 20 bot games: the rating whose Elo expected score against the bot levels equals your score, plus one imaginary draw against the average level (so all wins or all losses stay finite), with about one standard error as "±". Needs 3 games. Only bot games from the normal start with no takebacks and no hints count. Accuracy isn't used (it varies too much at any rating to predict one). The bot levels are Maia's Lichess-style ratings (Stockfish above 1800), so the estimate is on roughly that scale. Shown on Progress (with the change over the last 10 games and your latest Lichess rating per speed from imported games), in the New game sheet ("Your rating: about 1300" with a "Play at 1400" chip for the nearest level, the higher on a tie), and used as the starting puzzle rating until your first puzzle (kept between 600 and 2400).
- **Adaptive bot** (`rating/adaptive.ts`, `ADAPTIVE` in `config/rating.ts`): a switch in the New game sheet, saved with the new-game settings. After a finished game (you moved, normal start): up one level after a win, down after a loss, same after a draw or a win with takebacks. The game-over card shows "▲ Next game: 1400 Club player" and its Rematch button becomes "Play 1400"; the New game sheet also starts at the new level.
- **Backups v3** (`storage/backup.ts`): also opening lines; v1 and v2 files still restore. Before that, **Backups v2**: also puzzle rating, puzzle attempts and mistake puzzles; version 1 files still restore. "Back up to Files / iCloud" uses the Web Share API with the file (iPhone share sheet: Save to Files > iCloud Drive), falling back to a download. Last backup time in the `meta` store; the Games page shows it and highlights the card after 7 days. A web app cannot back up to iCloud automatically in the background.
- **UI tidy (Nov 2026)**: on phones the logo bar is hidden on every page (the tab bar is the navigation), filter and theme chips scroll in one row, and the Review and Puzzle boards are edge to edge like Play. The Review summary puts the rating counts next to the accuracy ring. Games rows show the opening on its own line. Progress says "same as your average" for no change and "No moves yet" for empty phases.
- Board: react-chessboard v5 (`options` prop). It has no built-in promotion dialog, so `PromotionPicker` is ours. Tap-to-move is supported for phones.

## Defaults chosen (user didn't answer these, change if wanted)

- Levels from 400 to 3190 (see `src/config/levels.ts`).
- Untimed games. A clock can be added later.
- Undone moves won't count in ratings or stats (applies from Phase 2).
- Coaching notes will show during the game, with a switch to hold them until the end (Phase 3).

## Layout

```
scripts/copy-engine.mjs        copies Stockfish into public/engine
src/config/levels.ts           bot levels (edit to tune)
src/engine/uciEngine.ts        UCI over a Web Worker, queued commands
src/engine/OpponentEngine.ts   opponent interface
src/engine/StockfishOpponent.ts
src/chess/gameStatus.ts        mate, stalemate, draws
src/chess/moves.ts             UCI parsing, UCI to SAN, undo logic
src/chess/score.ts             evaluation type, Win% (Lichess formula), formatting
src/chess/classify.ts          move ratings
src/config/analysis.ts         analysis depth, rating thresholds, mate rules (edit to tune)
src/engine/uciInfo.ts          parses engine "info" lines
src/engine/Analyser.ts         full-strength analysis engine
src/analysis/                  analysis queue and the React hook that rates moves, writes notes and builds hints
src/patterns/                  tactical pattern detectors (SEE, hanging, forks, pins/skewers, threats, sacrifice)
src/coach/                     coaching facts, note templates, hints
src/config/coach.ts            coaching, great/brilliant and hint settings (edit to tune)
src/chess/material.ts          captured pieces and material lead
src/ui/                        styles, icons, switch, modal
src/app/route.ts               hash routes
src/storage/                   IndexedDB games store, backups, React hooks, game display helpers
src/review/                    review data, lessons, rating words for PGN
src/pgn/exportPgn.ts           annotated PGN
src/lichess/importGames.ts     Lichess import
src/lichess/autoSync.ts        automatic Lichess import (settings, checks, banner state)
src/config/lichess.ts          automatic import timings and limits (edit to tune)
src/review/reviewQueue.ts      games waiting for a background review
src/openings/                  opening book lookup + hook; data in src/data/openings.json
scripts/build-openings.mjs     rebuilds the opening table from Lichess's list
src/features/games/            games list, Lichess import card, backup card
src/features/review/           review screen, coach text per move (reviewMessage.ts), eval graph, summary
src/config/phases.ts           opening/middlegame/endgame rules (edit to tune)
src/review/gamePhase.ts        game phase of a position
src/progress/stats.ts          progress statistics
src/puzzles/                   puzzle play logic, theme mapping; data in src/data/puzzles.json
scripts/build-puzzles.mjs      builds the puzzle subset
src/storage/puzzleStore.ts     puzzle attempts and rating
src/features/progress/         progress page, accuracy chart, background reviewer
src/features/puzzles/          puzzle trainer and mistake trainer
src/puzzles/mistakes.ts        mistake puzzles: creation, spaced repetition, answer checking
src/config/mistakes.ts         mistake puzzle schedule and tolerance (edit to tune)
src/storage/mistakeStore.ts    mistake puzzle storage and sync from reviewed games
src/engine/useAnalyser.ts      on-demand engine for checking alternative answers
src/openings/lines.ts          named opening lines (data in src/data/openingLines.json), search
src/openings/drill.ts          opening trainer: lines you learn, runs through a line, schedule
src/openings/fromGames.ts      lines to learn from where you left the book in your games
src/config/openingTrainer.ts   opening trainer schedule, popular openings (edit to tune)
src/training/srs.ts            spaced repetition shared by the trainers
src/storage/openingStore.ts    opening lines storage and hook
src/features/openings/         opening panel, "left the book" note, opening trainer and line picker
src/rating/                    rating estimate from bot games, adaptive bot level
src/config/rating.ts           rating estimate and adaptive bot settings (edit to tune)
src/config/maia.ts             Maia model location, randomness, think time (edit to tune)
src/engine/MaiaEngine.ts       Maia worker client; maia.worker.ts runs the model
src/engine/BotOpponent.ts      routes levels to Maia or Stockfish, with fallback
scripts/maia-strength.mjs      measures Maia's strength per rating (npm run maia:strength)
scripts/ui-tour.cjs            screenshots every page on phone and desktop into ui-shots/ (npm run ui:tour)
src/sw/sw-template.js          service worker template (built into dist/sw.js)
src/app/pwa.ts                 service worker registration, update banner, install prompt, persistent storage
src/features/settings/         About (source and licences), install and storage sections, update banner
chessappideas.md               ideas for later
src/features/play/             play screen, board + badge overlay, eval bar, coach card, coach bubble and move strip (phones), player strips, game-over card, new game form, move list
src/ui/styles.css              all styles, mobile-first, dark mode
```

## Phase status

- [x] Phase 1: play against a bot
- [x] Phase 2: analysis and move ratings
- [x] Phase 3: coaching (pattern detectors, template notes, hints) and UI redesign
- [x] Phase 4: game review, history, Lichess import, opening book
- [x] Phase 5: weaknesses, progress page, puzzles
- [x] Phase 6: Maia for human-like levels (400 to 1800), plus installable app
- [x] Opening trainer (from the ideas list)
- [x] Automatic Lichess import and background reviews (from the ideas list)
- [x] Rating estimate and adaptive bot (from the ideas list)

## Working agreement

- Build in phases. At the end of each: explain how to run and test, commit, push to `claude/stoic-archimedes-udsblu`, and stop until the user confirms.
- No em dashes in docs or UI text. Plain language.
- **Review the UI regularly**: after every two or three features (and before calling a phase done), run `npm run dev` and `npm run ui:tour`, look at every screenshot in `ui-shots/` on phone and desktop, and tidy anything inconsistent: spacing, button sizes, text that wraps or is cut off, cards that repeat information, and pages that look different from Play. New screens should reuse the existing pieces (coach bubble, cards, chips, move strip) rather than add new styles.
- Write project documents in Liam Daly's name.
