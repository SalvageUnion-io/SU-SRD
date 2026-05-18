import { memo, useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { deleteControl } from 'suref-react'
import { ReferenceEntityListingItem } from '../shared/ReferenceEntityListingItem'
import { CustomStorageItem } from './CustomStorageItem'
import type { CargoRow } from '../../types/common'

type EntityStorageItemProps = {
  item: CargoRow
  onDelete?: () => void
}

/** Renders a cargo item that has a schema reference — uses ReferenceEntityListingItem */
export const EntityStorageItem = memo(function EntityStorageItem({
  item,
  onDelete,
}: EntityStorageItemProps) {
  const entity = useMemo(
    () =>
      item.schema_name && item.schema_ref_id
        ? SalvageUnionReference.get(
            item.schema_name as Parameters<typeof SalvageUnionReference.get>[0],
            item.schema_ref_id
          )
        : undefined,
    [item.schema_name, item.schema_ref_id]
  )

  if (!entity) {
    return <CustomStorageItem item={item} onDelete={onDelete} />
  }

  return (
    <ReferenceEntityListingItem
      entity={entity as SURefEntity}
      lightweight
      controls={onDelete ? [deleteControl(onDelete)] : undefined}
    />
  )
})
