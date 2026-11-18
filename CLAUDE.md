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
- **Review** (`features/review/`): if `game.review.complete`, it is shown straight from storage with no engine. Otherwise the analyser runs (`useGameAnalysis(..., { enabled })`) and the finished review is saved. Board read-only with the badge and a green arrow for the best move (not for best/great/brilliant/book moves), eval bar, eval graph (tap to jump), arrow keys, move list jumps, summary with accuracy, rating counts and lessons, PGN download/copy, delete.
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
- **Navigation**: four sections (Play, Games, Progress, Puzzles). On screens up to 700px wide the tabs become a fixed bottom tab bar.
- Board square styles use `backgroundImage` for dots/check gradients and `backgroundColor` for highlights; mixing the `background` shorthand with `backgroundColor` makes React warn.
- **Maia (Phase 6)**: Maia-3 (CSSLab, University of Toronto, 2026; code and weights AGPL-3.0), 5M model, run in the browser with `maia3-js` (MIT, third-party, by Cem Unuvar) and `onnxruntime-web` (CPU/WebAssembly build only, single-threaded, so no COOP/COEP). Chosen over Maia-2 (MIT, older) by the user, accepting the AGPL condition: the app links to its source code (Settings > About). Levels 400 to 1800 are Maia at that rating; 2000+ are limited Stockfish (`config/levels.ts`). Each Maia level keeps a Stockfish fallback, used if the model can't load or returns an illegal move (`engine/BotOpponent.ts`).
  - Research results (80 puzzle positions, Stockfish depth 12, `scripts/maia-strength.mjs`): loss per move falls with rating (400: 33 Win% avg, 60% blunders; 800: 26/49%; 1200: 25/49%; 1800: 19/38%; 2100: 18/35%). Ratings 1000 to 1500 look similar on tactical positions. Maia's rating input is continuous (clamped 0 to 5000), not buckets.
  - Sampling: temperature 0 plays the same game every time; `MAIA.temperature` 0.6 with `topP` 0.95 gives variety (several replies to 1.e4) for a small strength cost. Human-like think time 0.6 to 1.6 s (`config/maia.ts`).
  - Maia gets the game's previous positions (`priorFens`, up to 8) for better predictions.
  - Runs in a module Web Worker (`engine/maia.worker.ts`, `worker.format: 'es'` in Vite). The model (22.5 MB) is self-hosted at `/maia/maia3-5m.onnx`; ONNX Runtime's wasm (14.8 MB) at `/ort/`. Both are copied by `scripts/copy-engine.mjs` (gitignored). `onnxruntime-web` is aliased to `onnxruntime-web/wasm` (avoids the 24 MB WebGPU build). Only `{ wasm: url }` is passed as `wasmPaths`: pointing at the `.mjs` loader in public/ breaks the Vite dev server, and the bundled build already contains the loader. Vite also emits an unused copy of the wasm into `dist/assets/`; the service worker never downloads it.
  - Loaded lazily when a Maia level starts; maia3-js keeps the model in Cache Storage. The play screen shows download progress, or a note if it fell back to Stockfish.
- **Installable app (PWA)**: `public/manifest.webmanifest`, icons in `public/icons/` (rendered from the brand mark), Apple meta tags in `index.html`. Service worker template `src/sw/sw-template.js`, turned into `dist/sw.js` at build time by the `serviceWorker()` plugin in `vite.config.ts` with the list of files to cache up front (everything except Maia, ONNX Runtime and the unused wasm copy) and a version hash. Page loads are network-first with the cached app as offline fallback; other files cache-first. Cache lookups use `ignoreVary` (the server sends `Vary: Origin`, which made module requests miss). A new version waits and shows the "new version ready" banner; the page reloads only when the user taps Reload (never on first install, which would lose a game). Registered in production builds only. `navigator.storage.persist()` is requested at start-up; Settings shows the storage status and install instructions (Install button on Chrome/Android, Share > Add to Home Screen on iOS). `vercel.json` sends `no-cache` for `/sw.js` and long caching for hashed `/assets/`.
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
src/openings/                  opening book lookup + hook; data in src/data/openings.json
scripts/build-openings.mjs     rebuilds the opening table from Lichess's list
src/features/games/            games list, Lichess import card, backup card
src/features/review/           review screen, eval graph, move card, summary
src/features/openings/         opening panel, "left the book" note
src/config/phases.ts           opening/middlegame/endgame rules (edit to tune)
src/review/gamePhase.ts        game phase of a position
src/progress/stats.ts          progress statistics
src/puzzles/                   puzzle play logic, theme mapping; data in src/data/puzzles.json
scripts/build-puzzles.mjs      builds the puzzle subset
src/storage/puzzleStore.ts     puzzle attempts and rating
src/features/progress/         progress page, accuracy chart, background reviewer
src/features/puzzles/          puzzle trainer
src/config/maia.ts             Maia model location, randomness, think time (edit to tune)
src/engine/MaiaEngine.ts       Maia worker client; maia.worker.ts runs the model
src/engine/BotOpponent.ts      routes levels to Maia or Stockfish, with fallback
scripts/maia-strength.mjs      measures Maia's strength per rating (npm run maia:strength)
src/sw/sw-template.js          service worker template (built into dist/sw.js)
src/app/pwa.ts                 service worker registration, update banner, install prompt, persistent storage
src/features/settings/         About (source and licences), install and storage sections, update banner
chessappideas.md               ideas for later
src/features/play/             play screen, board + badge overlay, eval bar, coach card, player strips, game-over card, new game form, move list
src/ui/styles.css              all styles, mobile-first, dark mode
```

## Phase status

- [x] Phase 1: play against a bot
- [x] Phase 2: analysis and move ratings
- [x] Phase 3: coaching (pattern detectors, template notes, hints) and UI redesign
- [x] Phase 4: game review, history, Lichess import, opening book
- [x] Phase 5: weaknesses, progress page, puzzles
- [x] Phase 6: Maia for human-like levels (400 to 1800), plus installable app

## Working agreement

- Build in phases. At the end of each: explain how to run and test, commit, push to `claude/stoic-archimedes-udsblu`, and stop until the user confirms.
- No em dashes in docs or UI text. Plain language.
- Write project documents in Liam Daly's name.
