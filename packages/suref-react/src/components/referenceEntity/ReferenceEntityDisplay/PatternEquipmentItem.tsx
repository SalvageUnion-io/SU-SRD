import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from './index'
import { useDetailModal } from './useDetailModal'

export function PatternEquipmentItem({ data }: { data: SURefEntity }) {
  const detailModal = useDetailModal(data)
  const control = { ...detailModal.control, hidden: false, cardClick: false }
  return (
    <>
      <ReferenceEntityDisplay data={data} compact listing controls={[control]} />
      {detailModal.modal}
    </>
  )
}
