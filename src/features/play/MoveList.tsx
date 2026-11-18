import type { Move } from 'chess.js'
import { useEffect, useRef } from 'react'

/** Moves in pairs: "1. e4 e5". Scrolls to the latest move. */
export function MoveList({ history }: { history: Move[] }) {
  const endRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [history.length])

  if (history.length === 0) {
    return <p className="move-list-empty">No moves yet.</p>
  }

  const rows: { n: number; white?: string; black?: string }[] = []
  for (let i = 0; i < history.length; i += 2) {
    rows.push({ n: i / 2 + 1, white: history[i]?.san, black: history[i + 1]?.san })
  }

  return (
    <ol className="move-list" aria-label="Moves">
      {rows.map((r, i) => (
        <li key={r.n} ref={i === rows.length - 1 ? endRef : undefined}>
          <span className="move-no">{r.n}.</span>
          <span className="move">{r.white}</span>
          <span className="move">{r.black ?? ''}</span>
        </li>
      ))}
    </ol>
  )
}
