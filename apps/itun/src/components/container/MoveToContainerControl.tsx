/**
 * MoveToContainerControl — live-sheet affordance for moving one entity between
 * its **Shelf** and a **Game** (ADR-030 §2).
 *
 * Replaces `AssignToWorkspaceButton`. Same shape and same friction — a select,
 * not a dialog, so a move is one tap — with Workspaces swapped for the two real
 * containers.
 *
 * ## What this does NOT do
 *
 * ADR-030 says a cross-container move is an explicit **fork**, and no fork
 * mutation exists yet (`convex/entities.ts` has create/update/claimLocal, not
 * fork). So this keeps exactly the semantics of the control it replaces: it
 * re-stamps the local record's container in place. Turning that into a fork is
 * a separate change with its own server surface, not something to smuggle in
 * behind a rename.
 *
 * ## Solo renders nothing
 *
 * With no account there is only the Shelf, so there is nowhere to move to —
 * see `ContainerSwitcher` for the same branch and the reasoning behind it.
 */

import { useState } from 'react'
import { FieldError, Select } from 'component-lib'
import { useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { containerOf, moveTo } from '../../lib/container'
import type { ContainerFields } from '../../lib/container'
import { parseContainer, serializeContainer } from '../../stores/activeContainerStore'
import { useEntityStore } from '../../stores/entityStore'
import { CONTAINER_MOVE } from '../../stores/surfaceProvenance'
import type { AssignableType } from '../../stores/types'

type MoveToContainerControlProps = {
  entityType: AssignableType
  entityId: string
  /** The entity's current container fields (`gameId`, legacy `workspaceId`). */
  entity: ContainerFields
  onChanged?: () => void
  className?: string
}

function ConnectedMoveToContainerControl({
  entityType,
  entityId,
  entity,
  onChanged,
  className,
}: MoveToContainerControlProps) {
  const games = useQuery(api.games.listMine)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = containerOf(entity)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = parseContainer(e.target.value)
    setPending(true)
    setError(null)
    try {
      await useEntityStore.getState().update(entityType, entityId, moveTo(next), CONTAINER_MOVE)
      onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move this build.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <label htmlFor={`container-move-${entityId}`} className="text-sm font-medium text-wk-muted">
          In:
        </label>
        <Select
          id={`container-move-${entityId}`}
          value={serializeContainer(current)}
          onChange={(e) => void handleChange(e)}
          disabled={pending}
          className="w-auto disabled:opacity-50 sm:min-h-9"
          aria-label="Move to Game or Shelf"
        >
          <option value="shelf">Shelf</option>
          {games !== undefined && games.length > 0 && (
            <optgroup label="Games">
              {games.map((game) => (
                <option key={game._id} value={`game:${game._id}`}>
                  {game.name}
                </option>
              ))}
            </optgroup>
          )}
          {/* A record left in a container that is not among the user's Games —
              a v13 phantom id, or a Game they have since left — would otherwise
              select nothing and read as "on the Shelf", which is a lie about
              where it lives. Surface it as its own option instead. */}
          {current.kind === 'game' &&
            games !== undefined &&
            !games.some((game) => game._id === current.gameId) && (
              <option value={serializeContainer(current)}>Unknown game</option>
            )}
        </Select>
      </div>
      {error && <FieldError className="mt-1">{error}</FieldError>}
    </div>
  )
}

export function MoveToContainerControl(props: MoveToContainerControlProps) {
  const { mode } = useConnection()
  if (mode !== 'connected') return null
  return <ConnectedMoveToContainerControl {...props} />
}
