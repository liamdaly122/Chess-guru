// A small wrapper around a UCI engine running in a Web Worker.
// It queues commands so that searches never overlap, and turns the engine's
// text output into promises.

export const ENGINE_URL = '/engine/stockfish.js'

type Listener = (line: string) => void

export interface SearchResult {
  /** Best move in UCI notation, e.g. "e2e4" or "e7e8q". "(none)" if there are no legal moves. */
  bestMove: string
  /** Every "info" line the engine printed during the search. */
  info: string[]
}

export class UciEngine {
  private worker: Worker
  private listeners = new Set<Listener>()
  /** Chain of pending jobs. Each job runs only after the previous one finishes. */
  private queue: Promise<unknown> = Promise.resolve()
  private ready: Promise<void>
  private disposed = false

  constructor(url: string = ENGINE_URL) {
    this.worker = new Worker(url)
    this.worker.onmessage = (e: MessageEvent) => {
      const text = typeof e.data === 'string' ? e.data : String(e.data)
      for (const line of text.split('\n')) {
        if (line) this.listeners.forEach((l) => l(line))
      }
    }
    this.ready = this.enqueue(async () => {
      this.send('uci')
      await this.waitFor((l) => l === 'uciok')
      await this.isReady()
    })
  }

  /** Resolves once the engine has started and answered "uciok". */
  whenReady(): Promise<void> {
    return this.ready
  }

  /** Send a raw UCI command. */
  send(cmd: string): void {
    if (!this.disposed) this.worker.postMessage(cmd)
  }

  /** Run a job after all earlier jobs have finished. */
  enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job)
    // Keep the chain going even if this job fails.
    this.queue = run.catch(() => undefined)
    return run
  }

  setOption(name: string, value: string | number | boolean): Promise<void> {
    return this.enqueue(async () => {
      this.send(`setoption name ${name} value ${value}`)
      await this.isReady()
    })
  }

  newGame(): Promise<void> {
    return this.enqueue(async () => {
      this.send('ucinewgame')
      await this.isReady()
    })
  }

  /**
   * Search a position. `go` is the rest of the go command, e.g. "movetime 500" or "depth 12".
   * `onInfo` receives each info line as it arrives.
   */
  search(fen: string, go: string, onInfo?: (line: string) => void): Promise<SearchResult> {
    return this.enqueue(async () => {
      const info: string[] = []
      const off = this.listen((line) => {
        if (line.startsWith('info')) {
          info.push(line)
          onInfo?.(line)
        }
      })
      try {
        this.send(`position fen ${fen}`)
        this.send(`go ${go}`)
        const line = await this.waitFor((l) => l.startsWith('bestmove'))
        return { bestMove: line.split(/\s+/)[1], info }
      } finally {
        off()
      }
    })
  }

  /** Ask the engine to stop the current search early. Its bestmove still arrives. */
  stop(): void {
    this.send('stop')
  }

  dispose(): void {
    this.disposed = true
    this.worker.terminate()
    this.listeners.clear()
  }

  private async isReady(): Promise<void> {
    this.send('isready')
    await this.waitFor((l) => l === 'readyok')
  }

  private listen(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private waitFor(match: (line: string) => boolean): Promise<string> {
    return new Promise((resolve) => {
      const off = this.listen((line) => {
        if (match(line)) {
          off()
          resolve(line)
        }
      })
    })
  }
}
