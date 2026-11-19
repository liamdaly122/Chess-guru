// Checks every endgame drill position with Stockfish: legal, and the result the drill expects
// (mate/win: winning for the side to move; hold: about level with best play).
// Usage: node scripts/check-endgames.mjs
import { Chess } from 'chess.js'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
// The drill list, straight from the TypeScript source (Node 22 strips the types).
const { ENDGAME_DRILLS } = await import('../src/practice/endgames.ts')

const sfInit = require('stockfish')
let pending = null
let last = null
const sf = sfInit('lite-single', (line) => {
  const m = line.match(/score (cp|mate) (-?\d+)/)
  if (m && !line.includes('bound')) last = { kind: m[1], v: Number(m[2]) }
  if ((line.startsWith('bestmove') || line === 'readyok' || line === 'uciok') && pending) {
    const p = pending
    pending = null
    p(line)
  }
})
const send = (c) => new Promise((r) => { pending = r; sf.processCommand(c) })
await send('uci')
await send('isready')

let bad = 0
for (const d of ENDGAME_DRILLS) {
  for (const fen of d.fens) {
    let ok = true
    let note = ''
    try {
      const g = new Chess(fen)
      if (g.isGameOver()) throw new Error('game already over')
      last = null
      sf.processCommand('position fen ' + fen)
      await send('go depth 26 movetime 4000')
      const s = last
      note = s ? `${s.kind} ${s.v}` : 'no score'
      if (d.goal === 'hold') ok = !!s && s.kind === 'cp' && Math.abs(s.v) <= 80
      else ok = !!s && ((s.kind === 'mate' && s.v > 0) || (s.kind === 'cp' && s.v >= 500))
    } catch (e) {
      ok = false
      note = String(e.message ?? e)
    }
    if (!ok) bad++
    console.log(`${ok ? 'ok  ' : 'BAD '} ${d.id.padEnd(12)} ${d.goal.padEnd(5)} ${note.padEnd(10)} ${fen}`)
  }
}
console.log(bad ? `${bad} position(s) need fixing` : 'all drill positions check out')
process.exit(bad ? 1 : 0)
