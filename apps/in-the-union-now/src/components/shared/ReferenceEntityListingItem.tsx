import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay, useDetailModal } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'

type ReferenceEntityListingItemProps = {
  entity: SURefEntity
  controls?: ReferenceEntityControl[]
  disabled?: boolean
  damaged?: boolean
  lightweight?: boolean
}

export function ReferenceEntityListingItem({
  entity,
  controls,
  disabled,
  damaged,
  lightweight,
}: ReferenceEntityListingItemProps) {
  const detailModal = useDetailModal(entity)
  const allControls = [...(controls ?? []), detailModal.control]

  return (
    <>
      <ReferenceEntityDisplay
        data={entity}
        listing
        compact
        controls={allControls}
        disabled={disabled}
        damaged={damaged}
        lightweight={lightweight}
      />
      {detailModal.modal}
    </>
  )
}
