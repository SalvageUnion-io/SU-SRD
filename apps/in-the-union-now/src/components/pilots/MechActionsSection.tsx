import { useMemo, useCallback } from 'react'
import { SectionSeparator } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'
import { Play } from 'lucide-react'
import { toast } from 'sonner'
import { extractMechActions } from '../../lib/pilotActionUtils'
import type { ActionDisplayData } from '../../lib/pilotActionUtils'
import { ActionDisplay } from './ActionDisplay'
import { getMechActionDisabledReason, decrementActionUses } from '../../lib/actionUsesUtils'
import type { EntityRefRow, EntityRefUpdate, MechRow, MechUpdate } from '../../types/common'

type MechActionsSectionProps = {
  mechRefs: EntityRefRow[]
  mech: MechRow
  readOnly: boolean
  onUpdateMech: (input: Partial<MechUpdate>) => void
  onUpdateMechEntityRef: (refId: string, input: EntityRefUpdate) => void
}

export function MechActionsSection({
  mechRefs,
  mech,
  readOnly,
  onUpdateMech,
  onUpdateMechEntityRef,
}: MechActionsSectionProps) {
  const actions = useMemo(() => extractMechActions(mechRefs), [mechRefs])

  const sortedActions = useMemo(() => sortEnabledFirst(actions, mech), [actions, mech])

  const handleUseAction = useCallback(
    (action: ActionDisplayData) => {
      toast(`Used ${action.name}`, {
        style: { borderColor: action.borderColor, borderWidth: '2px' },
      })

      // Subtract EP if action has a cost
      if (action.activationCost !== null) {
        onUpdateMech({ current_ep: mech.current_ep - action.activationCost })
      }

      // Decrement uses if action has limited uses
      if (action.maxUses !== null && action.entityRefId) {
        const ref = mechRefs.find((r) => r.id === action.entityRefId)
        if (ref) {
          const newMetadata = decrementActionUses(action.actionName, action.maxUses, ref.metadata)
          onUpdateMechEntityRef(action.entityRefId, { metadata: newMetadata })
        }
      }
    },
    [mech.current_ep, mechRefs, onUpdateMech, onUpdateMechEntityRef]
  )

  if (sortedActions.length === 0) return null

  return (
    <div>
      <SectionSeparator label="Mech Actions" fontSize="text-sm" />
      <div className="mt-2 columns-1 gap-2 sm:columns-2 lg:columns-3">
        {sortedActions.map((action) => (
          <MechActionItem
            key={action.key}
            action={action}
            mech={mech}
            readOnly={readOnly}
            onUse={handleUseAction}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeDisabledReason(action: ActionDisplayData, mech: MechRow): string | null {
  return getMechActionDisabledReason({
    action: {
      activationCost: action.activationCost,
      traits: [],
    } as never,
    mech,
    usesRemaining: action.usesRemaining,
    maxUses: action.maxUses,
  })
}

function sortEnabledFirst(actions: ActionDisplayData[], mech: MechRow): ActionDisplayData[] {
  return [...actions].sort((a, b) => {
    const aDisabled = computeDisabledReason(a, mech) !== null
    const bDisabled = computeDisabledReason(b, mech) !== null
    if (aDisabled === bDisabled) return 0
    return aDisabled ? 1 : -1
  })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type MechActionItemProps = {
  action: ActionDisplayData
  mech: MechRow
  readOnly: boolean
  onUse: (action: ActionDisplayData) => void
}

function MechActionItem({ action, mech, readOnly, onUse }: MechActionItemProps) {
  const disabledReason = computeDisabledReason(action, mech)

  const controls: ReferenceEntityControl[] = []
  if (!readOnly) {
    controls.push({
      key: 'use',
      icon: Play,
      label: 'Use',
      ariaLabel: 'Use action',
      variant: disabledReason ? 'ghost' : 'primary',
      className: disabledReason ? 'cursor-not-allowed opacity-30' : undefined,
      onClick: () => {
        if (!disabledReason) onUse(action)
      },
    })
  }

  const footerMessage = disabledReason ?? undefined

  return (
    <div className="mb-2 break-inside-avoid">
      <ActionDisplay
        data={action}
        controls={controls}
        disabled={!!disabledReason}
        footerMessage={footerMessage}
      />
    </div>
  )
}
