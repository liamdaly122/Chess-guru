import { listGames } from '../storage/games'
import { queueReviews } from './reviewQueue'
import { isCurrentReview } from './types'

/** Older reviews are re-analysed in the background, the most recent first, this many per session. */
export const UPGRADES_PER_SESSION = 10

/**
 * Queue finished reviews made before both sides were rated, so they gain the new review
 * (opponent's moves, reasons for good moves, key moments). Opening one re-analyses it at once.
 */
export async function queueReviewUpgrades(): Promise<void> {
  const games = await listGames()
  queueReviews(
    games
      .filter((g) => g.review?.complete && !isCurrentReview(g.review))
      .slice(0, UPGRADES_PER_SESSION)
      .map((g) => g.id),
  )
}
