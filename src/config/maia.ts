// Settings for the human-like Maia-3 bot. Edit to tune.

export const MAIA = {
  /** The 5M Maia-3 model, copied into public/maia by scripts/copy-engine.mjs (about 22 MB). */
  modelUrl: '/maia/maia3-5m.onnx',
  /**
   * ONNX Runtime's WebAssembly file, copied into public/ort. Only the .wasm is given: the
   * JavaScript loader is already inside the bundled build, and pointing at a loader in public/
   * would break the Vite dev server (it refuses to import code from public/).
   */
  wasmUrl: '/ort/ort-wasm-simd-threaded.wasm',
  /**
   * How random the bot's move choice is. 0 always plays Maia's most likely move (the same game
   * every time); 1 samples exactly as often as humans played each move. 0.6 gives variety
   * (several different replies to 1.e4) for a small strength cost. Tested in Phase 6.
   */
  temperature: 0.6,
  /** Ignore the least likely moves that together make up the last 5% (avoids absurd moves). */
  topP: 0.95,
  /** Maia answers in well under a second, so wait a human-like time before moving (ms). */
  thinkTimeMs: { min: 600, max: 1600 },
}
