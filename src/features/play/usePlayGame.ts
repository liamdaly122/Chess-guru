import { Chess, type Color, type Move } from 'chess.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { findLevel, MIN_BOT_DELAY_MS, type Level } from '../../config/levels'
import { getGameStatus } from '../../chess/gameStatus'
import { parseUci, plyToUndo, type MoveInput } from '../../chess/moves'
import type { OpponentEngine } from '../../engine/OpponentEngine'
import { StockfishOpponent } from '../../engine/StockfishOpponent'

export type ColourChoice = 'w' | 'b' | 'random'

export interface GameSettings {
  colour: ColourChoice
  levelRating: number
}

interface GameState {
  /** Increases on every new game, so stale bot replies can be ignored. */
  id: number
  userColor: Color
  level: Level
  /** Starting position if not the normal one (set with ?fen= in the URL, for testing). */
  startFen?: string
  /** Moves played so far, in UCI notation. The board is rebuilt from these. */
  moves: string[]
  /** How many times the user has taken a move back this game. */
  takebacks: number
}

const SETTINGS_KEY = 'chess-guru:new-game-settings'
const DEFAULT_SETTINGS: GameSettings = { colour: 'w', levelRating: 1200 }

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // Storage can be unavailable (private mode). Defaults are fine.
  }
  return DEFAULT_SETTINGS
}

function saveSettings(s: GameSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    // Ignore: remembering settings is only a convenience.
  }
}

function resolveColour(c: ColourChoice): Color {
  if (c === 'random') return Math.random() < 0.5 ? 'w' : 'b'
  return c
}

/** Rebuild a chess.js game from a list of UCI moves. Keeps history for repetition checks. */
function replay(startFen: string | undefined, moves: string[]): Chess {
  const game = startFen ? new Chess(startFen) : new Chess()
  for (const m of moves) game.move(parseUci(m))
  return game
}

/**
 * Reads ?fen=... from the page URL so a game can start from any position.
 * Handy for testing promotion, mates and draws. You play the side to move.
 */
function fenFromUrl(): string | undefined {
  try {
    const fen = new URLSearchParams(window.location.search).get('fen')
    if (!fen) return undefined
    new Chess(fen) // throws if the FEN is invalid
    return fen
  } catch {
    return undefined
  }
}

function useOpponent(): { opponent: OpponentEngine | null; ready: boolean; error: string | null } {
  const [opponent, setOpponent] = useState<OpponentEngine | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    let engine: OpponentEngine
    try {
      engine = new StockfishOpponent()
    } catch (e) {
      // oxlint-disable-next-line react/set-state-in-effect
      setError(`Could not start the engine: ${String(e)}`)
      return
    }
    // The engine is an external system (a Web Worker), so creating it here is intended.
    // oxlint-disable-next-line react/set-state-in-effect
    setOpponent(engine)
    engine.whenReady().then(
      () => live && setReady(true),
      (e) => live && setError(`Engine failed to load: ${String(e)}`),
    )
    return () => {
      live = false
      setReady(false)
      engine.dispose()
    }
  }, [])

  return { opponent, ready, error }
}

export function usePlayGame() {
  const { opponent, ready, error } = useOpponent()
  const [state, setState] = useState<GameState>(() => {
    const s = loadSettings()
    const startFen = fenFromUrl()
    const userColor = startFen ? new Chess(startFen).turn() : resolveColour(s.colour)
    return { id: 1, userColor, level: findLevel(s.levelRating), startFen, moves: [], takebacks: 0 }
  })

  const game = useMemo(() => replay(state.startFen, state.moves), [state.startFen, state.moves])
  const status = useMemo(() => getGameStatus(game), [game])
  const history = useMemo<Move[]>(() => game.history({ verbose: true }), [game])
  /** Every position in the game, start to now, as FENs. Used by the analyser. */
  const positions = useMemo(
    () => (history.length ? [history[0].before, ...history.map((m) => m.after)] : [game.fen()]),
    [game, history],
  )
  const isUserTurn = !status.over && game.turn() === state.userColor
  // The bot is always working on a move when it is its turn and the engine is loaded.
  const botThinking = ready && !status.over && !isUserTurn

  // Tell the engine about the new game whenever one starts.
  const startedFor = useRef<{ engine: OpponentEngine; id: number } | null>(null)
  useEffect(() => {
    if (!opponent) return
    const s = startedFor.current
    if (s && s.engine === opponent && s.id === state.id) return
    startedFor.current = { engine: opponent, id: state.id }
    void opponent.newGame(state.level)
  }, [opponent, state.id, state.level])

  // When it's the bot's turn, ask the engine for a move.
  useEffect(() => {
    if (!opponent || !ready || status.over || game.turn() === state.userColor) return
    const controller = new AbortController()
    const fen = game.fen()
    const startedAt = Date.now()

    opponent
      .chooseMove(fen, state.level, controller.signal)
      .then(async (uci) => {
        if (!uci || controller.signal.aborted) return
        const wait = MIN_BOT_DELAY_MS - (Date.now() - startedAt)
        if (wait > 0) await new Promise((r) => setTimeout(r, wait))
        if (controller.signal.aborted) return
        setState((prev) => {
          // Only apply if the position hasn't changed underneath us.
          if (prev.id !== state.id || prev.moves.length !== state.moves.length) return prev
          return { ...prev, moves: [...prev.moves, uci] }
        })
      })
      .catch((e) => console.error('Bot move failed', e))

    return () => controller.abort()
  }, [opponent, ready, game, status.over, state.userColor, state.level, state.id, state.moves.length])

  /** Try to play a move for the user. Returns true if it was legal. */
  const playUserMove = useCallback(
    (input: MoveInput): boolean => {
      if (!isUserTurn) return false
      const test = new Chess(game.fen())
      let move: Move
      try {
        move = test.move(input)
      } catch {
        return false
      }
      const uci = move.from + move.to + (move.promotion ?? '')
      setState((prev) => ({ ...prev, moves: [...prev.moves, uci] }))
      return true
    },
    [game, isUserTurn],
  )

  const undo = useCallback(() => {
    setState((prev) => {
      const g = replay(prev.startFen, prev.moves)
      const n = plyToUndo(prev.moves.length, g.turn(), prev.userColor)
      if (n === 0) return prev
      return { ...prev, moves: prev.moves.slice(0, -n), takebacks: prev.takebacks + 1 }
    })
  }, [])

  const newGame = useCallback((settings: GameSettings) => {
    saveSettings(settings)
    setState((prev) => ({
      id: prev.id + 1,
      userColor: resolveColour(settings.colour),
      level: findLevel(settings.levelRating),
      moves: [],
      takebacks: 0,
    }))
  }, [])

  const canUndo = plyToUndo(state.moves.length, game.turn(), state.userColor) > 0

  return {
    game,
    fen: game.fen(),
    history,
    positions,
    status,
    userColor: state.userColor,
    level: state.level,
    takebacks: state.takebacks,
    engineName: opponent?.name ?? 'Engine',
    engineReady: ready,
    engineError: error,
    botThinking,
    isUserTurn,
    canUndo,
    playUserMove,
    undo,
    newGame,
  }
}
