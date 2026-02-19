import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from './index'
import { SectionSeparator } from './SectionSeparator'
import { useDetailModal } from './useDetailModal'
import { cn } from '../../../utils/cn'

type ReferenceEntityIntegratedSystemsProps = {
  data: SURefEntity
  compact: boolean
}

export function ReferenceEntityIntegratedSystems({
  data,
  compact,
}: ReferenceEntityIntegratedSystemsProps) {
  if (!('systems' in data) || !Array.isArray(data.systems)) return null

  const systemNames = data.systems as string[]
  if (systemNames.length === 0) return null

  const resolved = systemNames
    .map((name) => SalvageUnionReference.Systems.find((s) => s.name === name))
    .filter((s): s is NonNullable<typeof s> => s != null)

  if (resolved.length === 0) return null

  return (
    <div className={cn(compact ? 'space-y-1.5' : 'space-y-2')}>
      <SectionSeparator label="Integrated Systems" compact={compact} />
      {resolved.map((system) => (
        <IntegratedSystemListing key={system.id} entity={system} />
      ))}
    </div>
  )
}

function IntegratedSystemListing({ entity }: { entity: SURefEntity }) {
  const detailModal = useDetailModal(entity)

  return (
    <>
      <ReferenceEntityDisplay
        hide={{ actions: true }}
        data={entity}
        compact
        listing
        controls={[{ ...detailModal.control, hidden: false, cardClick: false }]}
      />
      {detailModal.modal}
    </>
  )
}
