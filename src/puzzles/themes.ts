import type { ProgressStats } from '../progress/stats'
import type { GamePhase } from '../review/gamePhase'
import type { LessonCategory } from '../review/types'

/** Lichess puzzle themes we keep in the subset, with friendly names. */
export const THEME_LABEL: Record<string, string> = {
  hangingPiece: 'Hanging pieces',
  fork: 'Forks',
  pin: 'Pins',
  skewer: 'Skewers',
  discoveredAttack: 'Discovered attacks',
  doubleCheck: 'Double check',
  defensiveMove: 'Defending',
  mateIn1: 'Mate in 1',
  mateIn2: 'Mate in 2',
  mateIn3: 'Mate in 3',
  backRankMate: 'Back-rank mate',
  trappedPiece: 'Trapped pieces',
  capturingDefender: 'Capture the defender',
  deflection: 'Deflection',
  attraction: 'Attraction',
  quietMove: 'Quiet moves',
  intermezzo: 'In-between moves',
  xRayAttack: 'X-ray attacks',
  sacrifice: 'Sacrifices',
  exposedKing: 'Exposed king',
  kingsideAttack: 'Kingside attack',
  promotion: 'Promotion',
  advancedPawn: 'Advanced pawns',
  opening: 'Opening tactics',
  middlegame: 'Middlegame tactics',
  endgame: 'Endgames',
}

/** Which puzzle themes train each kind of mistake. */
export const CATEGORY_THEMES: Record<LessonCategory, string[]> = {
  'loose-pieces': ['hangingPiece', 'trappedPiece'],
  forks: ['fork', 'doubleCheck'],
  'pins-skewers': ['pin', 'skewer', 'xRayAttack'],
  threats: ['defensiveMove', 'intermezzo'],
  'king-safety': ['backRankMate', 'mateIn2', 'exposedKing'],
  'missed-tactics': ['fork', 'discoveredAttack', 'capturingDefender', 'deflection'],
  'missed-mates': ['mateIn1', 'mateIn2', 'mateIn3'],
  general: ['quietMove', 'middlegame'],
}

export const PHASE_THEME: Record<GamePhase, string> = {
  opening: 'opening',
  middlegame: 'middlegame',
  endgame: 'endgame',
}

/** Default when there are no reviewed games yet: the most common tactics. */
const DEFAULT_THEMES = ['hangingPiece', 'fork', 'mateIn1', 'pin', 'mateIn2']

/**
 * Puzzle themes to practise, most useful first: themes for your costliest kinds of
 * mistake, then your weakest game phase.
 */
export function recommendedThemes(stats: ProgressStats | null, max = 5): string[] {
  const out: string[] = []
  const add = (t: string) => {
    if (!out.includes(t)) out.push(t)
  }
  for (const p of stats?.patterns ?? []) for (const t of CATEGORY_THEMES[p.category]) add(t)
  if (stats?.weakestPhase) add(PHASE_THEME[stats.weakestPhase])
  for (const t of DEFAULT_THEMES) add(t)
  return out.slice(0, max)
}
