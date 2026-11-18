/// <reference lib="webworker" />
// Runs the Maia-3 model in a Web Worker so the board stays smooth while it thinks.
// Messages in:  { type: 'load', modelUrl, wasmUrl }
//               { type: 'predict', id, fen, elo, temperature, topP, priorFens }
// Messages out: { type: 'progress', loaded, total } | { type: 'loaded' } | { type: 'error', message }
//               { type: 'move', id, uci } | { type: 'failed', id, message }

import { Maia3 } from 'maia3-js/web'

declare const self: DedicatedWorkerGlobalScope

let maia: Maia3 | null = null

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data
  if (msg.type === 'load') {
    try {
      maia = new Maia3({
        variant: '5m',
        url: msg.modelUrl,
        // ONNX Runtime accepts { wasm } here (typed as string in maia3-js): use the bundled
        // loader and fetch only the .wasm file from our own site.
        wasmPaths: { wasm: msg.wasmUrl } as unknown as string,
        // Single-threaded: no cross-origin isolation headers needed (same choice as Stockfish).
        numThreads: 1,
        onProgress: (loaded: number, total: number) => self.postMessage({ type: 'progress', loaded, total }),
      })
      await maia.load()
      self.postMessage({ type: 'loaded' })
    } catch (err) {
      maia = null
      self.postMessage({ type: 'error', message: String(err) })
    }
    return
  }

  if (msg.type === 'predict') {
    if (!maia) {
      self.postMessage({ type: 'failed', id: msg.id, message: 'Maia is not loaded' })
      return
    }
    try {
      const r = await maia.predict({
        fen: msg.fen,
        selfElo: msg.elo,
        oppoElo: msg.elo,
        temperature: msg.temperature,
        topP: msg.topP,
        topK: 0,
        ...(msg.priorFens?.length ? { priorFens: msg.priorFens } : {}),
      })
      self.postMessage({ type: 'move', id: msg.id, uci: r.bestMove })
    } catch (err) {
      self.postMessage({ type: 'failed', id: msg.id, message: String(err) })
    }
  }
}
