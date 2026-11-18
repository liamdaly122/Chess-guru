// Copies the engines from node_modules into public/ so Vite serves them as static files:
// - Stockfish (WebAssembly) into public/engine
// - the Maia-3 model into public/maia and ONNX Runtime's WebAssembly files into public/ort
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

// Maia-3 (human-like bot): the 5M model from maia3-js, served by the app itself so it doesn't
// depend on Hugging Face and works offline once cached. AGPL-3.0 weights; see README.
const maiaModel = join(root, 'node_modules', 'maia3-js', 'models', 'maia3_5m.onnx')
if (existsSync(maiaModel)) {
  mkdirSync(join(root, 'public', 'maia'), { recursive: true })
  copyFileSync(maiaModel, join(root, 'public', 'maia', 'maia3-5m.onnx'))
  console.log('copy-engine: maia3_5m.onnx -> public/maia/maia3-5m.onnx')
}

// ONNX Runtime Web, CPU (WebAssembly) build only: runs the Maia model.
const ortDist = join(root, 'node_modules', 'onnxruntime-web', 'dist')
if (existsSync(ortDist)) {
  mkdirSync(join(root, 'public', 'ort'), { recursive: true })
  // Only the .wasm: the JavaScript loader is bundled into the app by Vite.
  for (const f of ['ort-wasm-simd-threaded.wasm']) {
    copyFileSync(join(ortDist, f), join(root, 'public', 'ort', f))
  }
  console.log('copy-engine: onnxruntime-web wasm -> public/ort/')
}
