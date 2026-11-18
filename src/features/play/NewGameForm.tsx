import { useMemo, useState } from 'react'
import { LEVELS } from '../../config/levels'
import { ratingSummary, suggestedLevel } from '../../rating/estimate'
import { useGames } from '../../storage/useGames'
import { ShuffleIcon } from '../../ui/icons'
import { Switch } from '../../ui/Switch'
import type { ColourChoice, GameSettings } from './usePlayGame'

interface Props {
  initial: GameSettings
  onStart: (settings: GameSettings) => void
  /** A game with at least one of your moves is still going. */
  inProgress?: boolean
  onResign?: () => void
}

const COLOURS: { value: ColourChoice; label: string; glyph: React.ReactNode }[] = [
  { value: 'w', label: 'White', glyph: <span className="king-glyph white">♚</span> },
  { value: 'random', label: 'Random', glyph: <ShuffleIcon /> },
  { value: 'b', label: 'Black', glyph: <span className="king-glyph black">♚</span> },
]

function bandText(level: (typeof LEVELS)[number]): string {
  if (level.engine.kind === 'maia') {
    return `Maia, a neural network trained on real games, plays like a human rated about ${level.rating}, mistakes included.`
  }
  if (level.rating < 2300) return 'Stockfish at limited strength. Strong, few free gifts.'
  return 'Stockfish at limited strength. Very strong: expect to lose most games.'
}

/** Pick a colour and a bot level, then start. */
export function NewGameForm({ initial, onStart, inProgress, onResign }: Props) {
  const [colour, setColour] = useState<ColourChoice>(initial.colour)
  const startIndex = Math.max(
    0,
    LEVELS.findIndex((l) => l.rating === initial.levelRating),
  )
  const [index, setIndex] = useState(startIndex)
  const [adaptive, setAdaptive] = useState(!!initial.adaptive)
  const level = LEVELS[index]
  const games = useGames()
  const estimate = useMemo(() => (games ? ratingSummary(games).estimate : null), [games])
  const suggestion = estimate ? suggestedLevel(estimate.rating) : null

  return (
    <div className="new-game">
      <p className="field-label">Play as</p>
      <div className="colour-picker" role="radiogroup" aria-label="Play as">
        {COLOURS.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={colour === c.value}
            className={`colour-option ${colour === c.value ? 'active' : ''}`}
            onClick={() => setColour(c.value)}
          >
            {c.glyph}
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      <p className="field-label">Bot strength</p>
      <div className="level-display">
        <span className="level-rating">{level.rating}</span>
        <span className="level-name">{level.label}</span>
      </div>
      <input
        className="level-slider"
        type="range"
        min={0}
        max={LEVELS.length - 1}
        step={1}
        value={index}
        aria-label="Bot level"
        aria-valuetext={`${level.rating} ${level.label}`}
        onChange={(e) => setIndex(Number(e.target.value))}
        style={{ ['--fill' as string]: `${(index / (LEVELS.length - 1)) * 100}%` }}
      />
      <div className="level-scale" aria-hidden>
        <span>{LEVELS[0].rating}</span>
        <span>{LEVELS[LEVELS.length - 1].rating}</span>
      </div>
      <p className="muted level-band">{bandText(level)} Ratings are approximate.</p>
      {estimate && suggestion && (
        <p className="level-suggestion" data-testid="level-suggestion">
          <span>
            Your rating: about <strong>{estimate.rating}</strong>
          </span>
          {suggestion.rating !== level.rating && (
            <button type="button" className="chip" onClick={() => setIndex(LEVELS.indexOf(suggestion))}>
              Play at {suggestion.rating}
            </button>
          )}
        </p>
      )}
      <Switch
        label="Adjust the level after each game"
        description="Up a level after a win, down after a loss."
        checked={adaptive}
        onChange={setAdaptive}
      />

      {inProgress && (
        <p className="resign-note">Starting a new game counts the current one as a loss (resigned). It is saved to your games.</p>
      )}
      <button type="button" className="primary wide" onClick={() => onStart({ colour, levelRating: level.rating, adaptive })}>
        Start game
      </button>
      {inProgress && onResign && (
        <button type="button" className="wide resign-button" onClick={onResign}>
          Just resign this game
        </button>
      )}
    </div>
  )
}
