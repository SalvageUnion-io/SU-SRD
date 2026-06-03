import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from './index'
import { SectionSeparator } from './SectionSeparator'
import { useDetailModal } from './useDetailModal'
import { cn } from '../../../utils/cn'

type ReferenceEntityIntegratedSystemsProps = {
  data: SURefEntity
  compact: boolean
  /**
   * When true, the entity's image floats, so each listing renders as its own
   * flow-root box in plain block flow — narrow beside the image, full-width once
   * below it — matching how the body text and actions wrap around the image.
   */
  wrapImageFloat?: boolean
}

export function ReferenceEntityIntegratedSystems({
  data,
  compact,
  wrapImageFloat = false,
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
      {resolved.map((system, idx) => (
        // Index-suffixed: an entity may legitimately integrate the same system
        // more than once (e.g. the Power Loader's two Rigging Arms), so the id
        // alone is not a unique key.
        <IntegratedSystemListing
          key={`${system.id}-${idx}`}
          entity={system}
          wrapImageFloat={wrapImageFloat}
        />
      ))}
    </div>
  )
}

function IntegratedSystemListing({
  entity,
  wrapImageFloat,
}: {
  entity: SURefEntity
  wrapImageFloat: boolean
}) {
  const detailModal = useDetailModal(entity)

  return (
    <div className={cn(wrapImageFloat && '[display:flow-root]')}>
      <ReferenceEntityDisplay
        hide={{ actions: true }}
        data={entity}
        compact
        listing
        controls={[{ ...detailModal.control, hidden: false, cardClick: false }]}
      />
      {detailModal.modal}
    </div>
  )
}
