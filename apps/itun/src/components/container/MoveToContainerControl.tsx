/**
 * MoveToContainerControl — live-sheet affordance for moving one entity between
 * its **Shelf** and a **Game** (ADR-030 §2).
 *
 * Replaces `AssignToWorkspaceButton`. A select, with Workspaces swapped for the
 * two real containers. Moving INTO a Game is one tap; moving OUT of one — back
 * to the Shelf, or on to another Game — asks first.
 *
 * ## Why only the way out asks
 *
 * Putting a build into a Game takes nothing from anybody. Taking it out takes
 * it off a roster the rest of the table was reading, which is the destructive
 * direction, so that move goes through a confirm (words in
 * `lib/games/rowActionCopy.ts`) and only runs once the player says yes. The
 * select is controlled by the entity's real container, so a cancelled move
 * leaves it showing where the build still is.
 *
 * The confirm is the CALLER's (`confirm`, from `useConfirm`), not this
 * control's. The sheet renders this inside its ⋯ menu, which unmounts its
 * children on any outside pointerdown — and the dialog is portalled outside
 * it, so a dialog owned here would be torn down by the press that answers it.
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
import type { Container, ContainerFields } from '../../lib/container'
import { containerOf, moveTo, sameContainer } from '../../lib/container'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { parseContainer, serializeContainer } from '../../stores/activeContainerStore'
import { useEntityStore } from '../../stores/entityStore'
import { CONTAINER_MOVE } from '../../stores/surfaceProvenance'
import type { AssignableType } from '../../stores/types'
import type { Confirm } from '../shared/useConfirm'

type MoveToContainerControlProps = {
  entityType: AssignableType
  entityId: string
  /** The entity's current container fields (`gameId`, legacy `workspaceId`). */
  entity: ContainerFields & { name: string }
  /**
   * Opens the confirm a move out of a Game goes through. Owned by an
   * always-mounted ancestor — see "Why only the way out asks" above.
   */
  confirm: Confirm
  onChanged?: () => void
  className?: string
}

function ConnectedMoveToContainerControl({
  entityType,
  entityId,
  entity,
  confirm,
  onChanged,
  className,
}: MoveToContainerControlProps) {
  const games = useQuery(api.games.listMine)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = containerOf(entity)

  /** A Game's name as the reader knows it, or null when it is not one of theirs. */
  function gameName(gameId: string): string | null {
    return games?.find((game) => game._id === gameId)?.name ?? null
  }

  async function move(next: Container) {
    await useEntityStore.getState().update(entityType, entityId, moveTo(next), CONTAINER_MOVE)
    onChanged?.()
  }

  async function moveNow(next: Container) {
    setPending(true)
    setError(null)
    try {
      await move(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move this build.')
    } finally {
      setPending(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = parseContainer(e.target.value)
    if (current.kind !== 'game' || sameContainer(current, next)) {
      void moveNow(next)
      return
    }
    // Out of a Game: ask first. A failure is shown on the dialog, which
    // outlives this control, so the move runs bare here.
    confirm({
      ...ROW_ACTION_COPY.leaveGame({
        name: entity.name,
        kind: entityType,
        from: gameName(current.gameId),
        to: next.kind === 'shelf' ? next : { kind: 'game', name: gameName(next.gameId) },
      }),
      onConfirm: () => move(next),
    })
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
          onChange={handleChange}
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
