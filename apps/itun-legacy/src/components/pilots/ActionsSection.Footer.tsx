import type { ReactNode } from 'react'
import { ReferenceEntityDisplayTooltip, Text } from 'suref-react'
import { RotateCcw } from 'lucide-react'
import type { ActionDisplayData } from '../../lib/pilotActionUtils'
import { findTraitEntity } from './actionsSectionUtils'

/**
 * Build the footer message rendered below a disabled action.
 *
 * When the disabled reason mentions a missing required trait, renders a
 * tooltip-linked trait reference. When an onRefill callback is supplied,
 * renders a "Refill" button alongside the reason.
 */
export function buildFooterMessage(
  disabledReason: string,
  action: ActionDisplayData,
  onRefill?: () => void
): ReactNode {
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
          <ReferenceEntityDisplayTooltip
            schemaName={traitEntity.schemaName}
            entityId={traitEntity.id}
            openDelay={300}
          >
            {traitLabel}
          </ReferenceEntityDisplayTooltip>
        ) : (
          traitLabel
        )}
      </>
    )
  }

  if (onRefill) {
    return (
      <span className="flex items-center gap-1.5">
        {disabledReason}
        <button
          type="button"
          onClick={onRefill}
          className="inline-flex cursor-pointer items-center gap-0.5 rounded bg-su-black px-1.5 py-0.5 font-mono text-xs text-su-white transition-opacity hover:opacity-80"
          aria-label="Refill uses"
        >
          <RotateCcw className="h-3 w-3" />
          Refill
        </button>
      </span>
    )
  }

  return disabledReason
}
