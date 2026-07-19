import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../card/ReferenceEntityCard'
import { useDetailModal } from './useDetailModal'

export function PatternEquipmentItem({ data }: { data: SURefEntity }) {
  const detailModal = useDetailModal(data)
  const control = { ...detailModal.control, hidden: false, cardClick: false }
  return (
    <>
      <ReferenceEntityCard data={data} compact listing controls={[control]} />
      {detailModal.modal}
    </>
  )
}
