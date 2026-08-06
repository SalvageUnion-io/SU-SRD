/**
 * MoveToContainerControl — live-sheet affordance for moving one entity between
 * its **Shelf** and a **Game** (ADR-030 §2).
 *
 * Replaces `AssignToWorkspaceButton`. Same shape and same friction — a select,
 * not a dialog, so a move is one tap — with Workspaces swapped for the two real
 * containers.
 *
 * ## A move is one field, and that is the whole design
 *
 * Re-stamping `gameId` in place is not a shortcut pending something better —
 * it is the model. There is **one entity**. The pilot on your shelf and that
 * same pilot in a Game are one record with one field set differently, so a move
 * changes that field and nothing else: same id, same body, same history.
 *
 * This header used to say the opposite, because ADR-030 §2 originally called a
 * cross-container move an explicit **fork** and this control was documented as
 * holding the line until a fork mutation existed. That clause was amended
 * (2026-08-06): forking guarded against a "shared pilot" that the schema makes
 * unrepresentable — `gameId` is a single nullable column, so an entity is in at
 * most one Game by construction — and it would have bought that non-protection
 * with a duplicate character to reconcile.
 *
 * So there is no missing fork mutation to add. `entities.upsertByAppId` re-homes
 * the existing server row for the same reason (`existing.gameId !== args.gameId`
 * patches the column rather than inserting), and the two halves must keep
 * agreeing: if either ever starts copying, a player ends up with two of
 * themselves and no way to tell which one the table can see.
 *
 * ## Solo renders nothing
 *
 * With no account there is only the Shelf, so there is nowhere to move to —
 * see `ContainerSwitcher` for the same branch and the reasoning behind it.
 */

import { FieldError, Select } from 'component-lib'
import { useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import type { ContainerFields } from '../../lib/container'
import { containerOf, moveTo } from '../../lib/container'
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
