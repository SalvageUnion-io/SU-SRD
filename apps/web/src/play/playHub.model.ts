/**
 * The Play hub's Your Games (ADR-052 §4) — pure, so `PlayLanding` only lays
 * them out. A Game is a Row (ruleset §1.9): the whole Row opens the Game's
 * page in Play; its chips are your role, how many are here and the Downtime
 * state; its one door is the way into play, Mediate or Play <pilot>.
 */

/** A label-first chip on a Game's Row: `Mediator`, `3 here`, `DOWNTIME | Step 4`. */
export type HubChip = { key: string; label: string; value?: string }

/** A Game's one door, rust: where it goes and what it is called. */
export type GameDoor = { label: string; href: string; ariaLabel: string }

/**
 * A Game's chips, in order: your role in it, how many are here now (only when
 * anyone is), and the Downtime state while it runs (its step, 1-based, once it
 * has one).
 */
export function gameChips(args: {
  mediator: boolean
  here: number
  downtime: { running: boolean; stepIndex: number | null } | undefined
}): HubChip[] {
  const { mediator, here, downtime } = args
  return [
    { key: 'role', label: mediator ? 'Mediator' : 'Player' },
    ...(here > 0 ? [{ key: 'here', label: `${here} here` }] : []),
    ...(downtime?.running
      ? [
          {
            key: 'downtime',
            label: 'Downtime',
            ...(downtime.stepIndex !== null ? { value: `Step ${downtime.stepIndex + 1}` } : {}),
          },
        ]
      : []),
  ]
}

/**
 * A Game's one door: Mediate where you mediate it, else Play your first pilot
 * in it; none when you have no pilot there (its page is where you add one).
 */
export function gameDoor(
  game: { _id: string; name: string; mediator: boolean },
  pilots: readonly { id: string; name: string }[]
): GameDoor | null {
  if (game.mediator) {
    return { label: 'Mediate', href: `/play/game/${game._id}`, ariaLabel: `Mediate ${game.name}` }
  }
  const pilot = pilots[0]
  if (pilot === undefined) return null
  return {
    label: `Play ${pilot.name}`,
    href: `/play/${pilot.id}`,
    ariaLabel: `Play ${pilot.name} in ${game.name}`,
  }
}
