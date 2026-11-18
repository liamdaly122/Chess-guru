import type { Chess, Color, Move, Square } from 'chess.js'
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Chessboard, type PieceDropHandlerArgs, type SquareHandlerArgs } from 'react-chessboard'
import type { MoveRating } from '../../chess/classify'
import type { MoveInput } from '../../chess/moves'
import { PromotionPicker } from './PromotionPicker'
import { RatingBadge } from './RatingBadge'

export interface BoardBadge {
  square: Square
  rating: MoveRating | 'pending'
}

interface Props {
  game: Chess
  orientation: 'white' | 'black'
  userColor: Color
  canMove: boolean
  lastMove?: Move
  onMove: (move: MoveInput) => boolean
  /** Rating badge to show on a square (the user's last move). */
  badge?: BoardBadge | null
  /** Square to draw attention to (hint step 2). */
  glowSquare?: Square | null
  /** Arrow to draw (hint step 3, or the best move in review). */
  arrow?: { from: Square; to: Square; color?: string } | null
  /** Anything to lay over the board, e.g. the game-over card. */
  children?: ReactNode
  /** Must be unique when more than one board is on the page. */
  boardId?: string
}

const LAST_MOVE: CSSProperties = { backgroundColor: 'var(--last-move)' }
const SELECTED: CSSProperties = { backgroundColor: 'var(--selected)' }
// Gradients use backgroundImage so they can sit on top of a backgroundColor highlight.
const CHECK: CSSProperties = {
  backgroundImage: 'radial-gradient(circle, rgba(239,68,68,0.95) 0%, rgba(239,68,68,0.45) 40%, transparent 72%)',
}
const DOT: CSSProperties = { backgroundImage: 'radial-gradient(circle, var(--move-dot) 19%, transparent 21%)' }
const RING: CSSProperties = { backgroundImage: 'radial-gradient(circle, transparent 60%, var(--move-dot) 62%, var(--move-dot) 74%, transparent 76%)' }

/** Position of a square on the board as percentages, for the overlay layer. */
function squarePosition(square: Square, orientation: 'white' | 'black') {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1]) - 1
  const col = orientation === 'white' ? file : 7 - file
  const row = orientation === 'white' ? 7 - rank : rank
  return { left: col * 12.5, top: row * 12.5 }
}

/**
 * The chessboard. Supports dragging and tap-to-move (tap a piece, then a square),
 * shows legal destinations, the last move and check, and draws the rating badge,
 * hint highlights and arrows on a layer above the pieces.
 */
export function GameBoard({
  game,
  orientation,
  userColor,
  canMove,
  lastMove,
  onMove,
  badge,
  glowSquare,
  arrow,
  children,
  boardId = 'play-board',
}: Props) {
  const [selected, setSelected] = useState<Square | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const fen = game.fen()

  // Forget any selection when the position changes.
  const [prevFen, setPrevFen] = useState(fen)
  if (prevFen !== fen) {
    setPrevFen(fen)
    setSelected(null)
    setPendingPromotion(null)
  }

  const legalFromSelected = useMemo(
    () => (selected ? game.moves({ square: selected, verbose: true }) : []),
    [game, selected],
  )

  const isPromotion = (from: Square, to: Square) =>
    game.moves({ square: from, verbose: true }).some((m) => m.to === to && m.promotion)

  function tryMove(from: Square, to: Square): boolean {
    if (!canMove) return false
    if (isPromotion(from, to)) {
      setPendingPromotion({ from, to })
      setSelected(null)
      return false
    }
    const ok = onMove({ from, to })
    if (ok) setSelected(null)
    return ok
  }

  function handleSquareClick({ square }: SquareHandlerArgs) {
    if (!canMove) return
    const sq = square as Square
    if (selected && legalFromSelected.some((m) => m.to === sq)) {
      tryMove(selected, sq)
      return
    }
    const p = game.get(sq)
    if (p && p.color === userColor) setSelected(sq === selected ? null : sq)
    else setSelected(null)
  }

  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare || sourceSquare === targetSquare) return false
    return tryMove(sourceSquare as Square, targetSquare as Square)
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {}
    if (lastMove) {
      styles[lastMove.from] = LAST_MOVE
      styles[lastMove.to] = LAST_MOVE
    }
    if (game.inCheck()) {
      const king = game.findPiece({ type: 'k', color: game.turn() })[0]
      if (king) styles[king] = { ...styles[king], ...CHECK }
    }
    if (selected) {
      styles[selected] = SELECTED
      for (const m of legalFromSelected) {
        styles[m.to] = { ...styles[m.to], ...(m.captured ? RING : DOT) }
      }
    }
    return styles
  }, [game, lastMove, selected, legalFromSelected])

  const arrows = useMemo(
    () => (arrow ? [{ startSquare: arrow.from, endSquare: arrow.to, color: arrow.color ?? 'rgba(59, 130, 246, 0.85)' }] : []),
    [arrow],
  )

  return (
    <div className="board-wrap">
      <Chessboard
        options={{
          id: boardId,
          position: fen,
          boardOrientation: orientation,
          squareStyles,
          arrows,
          allowDrawingArrows: false,
          allowDragging: canMove,
          canDragPiece: ({ piece }) => canMove && piece.pieceType[0] === userColor,
          onPieceDrop: handleDrop,
          onSquareClick: handleSquareClick,
          onPieceDrag: ({ square }) => square && canMove && setSelected(square as Square),
          animationDurationInMs: 180,
          boardStyle: { borderRadius: 'var(--board-radius)', overflow: 'hidden' },
          darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
          lightSquareStyle: { backgroundColor: 'var(--board-light)' },
          darkSquareNotationStyle: { color: 'var(--board-light)', fontWeight: 600 },
          lightSquareNotationStyle: { color: 'var(--board-dark)', fontWeight: 600 },
        }}
      />

      <div className="board-overlay" aria-hidden={!badge}>
        {glowSquare && (
          <span className="hint-glow" style={pct(squarePosition(glowSquare, orientation))} data-testid="hint-glow" />
        )}
        {badge && (
          <span
            key={`${badge.square}-${badge.rating}`}
            className="board-badge"
            style={pct(squarePosition(badge.square, orientation))}
            data-testid="board-badge"
            data-rating={badge.rating}
          >
            <RatingBadge rating={badge.rating} size="lg" />
          </span>
        )}
      </div>

      {children}

      {pendingPromotion && (
        <PromotionPicker
          color={userColor}
          onPick={(piece) => {
            const { from, to } = pendingPromotion
            setPendingPromotion(null)
            onMove({ from, to, promotion: piece })
          }}
          onCancel={() => setPendingPromotion(null)}
        />
      )}
    </div>
  )
}

function pct({ left, top }: { left: number; top: number }): CSSProperties {
  return { left: `${left}%`, top: `${top}%` }
}
