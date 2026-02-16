import { useMemo, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  EntityDisplay,
  EntityDisplayTooltip,
  SectionSeparator,
  Text,
  useDetailModal,
} from 'suref-react'
import type { EntityControl } from 'suref-react'
import { Play } from 'lucide-react'
import { toast } from 'sonner'
import { extractPilotActions, getGeneralActions } from '../../lib/pilotActionUtils'
import type { ActionDisplayData } from '../../lib/pilotActionUtils'
import { ActionDisplay } from './ActionDisplay'
import {
  getActionDisabledReason,
  getPilotTraits,
  decrementActionUses,
} from '../../lib/actionUsesUtils'
import type { EntityRefRow, EntityRefUpdate, PilotRow, PilotUpdate } from '../../types/common'

type PilotActionsSectionProps = {
  refs: EntityRefRow[]
  pilot: PilotRow
  readOnly: boolean
  onUpdatePilot: (input: Partial<PilotUpdate>) => void
  onUpdateEntityRef: (refId: string, input: EntityRefUpdate) => void
}

export function PilotActionsSection({
  refs,
  pilot,
  readOnly,
  onUpdatePilot,
  onUpdateEntityRef,
}: PilotActionsSectionProps) {
  const { actions, passives } = useMemo(() => extractPilotActions(refs), [refs])
  const generalActions = useMemo(() => getGeneralActions(), [])
  const pilotTraits = useMemo(() => getPilotTraits(refs), [refs])

  const sortedActions = useMemo(
    () => sortEnabledFirst(actions, pilot, pilotTraits),
    [actions, pilot, pilotTraits]
  )
  const sortedGeneralActions = useMemo(
    () => sortEnabledFirst(generalActions, pilot, pilotTraits),
    [generalActions, pilot, pilotTraits]
  )

  const handleUseAction = useCallback(
    (action: ActionDisplayData) => {
      toast(`${pilot.callsign} used ${action.name}`, {
        style: { borderColor: action.borderColor, borderWidth: '2px' },
      })

      // Subtract AP if action has a cost
      if (action.activationCost !== null) {
        onUpdatePilot({ ap: pilot.ap - action.activationCost })
      }

      // Decrement uses if action has limited uses
      if (action.maxUses !== null && action.entityRefId) {
        const ref = refs.find((r) => r.id === action.entityRefId)
        if (ref) {
          const newMetadata = decrementActionUses(action.actionName, action.maxUses, ref.metadata)
          onUpdateEntityRef(action.entityRefId, { metadata: newMetadata })
        }
      }
    },
    [pilot.callsign, pilot.ap, refs, onUpdatePilot, onUpdateEntityRef]
  )

  if (sortedActions.length === 0 && passives.length === 0 && sortedGeneralActions.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {sortedActions.length > 0 && (
        <div>
          <SectionSeparator label="Actions" fontSize="text-sm" />
          <div className="mt-2 columns-1 gap-2 sm:columns-2 lg:columns-3">
            {sortedActions.map((action) => (
              <ActionItem
                key={action.key}
                action={action}
                pilot={pilot}
                pilotTraits={pilotTraits}
                readOnly={readOnly}
                onUse={handleUseAction}
              />
            ))}
          </div>
        </div>
      )}

      {passives.length > 0 && (
        <div>
          <SectionSeparator label="Passives" fontSize="text-sm" />
          <div className="mt-2 flex flex-col gap-2">
            {passives.map((passive) => (
              <PassiveListing key={passive.entity.id} entity={passive.entity} />
            ))}
          </div>
        </div>
      )}

      {sortedGeneralActions.length > 0 && (
        <div>
          <SectionSeparator label="General Actions" fontSize="text-sm" />
          <div className="mt-2 columns-1 gap-2 sm:columns-2 lg:columns-3">
            {sortedGeneralActions.map((action) => (
              <ActionItem
                key={action.key}
                action={action}
                pilot={pilot}
                pilotTraits={pilotTraits}
                readOnly={readOnly}
                onUse={handleUseAction}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeDisabledReason(
  action: ActionDisplayData,
  pilot: PilotRow,
  pilotTraits: Set<string>
): string | null {
  return getActionDisabledReason({
    action: {
      activationCost: action.activationCost,
      requiredTraits: action.requiredTraits,
      traits: [],
    } as never,
    pilot,
    pilotTraits,
    usesRemaining: action.usesRemaining,
    maxUses: action.maxUses,
  })
}

function sortEnabledFirst(
  actions: ActionDisplayData[],
  pilot: PilotRow,
  pilotTraits: Set<string>
): ActionDisplayData[] {
  return [...actions].sort((a, b) => {
    const aDisabled = computeDisabledReason(a, pilot, pilotTraits) !== null
    const bDisabled = computeDisabledReason(b, pilot, pilotTraits) !== null
    if (aDisabled === bDisabled) return 0
    return aDisabled ? 1 : -1
  })
}

function findTraitEntity(
  traitName: string
): { id: string; schemaName: SURefEnumSchemaName } | null {
  const entity = SalvageUnionReference.findIn(
    'traits',
    (t) => t.name.toLowerCase() === traitName.toLowerCase()
  )
  return entity ? { id: entity.id, schemaName: 'traits' as SURefEnumSchemaName } : null
}

function buildFooterMessage(disabledReason: string, action: ActionDisplayData): ReactNode {
  const missingTrait = action.requiredTraits.find((trait) =>
    disabledReason.toLowerCase().includes(trait.toLowerCase())
  )

  if (missingTrait) {
    const traitEntity = findTraitEntity(missingTrait)
    const displayName = missingTrait.charAt(0).toUpperCase() + missingTrait.slice(1)
    const traitLabel = (
      <Text variant="pseudoheader" as="span" className="text-xs uppercase">
        {displayName}
      </Text>
    )

    return (
      <>
        Requires Trait:{' '}
        {traitEntity ? (
          <EntityDisplayTooltip
            schemaName={traitEntity.schemaName}
            entityId={traitEntity.id}
            openDelay={300}
          >
            {traitLabel}
          </EntityDisplayTooltip>
        ) : (
          traitLabel
        )}
      </>
    )
  }

  return disabledReason
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type ActionItemProps = {
  action: ActionDisplayData
  pilot: PilotRow
  pilotTraits: Set<string>
  readOnly: boolean
  onUse: (action: ActionDisplayData) => void
}

function ActionItem({ action, pilot, pilotTraits, readOnly, onUse }: ActionItemProps) {
  const disabledReason = computeDisabledReason(action, pilot, pilotTraits)

  const controls: EntityControl[] = []
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

  const footerMessage = disabledReason ? buildFooterMessage(disabledReason, action) : undefined

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

function PassiveListing({ entity }: { entity: SURefEntity }) {
  const detailModal = useDetailModal(entity)

  return (
    <>
      <EntityDisplay data={entity} listing compact controls={[detailModal.control]} />
      {detailModal.modal}
    </>
  )
}
