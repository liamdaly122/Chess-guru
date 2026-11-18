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

### Install it on your phone

Chess Guru can be installed like an app and then works offline.

- **iPhone or iPad:** open the site in Safari, tap the Share button, then **Add to Home Screen**.
- **Android or desktop Chrome/Edge:** use the browser's **Install app** option, or the Install button in Settings.

The first game against a Maia level downloads the human-like bot once (about 25 MB compressed).

## Licences

- **Stockfish** is free software licensed under the **GNU General Public License v3 (GPL-3.0)**. This app uses the WebAssembly build from the [stockfish.js](https://github.com/nmrugg/stockfish.js) project by Nathan Rugg. The licence text is copied next to the engine files (`public/engine/COPYING.txt`) when you run `npm install`. If you distribute this app, the GPL applies to the engine and you must make its source available.
- [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause) handles the rules of chess.
- [react-chessboard](https://github.com/Clariity/react-chessboard) (MIT) draws the board.
- **Maia-3** by the University of Toronto CSSLab is licensed under the **GNU Affero General Public License v3 (AGPL-3.0)**. The app uses its 5M model to play human-like bots, through [maia3-js](https://www.npmjs.com/package/maia3-js) (MIT) and [ONNX Runtime Web](https://onnxruntime.ai/) (MIT). Because the app is served over the web, its source code is available at https://github.com/liamdaly122/Chess-guru and linked from Settings.
- Opening names come from the [Lichess chess-openings](https://github.com/lichess-org/chess-openings) list, which is public domain (CC0).
- Puzzles are a small selection from the [Lichess puzzle database](https://database.lichess.org/#puzzles), which is public domain (CC0).
- Game import uses the public [Lichess API](https://lichess.org/api). Only finished games are imported, for review afterwards; the app never helps during a live game.
