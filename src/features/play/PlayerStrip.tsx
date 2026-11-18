import type { Color, PieceSymbol } from 'chess.js'
import type { MaterialSide } from '../../chess/material'
import { CpuIcon, UserIcon } from '../../ui/icons'

const GLYPH: Record<Exclude<PieceSymbol, 'k'>, string> = { q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }

interface Props {
  kind: 'bot' | 'you'
  name: string
  detail: string
  color: Color
  material: MaterialSide
  thinking?: boolean
  toMove?: boolean
}

/** Name plate above or below the board: avatar, name, rating, captured pieces and material lead. */
export function PlayerStrip({ kind, name, detail, color, material, thinking, toMove }: Props) {
  return (
    <div className={`player-strip ${toMove ? 'to-move' : ''}`} data-testid={`player-${kind}`}>
      <span className={`avatar avatar-${kind}`} aria-hidden>
        {kind === 'bot' ? <CpuIcon /> : <UserIcon />}
        <span className={`avatar-side side-${color}`} />
      </span>
      <span className="player-text">
        <span className="player-name">
          {name}
          {thinking && (
            <span className="thinking-dots" aria-label="thinking">
              <i />
              <i />
              <i />
            </span>
          )}
        </span>
        <span className="player-detail">{detail}</span>
      </span>
      <span className={`captured captured-${color === 'w' ? 'b' : 'w'}`} aria-label="Captured pieces">
        {material.captured.map((t, i) => (
          <span key={i} className={`cap cap-${t}`}>
            {GLYPH[t]}
          </span>
        ))}
        {material.advantage > 0 && <span className="advantage">+{material.advantage}</span>}
      </span>
    </div>
  )
}
