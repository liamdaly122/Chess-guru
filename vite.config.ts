import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

/**
 * Writes dist/sw.js (the service worker) after each build, from src/sw/sw-template.js, with the
 * list of files to cache for offline use and a version that changes whenever the build does.
 * The Maia model and ONNX Runtime are left out of the list: they are cached on first use.
 */
function serviceWorker(): Plugin {
  let outDir = 'dist'
  return {
    name: 'chess-guru-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const files: string[] = []
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name)
          if (statSync(full).isDirectory()) walk(full)
          else files.push('/' + relative(outDir, full).split(sep).join('/'))
        }
      }
      walk(outDir)
      const precache = files
        .filter(
          (f) =>
            !f.startsWith('/maia/') &&
            !f.startsWith('/ort/') &&
            // Vite also emits ONNX Runtime's .wasm into assets/, but the app loads the copy in
            // /ort/ (see config/maia.ts), so never download this one up front.
            !/\/ort-wasm[^/]*\.wasm$/.test(f) &&
            f !== '/sw.js' &&
            !f.endsWith('.map'),
        )
        .sort()
      const template = readFileSync('src/sw/sw-template.js', 'utf8')
      const hash = createHash('sha256').update(template)
      for (const f of precache) hash.update(f + ':' + statSync(join(outDir, f)).size)
      const version = hash.digest('hex').slice(0, 12)
      const sw = template
        .replace("'__VERSION__'", JSON.stringify(version))
        .replace('__PRECACHE__', JSON.stringify(['/', ...precache], null, 2))
      writeFileSync(join(outDir, 'sw.js'), sw)
      console.log(`service worker: ${precache.length} files precached, version ${version}`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorker()],
  resolve: {
    alias: [
      // maia3-js imports "onnxruntime-web", whose default build also carries WebGPU support and
      // a 24 MB engine file. The CPU-only build needs just public/ort/ort-wasm-simd-threaded.wasm.
      { find: /^onnxruntime-web$/, replacement: 'onnxruntime-web/wasm' },
    ],
  },
  worker: {
    // The Maia worker uses dynamic imports, which need ES module workers.
    format: 'es',
  },
})
