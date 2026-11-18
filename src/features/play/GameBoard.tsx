import type { Chess, Color, Move, Square } from 'chess.js'
import { useMemo, useState, type CSSProperties } from 'react'
import { Chessboard, type PieceDropHandlerArgs, type SquareHandlerArgs } from 'react-chessboard'
import type { MoveInput } from '../../chess/moves'
import { PromotionPicker } from './PromotionPicker'

interface Props {
  game: Chess
  orientation: 'white' | 'black'
  userColor: Color
  canMove: boolean
  lastMove?: Move
  onMove: (move: MoveInput) => boolean
}

const LAST_MOVE: CSSProperties = { backgroundColor: 'rgba(255, 213, 79, 0.45)' }
const SELECTED: CSSProperties = { backgroundColor: 'rgba(100, 181, 246, 0.55)' }
const CHECK: CSSProperties = { background: 'radial-gradient(circle, rgba(229,57,53,0.9) 0%, rgba(229,57,53,0.4) 45%, transparent 75%)' }
const DOT: CSSProperties = { background: 'radial-gradient(circle, rgba(0,0,0,0.28) 22%, transparent 24%)' }
const RING: CSSProperties = { background: 'radial-gradient(circle, transparent 58%, rgba(0,0,0,0.28) 60%)' }

/**
 * The chessboard. Supports dragging and tap-to-move (tap a piece, then a square),
 * which matters on phones. Shows legal destinations, the last move and check.
 */
export function GameBoard({ game, orientation, userColor, canMove, lastMove, onMove }: Props) {
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

  function ownPieceOn(square: Square): boolean {
    const p = game.get(square)
    return !!p && p.color === userColor
  }

  function handleSquareClick({ square }: SquareHandlerArgs) {
    if (!canMove) return
    const sq = square as Square
    if (selected && legalFromSelected.some((m) => m.to === sq)) {
      tryMove(selected, sq)
      return
    }
    if (ownPieceOn(sq)) setSelected(sq === selected ? null : sq)
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

  return (
    <div className="board-wrap">
      <Chessboard
        options={{
          id: 'play-board',
          position: fen,
          boardOrientation: orientation,
          squareStyles,
          allowDragging: canMove,
          canDragPiece: ({ piece }) => canMove && piece.pieceType[0] === userColor,
          onPieceDrop: handleDrop,
          onSquareClick: handleSquareClick,
          onPieceDrag: ({ square }) => square && canMove && setSelected(square as Square),
          animationDurationInMs: 200,
          darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
          lightSquareStyle: { backgroundColor: 'var(--board-light)' },
        }}
      />
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
