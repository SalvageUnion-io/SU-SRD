import type { CSSProperties, ReactNode } from 'react'
import { space } from '../../design/tokens'
import { EmptyState } from '../index'

/**
 * EmptyUnitSlot — an unfilled assignment on a sheet (a pilot with no assigned
 * mech, a crawler's next crew place): `EmptyState`'s stamp, as an empty sheet
 * section is (chrome.md K8), its role the headline, the create / assign CTAs
 * sharing its foot. It is a slot, not an entity, so it is no Row: a filled
 * slot is the library Row (`UnitRow`).
 */

type EmptyUnitSlotProps = {
  /** The role stamp, e.g. 'Assigned Mech'. */
  roleLabel: string
  /** Helper message, e.g. 'No mech in the bay — dock one to track it here.' */
  message: ReactNode
  /** Optional inline control (a hand-set Crawler Level stepper). */
  mock?: ReactNode
  /** Optional create/link CTAs, sharing the foot's width. */
  actions?: ReactNode
  className?: string
}

/** The CTAs' row: the stamp's column would shrink it to its content. */
const ACTIONS = {
  alignSelf: 'stretch',
  display: 'flex',
  gap: space[8],
} satisfies CSSProperties

export function EmptyUnitSlot({
  roleLabel,
  message,
  mock,
  actions,
  className,
}: EmptyUnitSlotProps) {
  return (
    <EmptyState
      className={className}
      headline={roleLabel}
      body={message}
      action={
        mock || actions ? (
          <>
            {mock}
            {actions && (
              <div className="su-empty-unit-slot__actions" style={ACTIONS}>
                {actions}
              </div>
            )}
          </>
        ) : undefined
      }
    />
  )
}
