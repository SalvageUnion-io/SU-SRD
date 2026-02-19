import { Plus } from 'lucide-react'
import { EMPTY_SLOT_CLASSES } from './emptySlotClasses'

export function EmptySlotCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="flex shrink-0 flex-col overflow-visible rounded-md">
      <button type="button" onClick={onClick} className={EMPTY_SLOT_CLASSES}>
        <Plus className="h-4 w-4" />
        <span className="font-mono text-sm font-semibold uppercase">{label}</span>
      </button>
    </div>
  )
}
