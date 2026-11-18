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

## Decisions

- **No Claude API, no server.** The user decided not to pay for API credits. Coaching notes will be generated in code from structured engine facts (templates). Keep coaching text generation in one module (`src/coach/`, from Phase 3) so an AI layer could be added later if wanted. With no server, there is no `.env`; `.env` is still gitignored in case one is added.
- **Stockfish 19, lite single-threaded WASM build** (npm `stockfish@19.0.1`, pinned). No cross-origin isolation headers needed, about 1.8 MB, works in iOS web views. Trade-off: a little weaker and slower per move than the full multi-threaded build, but far stronger than any human. Each engine instance runs in its own Web Worker, so the bot and the analyser (Phase 2) still use separate CPU cores.
- `scripts/copy-engine.mjs` copies the engine into `public/engine/stockfish.js` and `.wasm` (version-free names; the engine finds its `.wasm` by swapping the extension). Runs on `postinstall`, `predev` and `prebuild`. `public/engine/` is gitignored.
- **UCI_Elo range is 1320 to 3190** (checked by asking the engine). In Stockfish's source, UCI_Elo is converted to Skill Level and 1320 equals Skill Level 0, so Skill Level alone cannot play below about 1320. Levels below 1320 use Skill Level 0, a shallow depth and a chance of a random legal move (`randomMoveChance`). Those mistakes are random, not human. Phase 6 (Maia) should replace them.
- Levels are approximate. Stockfish's Elo is calibrated against engines, not Lichess or Chess.com players. Elo levels use a fixed `movetime` per move so they stay consistent.
- The opponent sits behind `OpponentEngine` (`src/engine/OpponentEngine.ts`). Maia will implement the same interface.
- Game state is a list of UCI moves (plus an optional start FEN). The chess.js game is rebuilt from it with `useMemo`, so undo, threefold repetition and the move list all come from one source.
- Undo takes back your move and the bot's reply (or just your move if the bot hasn't replied). Each undo increments a `takebacks` counter, kept for later phases (games with takebacks should be marked, and undone moves should not count in stats).
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
src/chess/moves.ts             UCI parsing, undo logic
src/features/play/             play screen, board, promotion picker, move list, new game panel
src/ui/styles.css              all styles, mobile-first, dark mode
```

## Phase status

- [x] Phase 1: play against a bot
- [ ] Phase 2: analysis and move ratings
- [ ] Phase 3: coaching (pattern detectors, template notes, hints)
- [ ] Phase 4: game review, history, Lichess import
- [ ] Phase 5: weaknesses, progress page, puzzles
- [ ] Phase 6: Maia for human-like low levels

## Working agreement

- Build in phases. At the end of each: explain how to run and test, commit, push to `claude/stoic-archimedes-udsblu`, and stop until the user confirms.
- No em dashes in docs or UI text. Plain language.
- Write project documents in Liam Daly's name.
