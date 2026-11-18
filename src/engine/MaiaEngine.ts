import { MAIA } from '../config/maia'

export type MaiaStatus =
  | { state: 'idle' }
  | { state: 'loading'; progress: number }
  | { state: 'ready' }
  | { state: 'failed'; message: string }

type Listener = (s: MaiaStatus) => void

/**
 * Main-thread side of the Maia-3 worker. Loads the model once (a one-off ~25 MB download,
 * then cached by the browser) and asks it for moves.
 */
export class MaiaEngine {
  private worker: Worker | null = null
  private loading: Promise<void> | null = null
  private status: MaiaStatus = { state: 'idle' }
  private listeners = new Set<Listener>()
  private pending = new Map<number, { resolve: (uci: string) => void; reject: (e: Error) => void }>()
  private nextId = 1

  getStatus(): MaiaStatus {
    return this.status
  }

  onStatus(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Start loading (if not already). Resolves when ready; rejects if the model can't load. */
  load(): Promise<void> {
    if (this.loading) return this.loading
    this.setStatus({ state: 'loading', progress: 0 })
    this.loading = new Promise<void>((resolve, reject) => {
      let worker: Worker
      try {
        worker = new Worker(new URL('./maia.worker.ts', import.meta.url), { type: 'module' })
      } catch (e) {
        this.fail(String(e))
        reject(e)
        return
      }
      this.worker = worker
      worker.onerror = (e) => {
        this.fail(e.message || 'Maia worker error')
        reject(new Error(e.message))
      }
      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data
        if (msg.type === 'progress') {
          this.setStatus({ state: 'loading', progress: msg.total ? msg.loaded / msg.total : 0 })
        } else if (msg.type === 'loaded') {
          this.setStatus({ state: 'ready' })
          resolve()
        } else if (msg.type === 'error') {
          this.fail(msg.message)
          reject(new Error(msg.message))
        } else if (msg.type === 'move' || msg.type === 'failed') {
          const p = this.pending.get(msg.id)
          this.pending.delete(msg.id)
          if (msg.type === 'move') p?.resolve(msg.uci)
          else p?.reject(new Error(msg.message))
        }
      }
      worker.postMessage({ type: 'load', modelUrl: MAIA.modelUrl, wasmUrl: MAIA.wasmUrl })
    })
    return this.loading
  }

  /**
   * A human-like move for the side to move, as played by someone rated `elo`.
   * `priorFens`: earlier positions of the game, oldest first (Maia uses up to the last 8).
   */
  async move(fen: string, elo: number, priorFens: string[] = []): Promise<string> {
    await this.load()
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker!.postMessage({
        type: 'predict',
        id,
        fen,
        elo,
        temperature: MAIA.temperature,
        topP: MAIA.topP,
        priorFens: priorFens.slice(-8),
      })
    })
  }

  dispose(): void {
    this.worker?.terminate()
    this.worker = null
    this.listeners.clear()
    for (const p of this.pending.values()) p.reject(new Error('disposed'))
    this.pending.clear()
  }

  private fail(message: string) {
    this.loading = null
    this.setStatus({ state: 'failed', message })
  }

  private setStatus(s: MaiaStatus) {
    this.status = s
    this.listeners.forEach((l) => l(s))
  }
}
