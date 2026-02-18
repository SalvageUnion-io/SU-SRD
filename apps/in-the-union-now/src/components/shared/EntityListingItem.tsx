import type { ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { EntityDisplay, useDetailModal } from 'suref-react'
import type { EntityControl } from 'suref-react'

type EntityListingItemProps = {
  entity: SURefEntity
  controls?: EntityControl[]
  disabled?: boolean
  lightweight?: boolean
  trailing?: ReactNode
}

export function EntityListingItem({
  entity,
  controls,
  disabled,
  lightweight,
  trailing,
}: EntityListingItemProps) {
  const detailModal = useDetailModal(entity)
  const allControls = [...(controls ?? []), detailModal.control]

  if (trailing) {
    return (
      <>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <EntityDisplay
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
      <EntityDisplay
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
