import { Chess, type Move, type Square } from 'chess.js'
import { useEffect, useMemo, useState } from 'react'
import { navigate } from '../../app/route'
import type { MoveRating } from '../../chess/classify'
import { keyMoments, moveName } from '../../review/keyMoments'
import { followUpFor, lineMoves, numberedLine } from '../../review/followUp'
import { checkAttempt, isGoodAlternative } from '../../puzzles/mistakes'
import { MISTAKE_PUZZLES } from '../../config/mistakes'
import { useAnalyser } from '../../engine/useAnalyser'
import { useLiveEval } from '../../engine/useLiveEval'
import { formatScore, toWhitePov } from '../../chess/score'
import type { MoveInput } from '../../chess/moves'
import type { CoachMessage } from '../play/coachMessage'
import { deleteGame } from '../../storage/games'
import { formatDate, opponentOf } from '../../storage/gameInfo'
import type { GameRecord } from '../../storage/types'
import { useGame } from '../../storage/useGames'
import { downloadText } from '../../storage/backup'
import { FlipIcon } from '../../ui/icons'
import { EvalBar } from '../play/EvalBar'
import { GameBoard } from '../play/GameBoard'
import { MoveList } from '../play/MoveList'
import { EvalGraph } from './EvalGraph'
import { ReviewSummary } from './ReviewSummary'
import { reviewMessage } from './reviewMessage'
import { CoachBubble } from '../play/CoachBubble'
import { MoveStrip } from '../play/MoveStrip'
import { useGameReview } from './useGameReview'
import { OpeningPanel } from '../openings/OpeningPanel'
import { leftBookNote } from '../openings/leftBookNote'
import { MOMENT_LABEL } from './moments'

const BEST_ARROW = 'rgba(76, 175, 80, 0.85)'

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

/**
 * Game review, like Chess.com's: a summary first, then "Start review" walks through the key
 * moments (or every move), with the coach saying why each move was good or bad.
 */
function ReviewView({ game }: { game: GameRecord }) {
  const { history, positions, review, openingInfo, progress } = useGameReview(game)
  const moments = useMemo(() => (review.complete ? keyMoments(review, game.userColor) : []), [review, game.userColor])
  const [mode, setMode] = useState<'summary' | 'review'>('summary')
  const [ply, setPly] = useState(-1)
  const [keyOnly, setKeyOnly] = useState(true)
  const [flipped, setFlipped] = useState(false)
  const [bestFor, setBestFor] = useState<number | null>(null)
  const [tool, setTool] = useState<Tool | null>(null)
  const analyse = useAnalyser()
  const last = history.length - 1

  const momentIndex = moments.findIndex((m) => m.ply === ply)
  const nextMoment = moments.find((m) => m.ply > ply)
  const prevMoment = [...moments].reverse().find((m) => m.ply < ply)
  const canNext = keyOnly ? !!nextMoment : ply < last
  const canPrev = ply > -1

  function goTo(p: number) {
    setMode('review')
    setTool(null)
    setPly(Math.max(-1, Math.min(last, p)))
  }
  function next() {
    setTool(null)
    if (keyOnly) {
      if (nextMoment) setPly(nextMoment.ply)
      else setMode('summary')
    } else setPly((p) => Math.min(last, p + 1))
  }
  function prev() {
    setTool(null)
    if (keyOnly) setPly(prevMoment ? prevMoment.ply : -1)
    else setPly((p) => Math.max(-1, p - 1))
  }

  // Arrow keys: next and previous (key moments or every move).
  useEffect(() => {
    if (mode !== 'review') return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft') document.querySelector<HTMLButtonElement>('[data-nav=prev]')?.click()
      else if (e.key === 'ArrowRight') document.querySelector<HTMLButtonElement>('[data-nav=next]')?.click()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  const current = ply >= 0 ? review.plies[ply] : null
  const j = current?.judgement
  // "Best" shows the position before the move with the engine's move as an arrow (like Chess.com).
  const canShowBest = !!j?.bestUci && current?.color === game.userColor && !['best', 'great', 'brilliant', 'book'].includes(j.rating)
  const showingBest = canShowBest && bestFor === ply
  const finalView = mode === 'summary'
  const shownPly = finalView ? last : ply
  const gameFen = shownPly === -1 ? positions[0] : showingBest ? history[ply].before : history[shownPly].after
  const toolView = tool && !finalView ? toolBoard(tool) : null
  const fen = toolView?.fen ?? gameFen
  const board = useMemo(() => new Chess(fen), [fen])
  const live = useLiveEval(tool?.kind === 'explore' && !finalView ? fen : null)
  const liveBest = live?.line?.pv[0]
  const userSide = game.userColor === 'w' ? 'white' : 'black'
  const orientation = flipped ? (userSide === 'white' ? 'black' : 'white') : userSide
  const bestArrow = (uci: string | null | undefined) =>
    uci ? { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, color: BEST_ARROW } : null
  const arrow = toolView
    ? tool?.kind === 'retry' && tool.status === 'shown'
      ? bestArrow(j?.bestUci)
      : tool?.kind === 'explore' && tool.showBest
        ? bestArrow(liveBest)
        : null
    : showingBest
      ? bestArrow(j?.bestUci)
      : null
  const gameEval = shownPly === -1 ? review.startEval : (review.plies[shownPly]?.evalAfter ?? null)
  const evalNow = tool?.kind === 'explore' && live?.line ? toWhitePov(live.line.score, board.turn()) : toolView ? null : gameEval
  const badges = review.plies.map<MoveRating | 'pending' | null>((p) => (p.judgement ? p.judgement.rating : !review.complete ? 'pending' : null))
  const marks = moments.flatMap((m) => {
    const r = review.plies[m.ply]?.judgement?.rating
    return r ? [{ ply: m.ply, rating: r }] : []
  })
  const opponent = opponentOf(game)
  const message = tool && !finalView
    ? toolMessage(tool, { played: current?.san ?? '', bestSan: j?.bestSan ?? null, note: current?.note?.text ?? null, live, fen })
    : reviewMessage(review, ply, game.userColor, opponent.name, leftBookNote(openingInfo, history, ply, game.userColor))
  const lastMoveShown = toolView
    ? toolView.lastMove
    : showingBest
      ? ply > 0
        ? history[ply - 1]
        : undefined
      : shownPly >= 0
        ? history[shownPly]
        : undefined
  const followUp = followUpFor(review, ply, canShowBest)
  const canRetry = canShowBest

  // Follow-up plays itself, one move at a time.
  useEffect(() => {
    if (tool?.kind !== 'follow' || tool.step >= tool.moves.length) return
    const t = setTimeout(() => setTool((x) => (x?.kind === 'follow' ? { ...x, step: x.step + 1 } : x)), FOLLOW_STEP_MS)
    return () => clearTimeout(t)
  }, [tool])

  function onToolMove(input: MoveInput): boolean {
    if (!tool) return false
    const uci = input.from + input.to + (input.promotion ?? '')
    if (tool.kind === 'explore') {
      const c = new Chess(fen)
      try {
        c.move(input)
      } catch {
        return false
      }
      setTool({ ...tool, moves: [...tool.moves, uci] })
      return true
    }
    if (tool.kind !== 'retry' || !j?.bestUci || (tool.status !== 'trying' && tool.status !== 'wrong')) return false
    const check = checkAttempt({ fen: tool.startFen, solution: j.bestUci }, uci)
    if (check.verdict === 'illegal') return false
    const after = new Chess(tool.startFen)
    const san = after.move(input).san
    const attempt = { uci, san, fen: after.fen() }
    if (check.verdict === 'correct') {
      setTool({ ...tool, status: 'solved', attempt, text: uci === j.bestUci ? `${san} is the move.` : 'Checkmate. That works too!' })
      return true
    }
    setTool({ ...tool, status: 'checking', attempt })
    const winBest = j.winBefore
    void analyse(check.fenAfter, { depth: MISTAKE_PUZZLES.checkDepth, maxTimeMs: MISTAKE_PUZZLES.checkTimeMs }).then((a) => {
      setTool((x) => {
        if (x?.kind !== 'retry' || x.attempt?.uci !== uci) return x
        return a && isGoodAlternative({ winBest }, a)
          ? { ...x, status: 'solved', text: `${san} works too. The engine's first choice was ${j.bestSan}.` }
          : { ...x, status: 'wrong', tries: x.tries + 1, attempt: undefined, text: `${san} isn't better. Try again.` }
      })
    })
    return true
  }
  const shownJ = finalView ? null : j

  async function remove() {
    if (!window.confirm('Delete this game from this device?')) return
    await deleteGame(game.id)
    navigate({ name: 'games' })
  }

  const analysingCard = !review.complete && (
    <div className="card analysing" data-testid="analysing">
      <p>
        {game.review?.complete ? 'Updating this review' : 'Analysing with Stockfish'}… {progress.done} of {positions.length} positions
      </p>
      <div className="progress">
        <span style={{ width: `${(progress.done / positions.length) * 100}%` }} />
      </div>
    </div>
  )

  const heading = (
    <div className="review-heading">
      {mode === 'summary' ? (
        <a href="#/games" className="back-link">
          ← Games
        </a>
      ) : (
        <button type="button" className="back-link link-button" onClick={() => setMode('summary')} data-testid="back-to-summary">
          ← Summary
        </button>
      )}
      <span className="muted">
        vs {opponent.name}
        {opponent.rating ? ` (${opponent.rating})` : ''} · {formatDate(game.endedAt)}
      </span>
    </div>
  )

  const boardRow = (
    <div className="board-row">
      <EvalBar score={evalNow} orientation={orientation} />
      <GameBoard
        boardId="review-board"
        game={board}
        orientation={orientation}
        userColor={toolView ? board.turn() : game.userColor}
        canMove={!!toolView?.canMove}
        lastMove={lastMoveShown}
        onMove={onToolMove}
        badge={
          toolView
            ? tool?.kind === 'retry' && tool.status === 'solved' && tool.attempt
              ? { square: tool.attempt.uci.slice(2, 4) as Square, rating: 'best' }
              : null
            : shownJ && !showingBest
              ? { square: history[ply].to as Square, rating: shownJ.rating }
              : null
        }
        arrow={arrow}
      />
    </div>
  )

  const actions = (
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
  )

  if (mode === 'summary') {
    return (
      <div className="review-screen summary-mode">
        <section className="board-area">
          {heading}
          <div className="desktop-only">{boardRow}</div>
        </section>
        <aside className="side-area">
          {analysingCard}
          <ReviewSummary
            game={game}
            review={review}
            moments={moments}
            onStart={() => {
              setKeyOnly(true)
              goTo(moments[0]?.ply ?? 0)
            }}
            onJump={goTo}
          />
          {actions}
        </aside>
      </div>
    )
  }

  const navLabel =
    ply === -1 ? 'Start' : keyOnly && momentIndex >= 0 ? `Moment ${momentIndex + 1} of ${moments.length}` : moveName(review, ply)

  return (
    <div className="review-screen">
      <section className="board-area">
        {heading}
        {/* Phones: coach above the board, like Chess.com's Game Review. */}
        <div className="mobile-only mobile-top">
          {analysingCard}
          <CoachBubble message={message} />
        </div>
        {boardRow}
        <div className="review-nav" role="group" aria-label="Step through the game">
          <button type="button" aria-label="Previous" data-nav="prev" onClick={prev} disabled={!canPrev}>
            ‹
          </button>
          <span className="review-pos" data-testid="review-pos">
            {navLabel}
            {momentIndex >= 0 && <span className={`moment-chip kind-${moments[momentIndex].kind}`}>{MOMENT_LABEL[moments[momentIndex].kind]}</span>}
          </span>
          {canNext || !keyOnly ? (
            <button type="button" aria-label="Next" data-nav="next" onClick={next} disabled={!canNext}>
              ›
            </button>
          ) : (
            <button type="button" className="primary finish-button" data-nav="next" onClick={next}>
              Finish
            </button>
          )}
        </div>
        <div className="review-tools" role="group" aria-label="Review tools">
          <div className="segmented" role="radiogroup" aria-label="Go through">
            <button type="button" role="radio" aria-checked={keyOnly} className={keyOnly ? 'active' : ''} onClick={() => setKeyOnly(true)}>
              Key moments
            </button>
            <button type="button" role="radio" aria-checked={!keyOnly} className={!keyOnly ? 'active' : ''} onClick={() => setKeyOnly(false)}>
              Every move
            </button>
          </div>
          <button type="button" aria-label="Flip board" className="tool-button icon-only" onClick={() => setFlipped((f) => !f)}>
            <FlipIcon />
          </button>
        </div>
        <div className="review-actions-row" role="group" aria-label="Look closer">
          {!tool ? (
            <>
              <button
                type="button"
                className={`tool-button ${showingBest ? 'active' : ''}`}
                aria-pressed={showingBest}
                onClick={() => setBestFor(showingBest ? null : ply)}
                disabled={!canShowBest}
              >
                Best
              </button>
              <button
                type="button"
                className="tool-button"
                disabled={!canRetry}
                onClick={() => {
                  setBestFor(null)
                  setTool({ kind: 'retry', ply, startFen: history[ply].before, status: 'trying', tries: 0 })
                }}
              >
                Retry
              </button>
              <button
                type="button"
                className="tool-button"
                disabled={!followUp}
                onClick={() => {
                  if (!followUp) return
                  setBestFor(null)
                  setTool({ kind: 'follow', ply, startFen: followUp.fen, moves: lineMoves(followUp.fen, followUp.sans), step: 0, after: followUp.kind === 'after' })
                }}
              >
                Follow-up
              </button>
              <button
                type="button"
                className="tool-button"
                onClick={() => {
                  setBestFor(null)
                  setTool({ kind: 'explore', ply, startFen: gameFen, moves: [], showBest: true })
                }}
              >
                Explore
              </button>
            </>
          ) : (
            <>
              {tool.kind === 'retry' && (tool.status === 'trying' || tool.status === 'wrong') && (
                <button type="button" className="tool-button" onClick={() => setTool({ ...tool, status: 'shown' })}>
                  Show answer
                </button>
              )}
              {tool.kind === 'follow' && (
                <button type="button" className="tool-button" onClick={() => setTool({ ...tool, step: 0 })}>
                  Replay
                </button>
              )}
              {tool.kind === 'explore' && (
                <>
                  <button type="button" className="tool-button" disabled={tool.moves.length === 0} onClick={() => setTool({ ...tool, moves: tool.moves.slice(0, -1) })}>
                    Undo
                  </button>
                  <button
                    type="button"
                    className={`tool-button ${tool.showBest ? 'active' : ''}`}
                    aria-pressed={tool.showBest}
                    onClick={() => setTool({ ...tool, showBest: !tool.showBest })}
                  >
                    Best move
                  </button>
                </>
              )}
              <button type="button" className="tool-button primary" onClick={() => setTool(null)} data-testid="back-to-game">
                Back to game
              </button>
            </>
          )}
        </div>
        <div className="mobile-only mobile-strip">
          <MoveStrip history={history} ratings={badges} currentPly={ply} onSelect={goTo} />
        </div>
        <EvalGraph evals={[review.startEval, ...review.plies.map((p) => p.evalAfter)]} marks={marks} current={ply} onSelect={goTo} />
      </section>

      <aside className="side-area">
        <div className="desktop-only coach-panel">
          {analysingCard}
          <CoachBubble message={message} />
        </div>
        <OpeningPanel info={openingInfo} history={history} movesFrom={null} onJump={goTo} />
        <section className="card moves-card desktop-only" aria-label="Moves">
          <h2 className="card-title">Moves</h2>
          <MoveList history={history} ratings={badges} currentPly={ply} onSelect={goTo} />
        </section>
        {actions}
      </aside>
    </div>
  )
}

const FOLLOW_STEP_MS = 900

type Tool =
  | {
      kind: 'retry'
      ply: number
      startFen: string
      status: 'trying' | 'checking' | 'wrong' | 'solved' | 'shown'
      tries: number
      attempt?: { uci: string; san: string; fen: string }
      text?: string
    }
  | { kind: 'follow'; ply: number; startFen: string; moves: Move[]; step: number; after: boolean }
  | { kind: 'explore'; ply: number; startFen: string; moves: string[]; showBest: boolean }

/** What the board shows while a tool is open. */
function toolBoard(tool: Tool): { fen: string; lastMove?: Move; canMove: boolean } {
  if (tool.kind === 'retry') {
    const fen = (tool.status === 'solved' || tool.status === 'checking') && tool.attempt ? tool.attempt.fen : tool.startFen
    return { fen, canMove: tool.status === 'trying' || tool.status === 'wrong' }
  }
  if (tool.kind === 'follow') {
    const shown = tool.moves.slice(0, tool.step)
    return { fen: shown.length ? shown[shown.length - 1].after : tool.startFen, lastMove: shown[shown.length - 1], canMove: false }
  }
  const chess = new Chess(tool.startFen)
  let lastMove: Move | undefined
  for (const uci of tool.moves) lastMove = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  return { fen: chess.fen(), lastMove, canMove: true }
}

/** The coach bubble while a tool is open. */
function toolMessage(
  tool: Tool,
  ctx: { played: string; bestSan: string | null; note: string | null; live: ReturnType<typeof useLiveEval>; fen: string },
): CoachMessage {
  if (tool.kind === 'retry') {
    switch (tool.status) {
      case 'trying':
        return { tone: 'hint', title: 'Find a better move', text: `You played ${ctx.played} here. Look again and find something stronger.` }
      case 'checking':
        return { tone: 'pending', badge: 'pending', text: `Checking ${tool.attempt?.san ?? 'your move'} with the engine…` }
      case 'wrong':
        return { tone: 'mistake', title: 'Not quite', text: tool.text ?? 'Try again.' }
      case 'solved':
        return { tone: 'best', badge: 'best', title: tool.tries === 0 ? 'Well found!' : 'Got it', text: tool.text ?? '' }
      case 'shown':
        return { tone: 'neutral', title: `The best move was ${ctx.bestSan ?? '?'}`, text: ctx.note ?? 'The green arrow shows it.' }
    }
  }
  if (tool.kind === 'follow') {
    const sans = tool.moves.map((m) => m.san)
    const line = numberedLine(tool.startFen, sans)
    return {
      id: 'follow-up',
      tone: 'neutral',
      title: tool.after ? `What follows ${ctx.played}` : `What ${ctx.bestSan ?? 'the best move'} leads to`,
      text: `The engine's line: ${line}.${tool.step < tool.moves.length ? '' : ' Tap Replay to watch again.'}`,
    }
  }
  const line = ctx.live?.line
  const turn = ctx.fen.split(' ')[1] as 'w' | 'b'
  const white = line ? toWhitePov(line.score, turn) : null
  const evalText = white ? formatScore(white) : undefined
  const evalFavours = white ? ((white.kind === 'cp' ? white.cp >= 0 : white.forUs) ? 'w' : 'b') : undefined
  const bestLine = line?.pv.length ? numberedLine(ctx.fen, lineSans(ctx.fen, line.pv)) : null
  return {
    id: 'explore',
    tone: 'neutral',
    title: 'Exploring',
    text:
      tool.moves.length === 0
        ? `Move any piece to try your own ideas. ${bestLine ? `The engine's best line here: ${bestLine}.` : 'The engine is thinking…'}`
        : `${bestLine ? `The engine's best line from here: ${bestLine}.` : 'The engine is thinking…'}`,
    evalText,
    evalFavours,
  }
}

/** An engine line (UCI) in standard notation, first 5 moves. */
function lineSans(fen: string, pv: string[]): string[] {
  const chess = new Chess(fen)
  const out: string[] = []
  for (const uci of pv.slice(0, 5)) {
    try {
      out.push(chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san)
    } catch {
      break
    }
  }
  return out
}
