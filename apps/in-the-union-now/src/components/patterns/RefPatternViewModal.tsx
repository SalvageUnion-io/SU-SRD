import { useMemo } from 'react'
import { findChassisById } from '../../lib/entityHelpers'
import type { SURefChassis, SURefObjectPattern } from 'salvageunion-reference'
import { ReferenceEntityDisplay, useChassisPatternConfig } from 'suref-react'
import type { PatternOverrideData } from 'suref-react'
import { ModalShell } from '../shared/ModalShell'

type RefPatternViewModalProps = {
  refPatternId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RefPatternViewModal({ refPatternId, open, onOpenChange }: RefPatternViewModalProps) {
  const resolved = useMemo(() => {
    const separatorIndex = refPatternId.indexOf('::')
    if (separatorIndex === -1) return null

    const chassisRef = refPatternId.slice(0, separatorIndex)
    const patternName = refPatternId.slice(separatorIndex + 2)

    const chassis = findChassisById(chassisRef)
    const pattern = chassis?.patterns?.find((p) => p.name === patternName)
    if (!chassis || !pattern) return null

    return { chassis, pattern }
  }, [refPatternId])

  if (!resolved) return null

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={resolved.pattern.name}
      subtitle={`${resolved.chassis.name} Reference Pattern`}
    >
      <div className="bg-su-white p-3">
        <RefPatternContent chassis={resolved.chassis} pattern={resolved.pattern} />
      </div>
    </ModalShell>
  )
}

function RefPatternContent({ chassis, pattern }: { chassis: SURefChassis; pattern: SURefObjectPattern }) {
  const patternOverride: PatternOverrideData = useMemo(
    () => ({ name: pattern.name, systems: pattern.systems, modules: pattern.modules }),
    [pattern.name, pattern.systems, pattern.modules]
  )
  const patternConfig = useChassisPatternConfig(chassis, patternOverride, false)

  return (
    <ReferenceEntityDisplay
      data={chassis}
      hide={{ patterns: true, content: true }}
      titleOverride={patternConfig?.titleOverride}
      subtitleExtra={patternConfig?.subtitleExtra}
      statsOverride={patternConfig?.statsOverride}
      primaryStatsOnly={patternConfig?.primaryStatsOnly}
      abilitiesSection={patternConfig?.abilitiesSection}
    />
  )
}
