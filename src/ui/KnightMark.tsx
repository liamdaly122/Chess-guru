import paths from './knight-paths.json'

/**
 * The Chess Guru knight, the same drawing as the app icon (src/ui/knight-paths.json), in white
 * with its shaded facets. Used for the logo in the header and the coach's avatar.
 */
export function KnightMark({ size = 20, withBase = true }: { size?: number; withBase?: boolean }) {
  return (
    <svg viewBox={withBase ? '100 60 320 420' : '100 60 300 380'} width={size} height={size} aria-hidden className="knight-mark">
      <path d={paths.body} fill="#fff" />
      <path d={paths.shade} fill="#cfe0d5" />
      <path d={paths.face} fill="#f6fbf8" />
      {withBase && <path d={paths.base} fill="#fff" />}
      <path d={paths.eye} fill="#14492f" />
    </svg>
  )
}
