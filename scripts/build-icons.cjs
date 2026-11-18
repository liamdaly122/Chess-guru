// Builds the app icons from scripts/icon/iconSvg.cjs (the knight is drawn in src/ui/knight-paths.json).
// Usage: npm run build:icons   (needs Playwright with Chromium, like the UI tour)
// Writes public/favicon.svg and the PNGs in public/icons/.
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')
const { iconSvg } = require('./icon/iconSvg.cjs')

const pub = path.join(__dirname, '..', 'public')
const out = [
  // [file, size, options]
  ['icons/icon-512.png', 512, { rounded: true }],
  ['icons/icon-192.png', 192, { rounded: true }],
  // iOS rounds the corners itself and shows transparent corners as black.
  ['icons/apple-touch-icon.png', 180, { rounded: false }],
  // Android may crop to a circle: keep the knight inside the central safe zone.
  ['icons/maskable-512.png', 512, { rounded: false, scale: 0.78 }],
]

;(async () => {
  fs.writeFileSync(path.join(pub, 'favicon.svg'), iconSvg({ rounded: true }))
  const browser = await chromium.launch()
  for (const [file, size, opts] of out) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    const svg = iconSvg(opts).replace('width="512" height="512"', `width="${size}" height="${size}"`)
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`)
    await page.screenshot({ path: path.join(pub, file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
    await page.close()
    console.log(`wrote public/${file}`)
  }
  await browser.close()
})()
