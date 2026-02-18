import type { ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay, useDetailModal } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'

type ReferenceEntityListingItemProps = {
  entity: SURefEntity
  controls?: ReferenceEntityControl[]
  disabled?: boolean
  lightweight?: boolean
  trailing?: ReactNode
}

export function ReferenceEntityListingItem({
  entity,
  controls,
  disabled,
  lightweight,
  trailing,
}: ReferenceEntityListingItemProps) {
  const detailModal = useDetailModal(entity)
  const allControls = [...(controls ?? []), detailModal.control]

  if (trailing) {
    return (
      <>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <ReferenceEntityDisplay
              data={entity}
              listing
              compact
              controls={allControls}
              disabled={disabled}
              lightweight={lightweight}
            />
          </div>
          {trailing}
        </div>
        {detailModal.modal}
      </>
    )
  }

  return (
    <>
      <ReferenceEntityDisplay
        data={entity}
        listing
        compact
        controls={allControls}
        disabled={disabled}
        lightweight={lightweight}
      />
      {detailModal.modal}
    </>
  )
}
