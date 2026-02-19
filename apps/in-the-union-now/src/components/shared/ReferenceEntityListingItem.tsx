import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay, useDetailModal } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'

type ReferenceEntityListingItemProps = {
  entity: SURefEntity
  controls?: ReferenceEntityControl[]
  disabled?: boolean
  damaged?: boolean
  lightweight?: boolean
  /** Show a visible detail button instead of making the whole card clickable */
  showDetailButton?: boolean
}

export function ReferenceEntityListingItem({
  entity,
  controls,
  disabled,
  damaged,
  lightweight,
  showDetailButton,
}: ReferenceEntityListingItemProps) {
  const detailModal = useDetailModal(entity)
  const detailControl = showDetailButton
    ? { ...detailModal.control, hidden: false, cardClick: false }
    : detailModal.control
  const allControls = [...(controls ?? []), detailControl]

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
