import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { findChassisById } from '../../lib/entityHelpers'
import { ReferenceEntityDisplay, navigateControl, useChassisPatternConfig } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'
import { MechBuilder } from './MechBuilder'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { patternToBuilderState } from '../../lib/builderUtils'
import type { PatternEditConfig } from '../../hooks/usePatternSheet'
import type { TypedPatternRow } from '../../types/common'

type PlayerPatternDisplayProps = {
  pattern: TypedPatternRow
  listing?: boolean
  compact?: boolean
  controls?: ReferenceEntityControl[]
  editConfig?: PatternEditConfig
}

export function PlayerPatternDisplay({
  pattern,
  listing = true,
  compact = true,
  controls: controlsProp,
  editConfig,
}: PlayerPatternDisplayProps) {
  const navigate = useNavigate()
  const [showDelete, setShowDelete] = useState(false)

  const chassis = useMemo(() => findChassisById(pattern.chassis_ref), [pattern.chassis_ref])

  const patternOverride = useMemo(
    () => ({ name: pattern.name, systems: [] as [], modules: [] as [] }),
    [pattern.name]
  )

  const patternConfig = useChassisPatternConfig(chassis!, patternOverride, true)

  const handleNavigate = useCallback(() => {
    navigate({ to: '/patterns/$patternId', params: { patternId: pattern.id } })
  }, [navigate, pattern.id])

  const defaultControls = useMemo(() => [navigateControl(handleNavigate)], [handleNavigate])
  const controls = controlsProp ?? (listing ? defaultControls : undefined)

  if (!chassis) return null

  // --- LISTING MODE ---
  if (listing) {
    return (
      <ReferenceEntityDisplay
        data={chassis}
        listing={listing}
        compact={compact}
        titleOverride={patternConfig?.titleOverride}
        subtitleExtra={patternConfig?.subtitleExtra}
        statsOverride={patternConfig?.statsOverride}
        primaryStatsOnly={patternConfig?.primaryStatsOnly}
        controls={controls}
      />
    )
  }

  // --- SHEET MODE ---
  if (!editConfig?.canEdit) {
    return (
      <div className="flex flex-col gap-4">
        <MechBuilder initialState={patternToBuilderState(pattern)} readOnly />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <MechBuilder
        initialState={patternToBuilderState(pattern)}
        onChange={editConfig.onBuilderChange}
        saveStatus={editConfig.saveStatus}
        onDelete={() => setShowDelete(true)}
        onCopy={editConfig.onCopy}
        isDeleting={editConfig.isDeleting}
        isCopying={editConfig.isCopying}
      />
      <DeleteConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        entityType="Pattern"
        entityName={pattern.name}
        onConfirm={editConfig.onDelete}
        isDeleting={editConfig.isDeleting}
      />
    </div>
  )
}
