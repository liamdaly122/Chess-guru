// The app icon as SVG, drawn from src/ui/knight-paths.json (the one copy of the knight, shared with the app).
const fs = require('node:fs')
const path = require('node:path')

const p = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'ui', 'knight-paths.json'), 'utf8'))

/**
 * @param {{ rounded?: boolean, scale?: number }} opts
 *   rounded: rounded-square tile (false = full square, for iOS and maskable icons, which are masked by the system)
 *   scale: size of the knight within the tile (1 = normal; smaller keeps it inside the maskable safe zone)
 */
function iconSvg({ rounded = true, scale = 1 } = {}) {
  const checks = []
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2) checks.push(`<rect x="${c * 64}" y="${r * 64}" width="64" height="64"/>`)
  const rx = rounded ? 112 : 0
  const t = `translate(${256 - 256 * scale} ${256 - 256 * scale}) scale(${scale})`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f9a63"/><stop offset="1" stop-color="#0d3b26"/></linearGradient>
<radialGradient id="glow" cx="0.38" cy="0.36" r="0.6"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="white" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e3efe7"/></linearGradient>
<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#04150d" flood-opacity="0.45"/></filter>
<clipPath id="tile"><rect width="512" height="512" rx="${rx}"/></clipPath>
</defs>
<g clip-path="url(#tile)">
<rect width="512" height="512" fill="url(#bg)"/>
<g fill="#fff" opacity="0.05">${checks.join('')}</g>
<rect width="512" height="512" fill="url(#glow)"/>
<g transform="${t}">
<g filter="url(#shadow)">
<path d="${p.body}" fill="url(#white)"/>
<path d="${p.shade}" fill="#c9dccf"/>
<path d="${p.face}" fill="#f6fbf8"/>
<path d="${p.base}" fill="url(#white)"/>
</g>
<path d="${p.eye}" fill="#14492f"/>
<path d="M404 92 L414 120 L442 130 L414 140 L404 168 L394 140 L366 130 L394 120 Z" fill="#f4c64e"/>
</g>
</g>
</svg>`
}

module.exports = { iconSvg }
