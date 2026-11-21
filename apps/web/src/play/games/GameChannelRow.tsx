/**
 * A Game's "Discord channel" row outside Play (MD-20): on the Game's page
 * and in Game settings, where a Mediator looks for it first. The same row and
 * dialog as the Rolls pane's (`PlayChannelRow`, play.md §9): where the
 * Game's rolls post, or that none is bound and who may bind one.
 */

import { PlayChannelRow } from '../PlayChannelRow'
import { usePlayChannelBinding } from '../usePlayChannel'

export function GameChannelRow({
  gameId,
  gameName,
  mayBind,
}: {
  gameId: string
  gameName: string
  /** The viewer mediates or organises this Game (`mayBindChannel`). */
  mayBind: boolean
}) {
  const binding = usePlayChannelBinding({ gameId })
  // Nothing while unknown (loading, offline): a row that could only guess.
  if (binding === undefined) return null
  return <PlayChannelRow owner={{ kind: 'game', gameName }} binding={binding} mayBind={mayBind} />
}
