// Builds src/data/openings.json from the Lichess opening list
// (https://github.com/lichess-org/chess-openings, public domain / CC0).
//
// Usage:
//   node scripts/build-openings.mjs              downloads the five TSV files
//   node scripts/build-openings.mjs <folder>     reads a.tsv ... e.tsv from a folder instead
//
// Output:
//   src/data/openings.json      { "<position>": ["C50", "Italian Game"] | 0 }
//     The key is the position (FEN without move counters), so transpositions are recognised.
//     0 marks a position on the way to a named line that has no name of its own: still "book".
//   src/data/openingLines.json  [["C50", "Italian Game", "e4 e5 Nf3 Nc6 Bc4"], ...]
//     Every named line with its moves, in list order, for the opening trainer.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Chess } from 'chess.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master/'
const VOLUMES = ['a', 'b', 'c', 'd', 'e']

async function readVolume(v) {
  const folder = process.argv[2]
  if (folder) return readFileSync(join(folder, `${v}.tsv`), 'utf8')
  const res = await fetch(`${BASE}${v}.tsv`)
  if (!res.ok) throw new Error(`Download failed for ${v}.tsv: ${res.status}`)
  return res.text()
}

/** Position key: board, side to move, castling, en passant. */
const key = (fen) => fen.split(' ').slice(0, 4).join(' ')

const book = {}
const lineList = []
let lines = 0
for (const v of VOLUMES) {
  const rows = (await readVolume(v)).split('\n').slice(1).filter(Boolean)
  for (const row of rows) {
    const [eco, name, pgn] = row.split('\t')
    const chess = new Chess()
    const sans = pgn.replace(/\d+\.(\.\.)?/g, ' ').split(/\s+/).filter(Boolean)
    for (const san of sans) {
      chess.move(san)
      const k = key(chess.fen())
      if (!(k in book)) book[k] = 0
    }
    // A position can have several names; keep the first one listed (the most general).
    const k = key(chess.fen())
    if (!book[k]) book[k] = [eco, name]
    lineList.push([eco, name, sans.join(' ')])
    lines++
  }
}

const out = join(root, 'src', 'data', 'openings.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(book))
writeFileSync(join(root, 'src', 'data', 'openingLines.json'), JSON.stringify(lineList))
const named = Object.values(book).filter(Boolean).length
console.log(`build-openings: ${lines} lines -> ${Object.keys(book).length} positions (${named} named) -> src/data/openings.json and openingLines.json`)
