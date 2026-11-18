// Copies the Stockfish WebAssembly build from node_modules into public/engine
// so Vite serves it as a static file the Web Worker can load.
// Runs automatically after `npm install` and before `npm run dev` / `npm run build`.
//
// We use the "lite single-threaded" build: no cross-origin isolation headers
// needed, small download, works in iOS web views. See CLAUDE.md for the trade-off.

import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const binDir = join(root, 'node_modules', 'stockfish', 'bin')
const outDir = join(root, 'public', 'engine')

if (!existsSync(binDir)) {
  console.error('copy-engine: node_modules/stockfish not found. Run `npm install` first.')
  process.exit(1)
}

const files = readdirSync(binDir)
const js = files.find((f) => /^stockfish-\d+-lite-single\.js$/.test(f))
const wasm = files.find((f) => /^stockfish-\d+-lite-single\.wasm$/.test(f))

if (!js || !wasm) {
  console.error('copy-engine: could not find the lite single-threaded build in', binDir)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
// The engine script finds its .wasm by swapping the .js extension, so the two
// names must match. Version-free names mean the app code never changes on upgrade.
copyFileSync(join(binDir, js), join(outDir, 'stockfish.js'))
copyFileSync(join(binDir, wasm), join(outDir, 'stockfish.wasm'))
// GPL: ship the licence alongside the engine binary.
copyFileSync(join(root, 'node_modules', 'stockfish', 'Copying.txt'), join(outDir, 'COPYING.txt'))

console.log(`copy-engine: ${js} -> public/engine/stockfish.js`)
