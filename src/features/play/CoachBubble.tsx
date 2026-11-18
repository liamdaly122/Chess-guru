import { useState } from 'react'
import { CapIcon } from '../../ui/icons'
import type { CoachMessage } from './coachMessage'
import { RatingBadge } from './RatingBadge'

/**
 * The coach above the board on phones (like Chess.com): a short speech bubble with the latest
 * rating, note or hint. Tap it to see the "next time" tip. Hidden on wider screens, which show
 * the full coach card beside the board instead.
 */
export function CoachBubble({ message }: { message: CoachMessage }) {
  const [expandedFor, setExpandedFor] = useState<string | null>(null)
  const key = `${message.title ?? ''}|${message.text}`
  const expanded = expandedFor === key
  const canExpand = !!message.more

  return (
    <div className="coach-bubble-row" data-testid="coach-bubble">
      <span className="coach-bubble-avatar" aria-hidden>
        <CapIcon />
      </span>
      <button
        type="button"
        className={`coach-bubble tone-bg-${message.tone} ${expanded ? 'expanded' : ''} ${canExpand && !expanded ? 'has-more' : ''}`}
        onClick={() => canExpand && setExpandedFor(expanded ? null : key)}
        aria-expanded={canExpand ? expanded : undefined}
        aria-live="polite"
        key={key}
      >
        {message.badge && <RatingBadge rating={message.badge} size="sm" className="coach-bubble-badge" />}
        <span className="coach-bubble-text">
          {message.title && <strong>{message.title}. </strong>}
          {message.text}
          {expanded && message.more && <span className="coach-bubble-more">{message.more}</span>}
        </span>
        {canExpand && !expanded && <span className="coach-bubble-hint">More</span>}
      </button>
    </div>
  )
}
