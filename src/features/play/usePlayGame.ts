import { Chess, type Color, type Move } from 'chess.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { botName, findLevel, MIN_BOT_DELAY_MS, type Level } from '../../config/levels'
import { MAIA } from '../../config/maia'
import type { MaiaStatus } from '../../engine/MaiaEngine'
import { getGameStatus, type GameStatus } from '../../chess/gameStatus'
import { parseUci, plyToUndo, type MoveInput } from '../../chess/moves'
import type { OpponentEngine } from '../../engine/OpponentEngine'
import { BotOpponent } from '../../engine/BotOpponent'

export type ColourChoice = 'w' | 'b' | 'random'

export interface GameSettings {
  colour: ColourChoice
  levelRating: number
  /** Move the bot up a level after a win and down after a loss. */
  adaptive?: boolean
}

interface GameState {
  /** Increases on every new game, so stale bot replies can be ignored. */
  id: number
  /** Unique id used to save the game. */
  uid: string
  /** When the game started (ms since 1970). */
  startedAt: number
  /** The user resigned. */
  resigned: boolean
  userColor: Color
  level: Level
  /** Starting position if not the normal one (set with ?fen= in the URL, for testing). */
  startFen?: string
  /** Moves played so far, in UCI notation. The board is rebuilt from these. */
  moves: string[]
  /** How many times the user has taken a move back this game. */
  takebacks: number
  /** Half-move indexes where the user asked for a hint before moving. */
  hintedPlies: number[]
  /** Blunder check was on for at least one of the user's moves. */
  blunderCheck: boolean
  /** Times blunder check stopped the user (taken back or played anyway). */
  blunderChecks: number
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

export function saveSettings(s: GameSettings) {
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
  // Development only. On the live site this would let anyone paste a position from a game
  // they are playing elsewhere and get engine help, which the app must never do.
  if (!import.meta.env.DEV) return undefined
  try {
    const fen = new URLSearchParams(window.location.search).get('fen')
    if (!fen) return undefined
    new Chess(fen) // throws if the FEN is invalid
    return fen
  } catch {
    return undefined
  }
}

function freshGame(id: number, userColor: Color, level: Level, startFen?: string): GameState {
  return {
    id,
    uid: crypto.randomUUID(),
    startedAt: Date.now(),
    resigned: false,
    userColor,
    level,
    startFen,
    moves: [],
    takebacks: 0,
    hintedPlies: [],
    blunderCheck: false,
    blunderChecks: 0,
  }
}

function useOpponent(): {
  opponent: BotOpponent | null
  ready: boolean
  error: string | null
  maiaStatus: MaiaStatus
} {
  const [opponent, setOpponent] = useState<BotOpponent | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [maiaStatus, setMaiaStatus] = useState<MaiaStatus>({ state: 'idle' })

  useEffect(() => {
    let live = true
    let engine: BotOpponent
    try {
      engine = new BotOpponent()
    } catch (e) {
      // oxlint-disable-next-line react/set-state-in-effect
      setError(`Could not start the engine: ${String(e)}`)
      return
    }
    // The engine is an external system (a Web Worker), so creating it here is intended.
    // oxlint-disable-next-line react/set-state-in-effect
    setOpponent(engine)
    const offStatus = engine.onMaiaStatus((s) => live && setMaiaStatus(s))
    engine.whenReady().then(
      () => live && setReady(true),
      (e) => live && setError(`Engine failed to load: ${String(e)}`),
    )
    return () => {
      live = false
      offStatus()
      setReady(false)
      engine.dispose()
    }
  }, [])

  return { opponent, ready, error, maiaStatus }
}

/** How long the bot waits before showing its move: human-like for Maia, short for Stockfish. */
function botDelayMs(level: Level): number {
  if (level.engine.kind !== 'maia') return MIN_BOT_DELAY_MS
  const { min, max } = MAIA.thinkTimeMs
  return min + Math.random() * (max - min)
}

export interface PlayOptions {
  /** While true, the bot doesn't start its reply (e.g. waiting for the user's move to be rated). */
  holdBot?: boolean
}

export function usePlayGame({ holdBot = false }: PlayOptions = {}) {
  const { opponent, ready, error, maiaStatus } = useOpponent()
  const [state, setState] = useState<GameState>(() => {
    const s = loadSettings()
    const startFen = fenFromUrl()
    const userColor = startFen ? new Chess(startFen).turn() : resolveColour(s.colour)
    return freshGame(1, userColor, findLevel(s.levelRating), startFen)
  })

  const game = useMemo(() => replay(state.startFen, state.moves), [state.startFen, state.moves])
  const status = useMemo<GameStatus>(() => {
    if (state.resigned) {
      const winner = state.userColor === 'w' ? 'b' : 'w'
      return { over: true, result: winner === 'w' ? '1-0' : '0-1', reason: 'resignation', winner }
    }
    return getGameStatus(game)
  }, [game, state.resigned, state.userColor])
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
    if (!opponent || !ready || holdBot || status.over || game.turn() === state.userColor) return
    const controller = new AbortController()
    const fen = game.fen()
    const startedAt = Date.now()

    opponent
      .chooseMove(fen, state.level, controller.signal, positions.slice(0, -1))
      .then(async (uci) => {
        if (!uci || controller.signal.aborted) return
        const wait = botDelayMs(state.level) - (Date.now() - startedAt)
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
  }, [opponent, ready, holdBot, game, positions, status.over, state.userColor, state.level, state.id, state.moves.length])

  /** Try to play a move for the user. Returns true if it was legal. `blunderCheck`: the setting is on. */
  const playUserMove = useCallback(
    (input: MoveInput, blunderCheck = false): boolean => {
      if (!isUserTurn) return false
      const test = new Chess(game.fen())
      let move: Move
      try {
        move = test.move(input)
      } catch {
        return false
      }
      const uci = move.from + move.to + (move.promotion ?? '')
      setState((prev) => ({ ...prev, moves: [...prev.moves, uci], blunderCheck: prev.blunderCheck || blunderCheck }))
      return true
    },
    [game, isUserTurn],
  )

  /**
   * Blunder check: take back the user's last move (the bot hasn't replied yet). Not counted as a
   * takeback; counted as a blunder check instead.
   */
  const retractForBlunderCheck = useCallback(() => {
    setState((prev) => {
      const g = replay(prev.startFen, prev.moves)
      if (prev.moves.length === 0 || g.turn() === prev.userColor) return prev
      const moves = prev.moves.slice(0, -1)
      return { ...prev, moves, blunderChecks: prev.blunderChecks + 1, hintedPlies: prev.hintedPlies.filter((p) => p < moves.length) }
    })
  }, [])

  /** Blunder check: the user decided to play the move anyway. */
  const keepAfterBlunderCheck = useCallback(() => {
    setState((prev) => ({ ...prev, blunderChecks: prev.blunderChecks + 1 }))
  }, [])

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.resigned) return prev
      const g = replay(prev.startFen, prev.moves)
      const n = plyToUndo(prev.moves.length, g.turn(), prev.userColor)
      if (n === 0) return prev
      const moves = prev.moves.slice(0, -n)
      return {
        ...prev,
        moves,
        takebacks: prev.takebacks + 1,
        hintedPlies: prev.hintedPlies.filter((p) => p < moves.length),
      }
    })
  }, [])

  const newGame = useCallback((settings: GameSettings) => {
    saveSettings(settings)
    setState((prev) => freshGame(prev.id + 1, resolveColour(settings.colour), findLevel(settings.levelRating)))
  }, [])

  /** Same colour again, at the same level (or the one given, for the adaptive bot). */
  const rematch = useCallback((levelRating?: number) => {
    setState((prev) => freshGame(prev.id + 1, prev.userColor, levelRating ? findLevel(levelRating) : prev.level))
  }, [])

  const resign = useCallback(() => {
    setState((prev) => ({ ...prev, resigned: true }))
  }, [])

  /** Record that the user asked for a hint on the move they are about to play. */
  const markHintUsed = useCallback(() => {
    setState((prev) =>
      prev.hintedPlies.includes(prev.moves.length)
        ? prev
        : { ...prev, hintedPlies: [...prev.hintedPlies, prev.moves.length] },
    )
  }, [])

  const canUndo = !state.resigned && plyToUndo(state.moves.length, game.turn(), state.userColor) > 0

  return {
    uid: state.uid,
    startedAt: state.startedAt,
    startFen: state.startFen,
    moves: state.moves,
    game,
    fen: game.fen(),
    history,
    positions,
    status,
    userColor: state.userColor,
    level: state.level,
    takebacks: state.takebacks,
    hintedPlies: state.hintedPlies,
    blunderCheck: state.blunderCheck,
    blunderChecks: state.blunderChecks,
    retractForBlunderCheck,
    keepAfterBlunderCheck,
    engineName: botName(state.level),
    maiaStatus,
    engineReady: ready,
    engineError: error,
    botThinking,
    isUserTurn,
    canUndo,
    playUserMove,
    undo,
    newGame,
    rematch,
    resign,
    markHintUsed,
  }
}
