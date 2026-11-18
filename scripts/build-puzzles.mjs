// Builds src/data/puzzles.json, a small subset of the Lichess puzzle database
// (https://database.lichess.org/#puzzles, public domain / CC0).
//
// Usage:
//   node scripts/build-puzzles.mjs                 streams the ~300 MB .csv.zst from Lichess
//   node scripts/build-puzzles.mjs <file.csv.zst>  reads a file you downloaded yourself
//
// Nothing large is written to disk: the file is decompressed as it streams and only the
// chosen puzzles are kept. Needs Node 22.15+ (built-in zstd).
//
// Selection: well-tested, popular puzzles; up to PER_BUCKET for every (theme, 200-point
// rating band) pair, for the themes the coach can recommend.
//
// Output: [[id, fen, moves, rating, themes], ...]
//   fen   position before the opponent's move
//   moves UCI, space separated: the opponent's move first, then the solution

import { createReadStream, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst'

const THEMES = [
  'hangingPiece', 'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'defensiveMove',
  'mateIn1', 'mateIn2', 'mateIn3', 'backRankMate', 'trappedPiece', 'capturingDefender',
  'deflection', 'attraction', 'quietMove', 'intermezzo', 'xRayAttack', 'sacrifice',
  'exposedKing', 'kingsideAttack', 'promotion', 'advancedPawn', 'opening', 'middlegame', 'endgame',
]
const PER_BUCKET = 20
const MIN_RATING = 400
const MAX_RATING = 2800
const BAND = 200
const MIN_POPULARITY = 85
const MIN_PLAYS = 1000
const MAX_DEVIATION = 80

const wanted = new Set(THEMES)
const buckets = new Map() // "theme:band" -> count
const chosen = []
let read = 0

async function input() {
  const file = process.argv[2]
  if (file) return createReadStream(file)
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  return Readable.fromWeb(res.body)
}

/**
 * Lichess compresses the file with pzstd: many independent zstd frames, each preceded by a
 * 12-byte "skippable frame" whose payload is the size of the frame that follows. Node's
 * streaming decompressor stops after the first frame, so split the frames ourselves and
 * decompress them one at a time. Other skippable frames (e.g. a seek table) are skipped.
 */
async function* decompressedChunks(source) {
  let buf = Buffer.alloc(0)
  for await (const chunk of source) {
    buf = buf.length ? Buffer.concat([buf, chunk]) : Buffer.from(chunk)
    for (;;) {
      if (buf.length < 8) break
      const magic = buf.readUInt32LE(0)
      if (magic < 0x184d2a50 || magic > 0x184d2a5f) {
        throw new Error('Unexpected data: expected a pzstd skippable frame header')
      }
      const size = buf.readUInt32LE(4)
      if (size !== 4) {
        // Some other skippable frame: skip it whole.
        if (buf.length < 8 + size) break
        buf = buf.subarray(8 + size)
        continue
      }
      if (buf.length < 12) break
      const frameSize = buf.readUInt32LE(8)
      if (buf.length < 12 + frameSize) break
      yield zstdDecompressSync(buf.subarray(12, 12 + frameSize))
      buf = buf.subarray(12 + frameSize)
    }
  }
  if (buf.length) throw new Error(`Truncated download (${buf.length} bytes left over)`)
}

/** Split decompressed chunks into lines, carrying partial lines across chunks. */
async function* linesOf(chunks) {
  let rest = ''
  for await (const chunk of chunks) {
    const text = rest + chunk.toString('utf8')
    const parts = text.split('\n')
    rest = parts.pop()
    yield* parts
  }
  if (rest) yield rest
}

const lines = linesOf(decompressedChunks(await input()))
for await (const line of lines) {
  read++
  if (read === 1) continue // header
  if (read % 500000 === 0) console.log(`  ${read.toLocaleString()} puzzles read, ${chosen.length} kept`)
  // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
  const fields = line.split(',')
  if (fields.length < 8) continue // blank or broken line
  const [id, fen, moves, rating, dev, pop, plays, themes] = fields
  const r = Number(rating)
  if (r < MIN_RATING || r >= MAX_RATING) continue
  if (Number(pop) < MIN_POPULARITY || Number(plays) < MIN_PLAYS || Number(dev) > MAX_DEVIATION) continue
  const band = Math.floor(r / BAND) * BAND
  const tags = themes.split(' ')
  let take = false
  for (const t of tags) {
    if (!wanted.has(t)) continue
    const k = `${t}:${band}`
    const n = buckets.get(k) ?? 0
    if (n < PER_BUCKET) take = true
  }
  if (!take) continue
  for (const t of tags) {
    if (!wanted.has(t)) continue
    const k = `${t}:${band}`
    buckets.set(k, (buckets.get(k) ?? 0) + 1)
  }
  chosen.push([id, fen, moves, r, tags.filter((t) => wanted.has(t)).join(' ')])
}

const out = join(root, 'src', 'data', 'puzzles.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(chosen))
console.log(`build-puzzles: read ${read.toLocaleString()} puzzles, kept ${chosen.length} -> src/data/puzzles.json`)
