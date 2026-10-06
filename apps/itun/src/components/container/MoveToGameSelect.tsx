/**
 * MoveToGameSelect — "Move to game…" on a My stuff row (ADR-030 §2, ADR-037).
 *
 * The row-sized twin of the live sheet's `MoveToContainerControl`, for the one
 * direction a My stuff row needs: into a Game. It lists only what the server
 * would accept, from the same mirror (`moveDestinations`): a pilot or mech may
 * go into any Game the player belongs to; a crawler only into a Game they run.
 * With nowhere to go it renders nothing, rather than a select of one.
 *
 * ## No confirm, by the same rule as the sheet's control
 *
 * Moving into a Game takes nothing from anybody — the move that asks first is
 * the one OUT of a Game, which is "Remove from game" on the Game's own rows. A
 * move is one field (`gameId`) on the same record, so the row simply leaves My
 * stuff, and a toast says where it went.
 *
 * ## Connected only
 *
 * Games need the server of record, so — like `ContainerSwitcher` — the Convex
 * read lives in a child mounted only once the mode is Connected.
 */

import { Select, toast, tokens } from 'component-lib'
import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import type { Container, ContainerFields } from '../../lib/container'
import { containerOf, moveTo, sameContainer } from '../../lib/container'
import { moveDestinations } from '../../lib/games/gameRoster'
import { parseContainer, serializeContainer } from '../../stores/activeContainerStore'
import { useEntityStore } from '../../stores/entityStore'
import { CONTAINER_MOVE } from '../../stores/surfaceProvenance'
import type { AssignableType } from '../../stores/types'
import { failureMessage } from '../shared/useConfirm'

type MoveToGameSelectProps = {
  entityType: AssignableType
  entityId: string
  entity: ContainerFields & { name: string }
}

/** The placeholder's value: "no move chosen". Never a real container. */
const NONE = ''

// The row's controls are `mini` buttons, so the select takes their height and
// type rather than the 44px form-field default; static geometry only, so it
// sits inline (the focus ring stays the Select's own class).
const SELECT = {
  fontSize: tokens.fontSize.xs,
  minHeight: 0,
  padding: `3px ${tokens.space[8]}`,
  width: 'auto',
} satisfies CSSProperties

function ConnectedMoveToGameSelect({ entityType, entityId, entity }: MoveToGameSelectProps) {
  const games = useQuery(api.games.listMine)
  const [pending, setPending] = useState(false)

  const current = containerOf(entity)
  // The first destination is always where it is now; the rest are the moves.
  const targets = moveDestinations({ kind: entityType, current, games: games ?? [] }).filter(
    (d) => d.container.kind === 'game' && !sameContainer(d.container, current)
  )
  if (targets.length === 0) return null

  async function move(next: Container, label: string) {
    setPending(true)
    try {
      await useEntityStore.getState().update(entityType, entityId, moveTo(next), CONTAINER_MOVE)
      toast.success(`Moved ${entity.name} to ${label}.`)
    } catch (err) {
      toast.error(failureMessage(err, `${entity.name} could not be moved. Try again.`))
    } finally {
      setPending(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    const target = targets.find((d) => serializeContainer(d.container) === value)
    if (target === undefined) return
    void move(parseContainer(value), target.label)
  }

  return (
    <Select
      value={NONE}
      onChange={handleChange}
      disabled={pending}
      aria-label={`Move ${entity.name} to a game`}
      style={SELECT}
    >
      <option value={NONE} disabled>
        {pending ? 'Moving…' : 'Move to game…'}
      </option>
      {targets.map((d) => (
        <option key={serializeContainer(d.container)} value={serializeContainer(d.container)}>
          {d.label}
        </option>
      ))}
    </Select>
  )
}

export function MoveToGameSelect(props: MoveToGameSelectProps) {
  const { mode } = useConnection()
  if (mode !== 'connected') return null
  return <ConnectedMoveToGameSelect {...props} />
}
