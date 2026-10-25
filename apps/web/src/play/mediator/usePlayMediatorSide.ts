/**
 * usePlayMediatorSide — what the Mediator's side sections share (play.md
 * §10): `useSideFeed`, as the player's side has it, with the Post toggle
 * private by default and the Game's log left out of the roll dispatch (the
 * log is the crew's; the Opposition reaches them only through what is
 * posted). Nothing awaits the Mediator's answer, so no proposal is on its
 * Feed.
 *
 * Called once per screen, by `PlayMediatorCockpit`, so the dispatch runs
 * exactly once whichever pane is open.
 */

import type { PlayBinding } from '../channels.model'
import { mediatorTarget } from '../play.model'
import type { SideFeed } from '../usePlaySide'
import { useSideFeed } from '../usePlaySide'
import type { PlayMediator } from './usePlayMediator'

export function usePlayMediatorSide(
  mediator: PlayMediator,
  binding: PlayBinding | null | undefined
): SideFeed {
  return useSideFeed({
    target: mediatorTarget(mediator.gameId),
    rollerName: 'Mediator',
    binding,
    log: false,
    rolls: mediator.rolls,
    alerts: mediator.alerts,
    proposals: [],
  })
}
