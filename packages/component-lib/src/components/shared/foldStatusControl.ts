import type { ReferenceEntityControl } from '../referenceEntity/ReferenceEntityDisplay/referenceEntityControlTypes'
import type { EntityStatus } from './entityStatus'

/**
 * Fold the presentational `status` sugar into a `__status` CONTROL leading the
 * rail. This is the ONE realization of the condition badge across both card
 * shells — `DisplayCard` and `ReferenceEntityCard` both call it, so the fold
 * rule (status first, then the caller's controls) cannot drift between them.
 */
export function foldStatusControl(
  controls: ReferenceEntityControl[] | undefined,
  status: EntityStatus | undefined,
  opts?: { onClick?: () => void; subject?: string }
): ReferenceEntityControl[] {
  return status
    ? [
        {
          key: '__status',
          status: { value: status, onClick: opts?.onClick, subject: opts?.subject },
        },
        ...(controls ?? []),
      ]
    : (controls ?? [])
}
