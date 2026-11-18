// Measures how well Maia-3 (5M, via maia3-js) plays at different ratings, to tune the bot levels.
// For each rating, Maia picks a move in 80 puzzle positions (600 to 2400); Stockfish measures how
// many Win% points each move loses. Lower ratings should lose more.
//
// Needs ONNX Runtime for Node, which is large (~600 MB) so it isn't a project dependency:
//   npm i --no-save onnxruntime-node
//   node scripts/maia-strength.mjs
// Phase 6 results (temperature 0): 400: 33 avg loss, 60% blunders; 800: 26, 49%; 1200: 25, 49%;
// 1800: 19, 38%; 2100: 18, 35%. Temperature 0.6 (used in the app) costs a little strength and
// adds variety.
import { Maia3 } from 'maia3-js'
import { Chess } from 'chess.js'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const puzzles = require('../src/data/puzzles.json')

// Stockfish lite, single thread
const sfInit = require('stockfish')
let pending = null
let lastScore = null
const sf = sfInit('lite-single', (line) => {
  const m = line.match(/score (cp|mate) (-?\d+)/)
  if (m && !line.includes('bound')) lastScore = { kind: m[1], v: Number(m[2]) }
  if ((line.startsWith('bestmove') || line === 'readyok' || line === 'uciok') && pending) {
    const p = pending
    pending = null
    p(line)
  }
})
const send = (c) => new Promise((r) => { pending = r; sf.processCommand(c) })
await send('uci')
await send('isready')

// Lichess Win% for the side to move
function win(s) {
  if (s.kind === 'mate' && s.v === 0) return 0
  const cp = s.kind === 'cp' ? Math.max(-1000, Math.min(1000, s.v)) : (21 - Math.min(10, Math.abs(s.v))) * 100 * (s.v > 0 ? 1 : -1)
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}
const cache = new Map()
async function evalFen(fen) {
  if (cache.has(fen)) return cache.get(fen)
  const g = new Chess(fen)
  let w
  if (g.isCheckmate()) w = 0
  else if (g.isGameOver()) w = 50
  else {
    lastScore = null
    sf.processCommand('position fen ' + fen)
    await send('go depth 12')
    w = win(lastScore)
  }
  cache.set(fen, w)
  return w
}

// 8 puzzle positions per 200-point band from 600 to 2400, after the set-up move
const sample = []
for (let band = 600; band <= 2400; band += 200) {
  const inBand = puzzles.filter((p) => p[3] >= band && p[3] < band + 200)
  for (let i = 0; i < 8 && i < inBand.length; i++) sample.push(inBand[Math.floor((i * inBand.length) / 8)])
}
const positions = sample.map(([, fen, moves, rating]) => {
  const [first, solution] = moves.split(' ')
  const g = new Chess(fen)
  g.move({ from: first.slice(0, 2), to: first.slice(2, 4), promotion: first[4] })
  return { fen: g.fen(), solution, rating }
})
console.log('positions:', positions.length)

const maia = new Maia3({ variant: '5m' })
const t0 = Date.now()
await maia.load()
console.log('model load ms', Date.now() - t0)

const before = []
for (const p of positions) before.push(await evalFen(p.fen))

async function run(elo, temperature) {
  let loss = 0
  let blunders = 0
  let solved = 0
  let ms = 0
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]
    const t = Date.now()
    const r = await maia.predict({ fen: p.fen, selfElo: elo, temperature })
    ms += Date.now() - t
    const g = new Chess(p.fen)
    g.move({ from: r.bestMove.slice(0, 2), to: r.bestMove.slice(2, 4), promotion: r.bestMove[4] })
    const after = 100 - (await evalFen(g.fen()))
    const l = Math.max(0, before[i] - after)
    loss += l
    if (l >= 15) blunders++
    if (r.bestMove === p.solution || g.isCheckmate()) solved++
  }
  const n = positions.length
  return {
    elo,
    temperature,
    avgLoss: (loss / n).toFixed(1),
    blunderPct: Math.round((100 * blunders) / n),
    puzzleSolvedPct: Math.round((100 * solved) / n),
    msPerMove: Math.round(ms / n),
  }
}

const rows = []
for (const elo of [400, 600, 800, 1000, 1200, 1500, 1800, 2100]) rows.push(await run(elo, 0))
for (const elo of [600, 1200, 1800]) rows.push(await run(elo, 0.6))
console.table(rows)
sf.terminate()
