import type { Color } from 'chess.js'

type PromotionPiece = 'q' | 'r' | 'b' | 'n'

const PIECES: { piece: PromotionPiece; name: string; white: string; black: string }[] = [
  { piece: 'q', name: 'Queen', white: '♕', black: '♛' },
  { piece: 'r', name: 'Rook', white: '♖', black: '♜' },
  { piece: 'b', name: 'Bishop', white: '♗', black: '♝' },
  { piece: 'n', name: 'Knight', white: '♘', black: '♞' },
]

interface Props {
  color: Color
  onPick: (piece: PromotionPiece) => void
  onCancel: () => void
}

/** Overlay shown on top of the board when a pawn reaches the last rank. */
export function PromotionPicker({ color, onPick, onCancel }: Props) {
  return (
    <div className="promotion-overlay" role="dialog" aria-label="Choose promotion piece" onClick={onCancel}>
      <div className="promotion-choices" onClick={(e) => e.stopPropagation()}>
        <p>Promote to</p>
        <div className="promotion-buttons">
          {PIECES.map((p) => (
            <button key={p.piece} type="button" aria-label={p.name} title={p.name} onClick={() => onPick(p.piece)}>
              {color === 'w' ? p.white : p.black}
            </button>
          ))}
        </div>
        <button type="button" className="link-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
