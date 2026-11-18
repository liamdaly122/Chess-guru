# Chess Guru

By Liam Daly.

A personal chess coaching app. It plays against you at different rating levels and will coach you during and after games. It runs entirely in the browser: no accounts, no cloud database, no paid APIs.

This is a personal project, built for my own use and not intended for distribution.

## Running it

You need Node.js 22 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

Run the unit tests with `npm test`.

The app is a static site and is hosted on Vercel, which builds it from this GitHub repo on every push (settings in `vercel.json`).

## Licences

- **Stockfish** is free software licensed under the **GNU General Public License v3 (GPL-3.0)**. This app uses the WebAssembly build from the [stockfish.js](https://github.com/nmrugg/stockfish.js) project by Nathan Rugg. The licence text is copied next to the engine files (`public/engine/COPYING.txt`) when you run `npm install`. If you distribute this app, the GPL applies to the engine and you must make its source available.
- [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause) handles the rules of chess.
- [react-chessboard](https://github.com/Clariity/react-chessboard) (MIT) draws the board.
- Opening names come from the [Lichess chess-openings](https://github.com/lichess-org/chess-openings) list, which is public domain (CC0).
- Puzzles are a small selection from the [Lichess puzzle database](https://database.lichess.org/#puzzles), which is public domain (CC0).
- Game import uses the public [Lichess API](https://lichess.org/api). Only finished games are imported, for review afterwards; the app never helps during a live game.
