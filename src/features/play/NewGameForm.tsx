import { useState } from 'react'
import { LEVELS } from '../../config/levels'
import { ShuffleIcon } from '../../ui/icons'
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

function bandText(rating: number): string {
  if (rating < 1320) return 'Plays some random moves. Good for learning the basics.'
  if (rating < 1800) return 'Club strength. Punishes loose pieces.'
  if (rating < 2300) return 'Strong. Few free gifts.'
  return 'Very strong. Expect to lose most games.'
}

/** Pick a colour and a bot level, then start. */
export function NewGameForm({ initial, onStart, inProgress, onResign }: Props) {
  const [colour, setColour] = useState<ColourChoice>(initial.colour)
  const startIndex = Math.max(
    0,
    LEVELS.findIndex((l) => l.rating === initial.levelRating),
  )
  const [index, setIndex] = useState(startIndex)
  const level = LEVELS[index]

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
      <p className="muted level-band">{bandText(level.rating)} Ratings are approximate.</p>

      {inProgress && (
        <p className="resign-note">Starting a new game counts the current one as a loss (resigned). It is saved to your games.</p>
      )}
      <button type="button" className="primary wide" onClick={() => onStart({ colour, levelRating: level.rating })}>
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
