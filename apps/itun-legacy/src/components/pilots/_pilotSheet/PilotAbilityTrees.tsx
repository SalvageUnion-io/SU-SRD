import { useMemo } from 'react'
import { ClassAbilityTreeDisplay } from 'suref-react'
import type { EntityRefRow } from '../../../types/common'
import type { SURefClass } from 'salvageunion-reference'

type PilotAbilityTreesProps = {
  pilotClass: SURefClass
  pilotRefs: EntityRefRow[]
}

export function PilotAbilityTrees({ pilotClass, pilotRefs }: PilotAbilityTreesProps) {
  const activeAbilityIds = useMemo(
    () =>
      new Set(pilotRefs.filter((r) => r.schema_name === 'abilities').map((r) => r.schema_ref_id)),
    [pilotRefs]
  )

  return <ClassAbilityTreeDisplay classEntity={pilotClass} activeAbilityIds={activeAbilityIds} />
}
