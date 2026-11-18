import { Chess, type Move, type Square } from 'chess.js'
import { useEffect, useMemo, useState } from 'react'
import { navigate } from '../../app/route'
import { useGameAnalysis } from '../../analysis/useGameAnalysis'
import type { MoveRating } from '../../chess/classify'
import { parseUci } from '../../chess/moves'
import { buildReview } from '../../review/buildReview'
import type { GameReview } from '../../review/types'
import { deleteGame, saveGame } from '../../storage/games'
import { formatDate, opponentOf } from '../../storage/gameInfo'
import type { GameRecord } from '../../storage/types'
import { useGame } from '../../storage/useGames'
import { downloadText } from '../../storage/backup'
import { FlipIcon } from '../../ui/icons'
import { EvalBar } from '../play/EvalBar'
import { GameBoard } from '../play/GameBoard'
import { MoveList } from '../play/MoveList'
import { EvalGraph } from './EvalGraph'
import { ReviewMoveCard } from './ReviewMoveCard'
import { ReviewSummary } from './ReviewSummary'
import { useOpeningBook } from '../../openings/useOpeningBook'
import { OpeningPanel } from '../openings/OpeningPanel'
import { leftBookNote } from '../openings/leftBookNote'

export function ReviewScreen({ id }: { id: string }) {
  const game = useGame(id)
  if (game === undefined) return <p className="muted page-message">Loading game…</p>
  if (game === null) {
    return (
      <div className="card page-message">
        <p>That game isn't saved on this device.</p>
        <a href="#/games">Back to your games</a>
      </div>
    )
  }
  return <ReviewView key={game.id} game={game} />
}

function replayHistory(g: GameRecord): Move[] {
  const chess = g.startFen ? new Chess(g.startFen) : new Chess()
  for (const m of g.moves) chess.move(parseUci(m))
  return chess.history({ verbose: true })
}

function ReviewView({ game }: { game: GameRecord }) {
  const history = useMemo(() => replayHistory(game), [game])
  const positions = useMemo(
    () => (history.length ? [history[0].before, ...history.map((m) => m.after)] : [new Chess(game.startFen).fen()]),
    [history, game.startFen],
  )

  // Use the stored review if the game has been fully analysed; otherwise run the engine now.
  const stored = game.review?.complete ? game.review : null
  const openingInfo = useOpeningBook(positions)
  const analysis = useGameAnalysis(positions, history, game.userColor, {
    enabled: !stored,
    bookPlies: openingInfo?.status.inBook,
  })
  const live = useMemo<GameReview | null>(
    () =>
      stored
        ? null
        : buildReview(history, positions[0], analysis.snapshot.results, analysis.ratings, analysis.notes, game.userColor),
    [stored, history, positions, analysis.snapshot.results, analysis.ratings, analysis.notes, game.userColor],
  )
  const review = stored ?? live!

  // Save the review (and the annotated PGN) once the engine has finished.
  // Wait for the opening book too, so book moves are stored as book moves.
  useEffect(() => {
    if (!live?.complete || !openingInfo) return
    const opening = openingInfo.status.opening
    void saveGame({
      ...game,
      review: live,
      // Lichess games already have Lichess's own opening name; bot games get the book's.
      opening: game.opening ?? opening?.name,
      eco: game.eco ?? opening?.eco,
    })
  }, [live, game, openingInfo])

  const done = positions.filter((f) => analysis.snapshot.results.has(f)).length
  const [ply, setPly] = useState(-1)
  const [flipped, setFlipped] = useState(false)
  const last = history.length - 1
  const go = (p: number) => setPly(Math.max(-1, Math.min(last, p)))

  // Arrow keys step through the game.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(-1, p - 1))
      else if (e.key === 'ArrowRight') setPly((p) => Math.min(last, p + 1))
      else if (e.key === 'Home') setPly(-1)
      else if (e.key === 'End') setPly(last)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last])

  const fen = ply === -1 ? positions[0] : history[ply].after
  const board = useMemo(() => new Chess(fen), [fen])
  const current = ply >= 0 ? review.plies[ply] : null
  const j = current?.judgement
  const userSide = game.userColor === 'w' ? 'white' : 'black'
  const orientation = flipped ? (userSide === 'white' ? 'black' : 'white') : userSide
  const showBestArrow = j && j.bestUci && !['best', 'great', 'brilliant', 'book'].includes(j.rating)
  const arrow = showBestArrow
    ? { from: j.bestUci!.slice(0, 2) as Square, to: j.bestUci!.slice(2, 4) as Square, color: 'rgba(76, 175, 80, 0.85)' }
    : null
  const evalNow = ply === -1 ? review.startEval : (current?.evalAfter ?? null)
  const badges = review.plies.map<MoveRating | 'pending' | null>((p, i) =>
    p.judgement ? p.judgement.rating : history[i].color === game.userColor && !review.complete ? 'pending' : null,
  )
  const marks = review.plies.flatMap((p, i) => (p.judgement ? [{ ply: i, rating: p.judgement.rating }] : []))
  const opponent = opponentOf(game)

  async function remove() {
    if (!window.confirm('Delete this game from this device?')) return
    await deleteGame(game.id)
    navigate({ name: 'games' })
  }

  return (
    <div className="review-screen">
      <section className="board-area">
        <div className="review-heading">
          <a href="#/games" className="back-link">
            ← Games
          </a>
          <span className="muted">
            vs {opponent.name}
            {opponent.rating ? ` (${opponent.rating})` : ''} · {formatDate(game.endedAt)}
          </span>
        </div>
        <div className="board-row">
          <EvalBar score={evalNow} orientation={orientation} />
          <GameBoard
            boardId="review-board"
            game={board}
            orientation={orientation}
            userColor={game.userColor}
            canMove={false}
            lastMove={ply >= 0 ? history[ply] : undefined}
            onMove={() => false}
            badge={j ? { square: history[ply].to as Square, rating: j.rating } : null}
            arrow={arrow}
          />
        </div>
        <div className="review-nav" role="group" aria-label="Step through the game">
          <button type="button" aria-label="First move" onClick={() => go(-1)} disabled={ply === -1}>
            «
          </button>
          <button type="button" aria-label="Previous move" onClick={() => go(ply - 1)} disabled={ply === -1}>
            ‹
          </button>
          <span className="review-pos" data-testid="review-pos">
            {ply === -1 ? 'Start' : `${Math.floor(ply / 2) + 1}${history[ply].color === 'w' ? '.' : '...'} ${history[ply].san}`}
          </span>
          <button type="button" aria-label="Next move" onClick={() => go(ply + 1)} disabled={ply === last}>
            ›
          </button>
          <button type="button" aria-label="Last move" onClick={() => go(last)} disabled={ply === last}>
            »
          </button>
          <button type="button" aria-label="Flip board" className="flip" onClick={() => setFlipped((f) => !f)}>
            <FlipIcon />
          </button>
        </div>
        <EvalGraph evals={[review.startEval, ...review.plies.map((p) => p.evalAfter)]} marks={marks} current={ply} onSelect={go} />
      </section>

      <aside className="side-area">
        {!review.complete && (
          <div className="card analysing" data-testid="analysing">
            <p>
              Analysing with Stockfish… {done} of {positions.length} positions
            </p>
            <div className="progress">
              <span style={{ width: `${(done / positions.length) * 100}%` }} />
            </div>
          </div>
        )}
        <ReviewMoveCard
          ply={ply}
          move={ply >= 0 ? history[ply] : null}
          review={review}
          game={game}
          bookNote={leftBookNote(openingInfo, history, ply, game.userColor)}
        />
        <OpeningPanel info={openingInfo} history={history} movesFrom={null} onJump={go} />
        <ReviewSummary game={game} review={review} onJump={go} />
        <section className="card moves-card" aria-label="Moves">
          <h2 className="card-title">Moves</h2>
          <MoveList history={history} ratings={badges} currentPly={ply} onSelect={go} />
        </section>
        <section className="card review-actions">
          <button type="button" onClick={() => downloadText(`chess-guru-${game.id.replace(/[^a-z0-9]/gi, '-')}.pgn`, game.pgn ?? '', 'application/x-chess-pgn')}>
            Download PGN
          </button>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(game.pgn ?? '')}>
            Copy PGN
          </button>
          {game.url && (
            <a className="button-link" href={game.url} target="_blank" rel="noreferrer">
              Open on Lichess
            </a>
          )}
          <button type="button" className="danger" onClick={remove}>
            Delete game
          </button>
        </section>
      </aside>
    </div>
  )
}

