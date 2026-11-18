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

## Licences

- **Stockfish** is free software licensed under the **GNU General Public License v3 (GPL-3.0)**. This app uses the WebAssembly build from the [stockfish.js](https://github.com/nmrugg/stockfish.js) project by Nathan Rugg. The licence text is copied next to the engine files (`public/engine/COPYING.txt`) when you run `npm install`. If you distribute this app, the GPL applies to the engine and you must make its source available.
- [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause) handles the rules of chess.
- [react-chessboard](https://github.com/Clariity/react-chessboard) (MIT) draws the board.
