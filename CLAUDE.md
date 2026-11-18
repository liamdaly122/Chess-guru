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
```

Testing tip: open `http://localhost:5173/?fen=<FEN>` to start a game from any position. You play the side to move. Useful for promotion, mates and draws, e.g.
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
- **UCI_Elo range is 1320 to 3190** (checked by asking the engine). In Stockfish's source, UCI_Elo is converted to Skill Level and 1320 equals Skill Level 0, so Skill Level alone cannot play below about 1320. Levels below 1320 use Skill Level 0, a shallow depth and a chance of a random legal move (`randomMoveChance`). Those mistakes are random, not human. Phase 6 (Maia) should replace them.
- Levels are approximate. Stockfish's Elo is calibrated against engines, not Lichess or Chess.com players. Elo levels use a fixed `movetime` per move so they stay consistent.
- The opponent sits behind `OpponentEngine` (`src/engine/OpponentEngine.ts`). Maia will implement the same interface.
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
src/features/play/             play screen, board + badge overlay, eval bar, coach card, player strips, game-over card, new game form, move list
src/ui/styles.css              all styles, mobile-first, dark mode
```

## Phase status

- [x] Phase 1: play against a bot
- [x] Phase 2: analysis and move ratings
- [x] Phase 3: coaching (pattern detectors, template notes, hints) and UI redesign
- [ ] Phase 4: game review, history, Lichess import
- [ ] Phase 5: weaknesses, progress page, puzzles
- [ ] Phase 6: Maia for human-like low levels

## Working agreement

- Build in phases. At the end of each: explain how to run and test, commit, push to `claude/stoic-archimedes-udsblu`, and stop until the user confirms.
- No em dashes in docs or UI text. Plain language.
- Write project documents in Liam Daly's name.
