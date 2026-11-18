import { Chess, type Color } from 'chess.js'

/**
 * Named opening lines from the Lichess opening list (public domain), with their moves.
 * Built by scripts/build-openings.mjs into src/data/openingLines.json.
 */
export type LinesData = [eco: string, name: string, moves: string][]

export interface OpeningLine {
  /** The moves in standard notation, joined by spaces. Unique, so it doubles as the id. */
  id: string
  eco: string
  name: string
  san: string[]
}

let loading: Promise<OpeningLine[]> | null = null

/** Loads the list of named lines on first use (a separate download, about 50 KB). */
export function loadLines(): Promise<OpeningLine[]> {
  loading ??= import('../data/openingLines.json').then((m) =>
    (m.default as unknown as LinesData).map(([eco, name, moves]) => ({ id: moves, eco, name, san: moves.split(' ') })),
  )
  return loading
}

/** The family name: "Sicilian Defense" for "Sicilian Defense: Najdorf Variation". */
export function family(name: string): string {
  return name.split(':')[0].trim()
}

/** How many moves the given side plays in the line. */
export function movesFor(line: { san: string[] }, side: Color): number {
  return line.san.filter((_, i) => (i % 2 === 0 ? 'w' : 'b') === side).length
}

/** "1. e4 e5 2. Nf3 Nc6" */
export function lineText(san: string[]): string {
  return san.map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${s}` : s)).join(' ')
}

/** The line's moves in UCI notation. */
export function toUci(san: string[]): string[] {
  const chess = new Chess()
  return san.map((s) => {
    const m = chess.move(s)
    return m.from + m.to + (m.promotion ?? '')
  })
}

/**
 * Lines whose name contains every word of the query, shortest first within each name (the main
 * line before its sidelines), in list order (grouped by ECO code).
 */
export function searchLines(lines: OpeningLine[], query: string, max: number): OpeningLine[] {
  const words = query.toLowerCase().replace(/[’']/g, "'").split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const hits = lines.filter((l) => {
    const name = l.name.toLowerCase()
    return words.every((w) => name.includes(w))
  })
  // Names that start with the query first, then by length of name (general before specific).
  const q = words.join(' ')
  return hits
    .map((l, i) => ({ l, i, starts: l.name.toLowerCase().startsWith(q) ? 0 : 1 }))
    .sort((a, b) => a.starts - b.starts || a.l.name.length - b.l.name.length || a.l.san.length - b.l.san.length || a.i - b.i)
    .slice(0, max)
    .map((x) => x.l)
}

/**
 * The shortest named line that follows these moves and goes at least one move further:
 * the book continuation from that point.
 */
export function lineContinuing(lines: OpeningLine[], played: string[]): OpeningLine | null {
  let best: OpeningLine | null = null
  for (const l of lines) {
    if (l.san.length <= played.length) continue
    if (!played.every((s, i) => l.san[i] === s)) continue
    if (!best || l.san.length < best.san.length) best = l
  }
  return best
}
