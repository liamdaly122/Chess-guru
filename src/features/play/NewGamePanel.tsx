import { useState } from 'react'
import { LEVELS } from '../../config/levels'
import type { ColourChoice, GameSettings } from './usePlayGame'

interface Props {
  initial: GameSettings
  onStart: (settings: GameSettings) => void
  onCancel: () => void
}

const COLOURS: { value: ColourChoice; label: string }[] = [
  { value: 'w', label: 'White' },
  { value: 'b', label: 'Black' },
  { value: 'random', label: 'Random' },
]

export function NewGamePanel({ initial, onStart, onCancel }: Props) {
  const [colour, setColour] = useState<ColourChoice>(initial.colour)
  const [levelRating, setLevelRating] = useState(initial.levelRating)

  return (
    <div className="panel new-game-panel">
      <h2>New game</h2>
      <fieldset>
        <legend>Play as</legend>
        <div className="segmented">
          {COLOURS.map((c) => (
            <label key={c.value} className={colour === c.value ? 'active' : ''}>
              <input
                type="radio"
                name="colour"
                value={c.value}
                checked={colour === c.value}
                onChange={() => setColour(c.value)}
              />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>Bot level</span>
        <select value={levelRating} onChange={(e) => setLevelRating(Number(e.target.value))}>
          {LEVELS.map((l) => (
            <option key={l.rating} value={l.rating}>
              {l.rating} · {l.label}
            </option>
          ))}
        </select>
      </label>
      <p className="hint-text">Ratings are approximate. Levels below 1320 sometimes play random moves.</p>
      <div className="row">
        <button type="button" className="primary" onClick={() => onStart({ colour, levelRating })}>
          Start game
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
