import { useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { EntitySchemaName, SURefEntity } from 'salvageunion-reference'
import { EntityDisplay, SectionSeparator, useDetailModal } from 'suref-react'
import type { EntityRefRow } from '../../types/common'

type PilotEntityRefsProps = {
  refs: EntityRefRow[]
}

export function PilotEntityRefs({ refs }: PilotEntityRefsProps) {
  const abilityRefs = useMemo(() => refs.filter((r) => r.schema_name === 'abilities'), [refs])
  const equipmentRefs = useMemo(() => refs.filter((r) => r.schema_name === 'equipment'), [refs])

  return (
    <div className="space-y-3">
      {abilityRefs.length > 0 && (
        <div>
          <SectionSeparator label="Abilities" fontSize="text-sm" />
          <div className="mt-2 flex flex-col gap-2">
            {abilityRefs.map((ref) => {
              const entity = SalvageUnionReference.get(
                ref.schema_name as EntitySchemaName,
                ref.schema_ref_id
              )
              if (!entity) return null
              return <PilotEntityRefListing key={ref.id} entity={entity as SURefEntity} />
            })}
          </div>
        </div>
      )}

      {equipmentRefs.length > 0 && (
        <div>
          <SectionSeparator label="Equipment" fontSize="text-sm" />
          <div className="mt-2 flex flex-col gap-2">
            {equipmentRefs.map((ref) => {
              const entity = SalvageUnionReference.get(
                ref.schema_name as EntitySchemaName,
                ref.schema_ref_id
              )
              if (!entity) return null
              return <PilotEntityRefListing key={ref.id} entity={entity as SURefEntity} />
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function PilotEntityRefListing({ entity }: { entity: SURefEntity }) {
  const detailModal = useDetailModal(entity)

  return (
    <>
      <EntityDisplay data={entity} listing compact controls={[detailModal.control]} />
      {detailModal.modal}
    </>
  )
}
