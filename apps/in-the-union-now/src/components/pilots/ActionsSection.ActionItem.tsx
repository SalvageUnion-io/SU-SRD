import type { ReferenceEntityControl } from 'suref-react'
import { ActionDisplay } from './ActionDisplay'
import { buildFooterMessage } from './ActionsSection.Footer'
import { computeDisabledReason } from './actionsSectionUtils'
import { getUseButtonLabel } from '../../lib/heatUtils'
import type { ActionDisplayData } from '../../lib/pilotActionUtils'
import type { EntityRefRow, MechRow, PilotRow } from '../../types/common'

type ComradeEpGetter = (entityId: string, maxEp: number) => number

export type ActionItemProps = {
  action: ActionDisplayData
  pilot: PilotRow
  mech?: MechRow | null
  mechId?: string
  mechRefs?: EntityRefRow[]
  pilotSourceTraits: Set<string>
  mechSourceTraits: Set<string>
  readOnly: boolean
  isBoarded: boolean
  filteredOut?: boolean
  comradeEpGetter?: ComradeEpGetter
  onUsePilot: (action: ActionDisplayData) => void
  onUseMech: (action: ActionDisplayData) => void
  onUseComrade: (action: ActionDisplayData) => void
  onRefill: (action: ActionDisplayData) => void
}

/**
 * Render a single action card with its controls and disabled-state footer.
 *
 * Dispatches to the correct use-handler based on action source:
 * - comrade-ep cost -> onUseComrade
 * - mech source (non-comrade) -> onUseMech
 * - everything else -> onUsePilot
 */
export function ActionItem({
  action,
  pilot,
  mech,
  mechId,
  mechRefs,
  pilotSourceTraits,
  mechSourceTraits,
  readOnly,
  isBoarded,
  filteredOut,
  comradeEpGetter,
  onUsePilot,
  onUseMech,
  onUseComrade,
  onRefill,
}: ActionItemProps) {
  const isComradeAction = action.costType === 'comrade-ep'
  const isMechAction = action.source === 'mech' && !isComradeAction
  const mechUnboarded = isMechAction && !isBoarded

  const disabledReason = mechUnboarded
    ? 'Embark your mech to use'
    : computeDisabledReason(
        action,
        pilot,
        mech,
        pilotSourceTraits,
        mechSourceTraits,
        comradeEpGetter
      )

  const isDisabled = !!disabledReason || !!filteredOut

  const controls: ReferenceEntityControl[] = []
  const isPassive = action.actionType === 'Passive'
  const passiveWithUses = isPassive && (action.maxUses !== null || action.destroyOnUse)
  const useLabel = getUseButtonLabel(
    action.sourceEntity as {
      traits?: Array<{ type: string; amount?: number | string }>
      [key: string]: unknown
    }
  )
  if (!readOnly && !mechUnboarded && !filteredOut && (!isPassive || passiveWithUses)) {
    controls.push({
      key: 'use',
      label: useLabel,
      ariaLabel: 'Use action',
      variant: 'primary',
      disabled: !!disabledReason,
      onClick: () => {
        if (isComradeAction) {
          onUseComrade(action)
        } else if (isMechAction) {
          onUseMech(action)
        } else {
          onUsePilot(action)
        }
      },
    })
  }

  const canRefill =
    !readOnly &&
    !mechUnboarded &&
    !filteredOut &&
    disabledReason === 'Out of uses' &&
    action.entityRefId &&
    action.maxUses !== null

  const footerMessage = disabledReason
    ? buildFooterMessage(disabledReason, action, canRefill ? () => onRefill(action) : undefined)
    : undefined

  return (
    <ActionDisplay
      data={action}
      controls={controls}
      disabled={isDisabled}
      footerMessage={footerMessage}
      mechId={mechId}
      mechRefs={mechRefs}
    />
  )
}
