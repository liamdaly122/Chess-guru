import { useState } from 'react'
import { BulbIcon } from '../../ui/icons'
import type { CoachMessage } from './coachMessage'
import { RatingBadge } from './RatingBadge'
import { KnightMark } from '../../ui/KnightMark'

/**
 * The coach above the board on phones, styled after Chess.com's coach: an avatar with a speech
 * bubble holding the rating, the evaluation and the full note (never cut off). For mistakes a
 * Tip button shows what to look for next time. Hidden on wider screens, which show the full
 * coach card beside the board instead.
 */
export function CoachBubble({ message }: { message: CoachMessage }) {
  const key = message.id ?? `${message.title ?? ''}|${message.text}`
  const [tipFor, setTipFor] = useState<string | null>(null)
  const showTip = tipFor === key

  return (
    <div className="coach-row" data-testid="coach-bubble">
      <span className="coach-face" aria-hidden>
        <KnightMark size={30} withBase={false} />
      </span>
      <div className={`coach-speech tone-edge-${message.tone}`} aria-live="polite" key={key}>
        {(message.title || message.badge || message.evalText) && (
          <div className="coach-speech-head">
            {message.badge && <RatingBadge rating={message.badge} size="md" />}
            {message.title && <strong className="coach-speech-title">{message.title}</strong>}
            {message.tip && (
              <button
                type="button"
                className="coach-speech-button"
                onClick={() => setTipFor(showTip ? null : key)}
                aria-expanded={showTip}
                aria-label={showTip ? 'Hide tip' : 'Show tip'}
              >
                <BulbIcon width={16} height={16} />
                Tip
              </button>
            )}
            {message.evalText && (
              <span className={`eval-chip favours-${message.evalFavours}`} title="Evaluation after the move">
                {message.evalText}
              </span>
            )}
          </div>
        )}
        <p className="coach-speech-text">{message.text}</p>
        {message.tip && showTip && (
          <p className="coach-speech-tip" data-testid="coach-tip">
            <span className="tip-label">{message.tipLabel ?? 'Next time'}</span>
            {message.tip}
          </p>
        )}
        {message.actions && message.actions.length > 0 && (
          <div className="coach-speech-actions">
            {message.actions.map((a) => (
              <button key={a.label} type="button" className={a.primary ? 'primary' : ''} onClick={a.onClick}>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
