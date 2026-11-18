import { useEffect } from 'react'
import { routeHref } from '../../app/route'
import { markSeen, useLichessSync } from '../../lichess/autoSync'
import { CloseIcon } from '../../ui/icons'

/** "3 new games from Lichess", after an automatic import. Cleared on the Games page or with ×. */
export function NewGamesBanner({ onGamesPage }: { onGamesPage: boolean }) {
  const sync = useLichessSync()
  const unseen = sync?.unseen ?? 0
  useEffect(() => {
    if (onGamesPage && unseen > 0) void markSeen()
  }, [onGamesPage, unseen])
  if (!unseen || onGamesPage) return null
  return (
    <div className="update-banner new-games-banner" role="status" data-testid="new-games-banner">
      <a href={routeHref({ name: 'games' })}>
        {unseen} new game{unseen === 1 ? '' : 's'} from Lichess. See {unseen === 1 ? 'it' : 'them'}
      </a>
      <button type="button" className="icon-button" aria-label="Dismiss" onClick={() => void markSeen()}>
        <CloseIcon />
      </button>
    </div>
  )
}
