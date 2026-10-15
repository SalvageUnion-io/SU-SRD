import type { CrewLine } from './useGameFeed'

/** What is wrong, in words, or null for "Fine". A parked mech's trouble is its own line. */
export function crewProblem(c: CrewLine): string | null {
  if (c.problems.length > 0) return c.problems.join(' · ')
  if (c.mechAttention && c.mech) return c.mech
  return null
}
