import { Analyser } from '../engine/Analyser'
import type { PositionAnalysis, PvLine } from '../engine/uciInfo'

export interface AnalysisSnapshot {
  /** Finished analyses, keyed by FEN. A new Map object every time something changes. */
  results: ReadonlyMap<string, PositionAnalysis>
  /** The position being analysed right now and its best line so far, for the eval bar. */
  live: { fen: string; line: PvLine } | null
  ready: boolean
}

/**
 * Analyses every position of the current game, one at a time, in game order.
 * Results are cached by FEN, so undoing and replaying moves doesn't redo work.
 * Positions that drop out of the game (after undo or a new game) are skipped,
 * and a search for one is stopped.
 */
export class AnalysisQueue {
  private analyser: Analyser
  private wanted: string[] = []
  /** Extra positions (e.g. null-move positions for threat detection), done after the game positions. */
  private extras: string[] = []
  private running = false
  private current: string | null = null
  private disposed = false
  private listeners = new Set<() => void>()
  private snapshot: AnalysisSnapshot = { results: new Map(), live: null, ready: false }

  constructor(analyser: Analyser = new Analyser()) {
    this.analyser = analyser
    analyser.whenReady().then(() => {
      this.update({ ready: true })
      void this.run()
    })
  }

  /** Set the positions that need analysing, in the order they should be done. */
  setPositions(fens: string[]): void {
    this.wanted = fens
    if (this.current && !fens.includes(this.current) && !this.extras.includes(this.current)) this.analyser.stop()
    void this.run()
  }

  /** Ask for an extra position to be analysed once the game positions are done. */
  request(fen: string): void {
    if (this.snapshot.results.has(fen) || this.extras.includes(fen)) return
    this.extras.push(fen)
    void this.run()
  }

  getSnapshot = (): AnalysisSnapshot => this.snapshot

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  dispose(): void {
    this.disposed = true
    this.listeners.clear()
    this.analyser.dispose()
  }

  private async run(): Promise<void> {
    if (this.running || !this.snapshot.ready) return
    this.running = true
    try {
      while (!this.disposed) {
        const fen =
          this.wanted.find((f) => !this.snapshot.results.has(f)) ??
          this.extras.find((f) => !this.snapshot.results.has(f))
        if (!fen) break
        this.current = fen
        const result = await this.analyser.analyse(fen, (line) => this.update({ live: { fen, line } }))
        this.current = null
        if (this.disposed) return
        if (result) {
          const results = new Map(this.snapshot.results)
          results.set(fen, result)
          this.update({ results, live: null })
        } else if (this.wanted.includes(fen) || this.extras.includes(fen)) {
          // Stopped but still needed: shouldn't happen, but avoid looping forever.
          break
        }
      }
    } finally {
      this.running = false
      this.current = null
    }
  }

  private update(patch: Partial<AnalysisSnapshot>): void {
    if (this.disposed) return
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((l) => l())
  }
}
