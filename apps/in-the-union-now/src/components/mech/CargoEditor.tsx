/**
 * CargoEditor — add/remove cargo items (custom only for Wave 3).
 *
 * Wave 3 supports custom cargo items (name + slot count). Reference-linked
 * cargo resolution is available in the rules layer but ref-lookup UI is
 * deferred to Wave 4 (sheet view). The CargoEditor here is for the creation
 * flow — players name their own items.
 */
import { useState } from 'react'
import type { CargoItem } from '../../lib/rules/types'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

type CargoEditorProps = {
  items: CargoItem[]
  onChange: (items: CargoItem[]) => void
  className?: string
}

export function CargoEditor({ items, onChange, className }: CargoEditorProps) {
  const [newName, setNewName] = useState('')
  const [newSlots, setNewSlots] = useState(1)

  function addItem() {
    const trimmed = newName.trim()
    if (!trimmed) return
    const newItem: CargoItem = {
      kind: 'custom',
      name: trimmed,
      slotCount: newSlots,
    }
    onChange([...items, newItem])
    setNewName('')
    setNewSlots(1)
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <h3 className="text-sm font-semibold">Cargo</h3>

      {/* Existing items */}
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No cargo items added.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item, i) => (
            <li
              key={i}
              data-testid="cargo-item"
              className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm"
            >
              <span>
                {item.kind === 'custom' ? item.name : item.ref}
                <span className="ml-1 text-muted-foreground text-xs">
                  ×{item.kind === 'custom' ? item.slotCount : (item.slotCount ?? 1)} slot
                  {(item.kind === 'custom' ? item.slotCount : (item.slotCount ?? 1)) !== 1
                    ? 's'
                    : ''}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${item.kind === 'custom' ? item.name : item.ref}`}
                onClick={() => removeItem(i)}
                className="h-6 px-2 text-destructive hover:text-destructive"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Add new item form */}
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1 flex-1">
          <label htmlFor="cargo-name" className="text-xs text-muted-foreground">
            Item name
          </label>
          <input
            id="cargo-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Item name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addItem()
              }
            }}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1 w-20">
          <label htmlFor="cargo-slots" className="text-xs text-muted-foreground">
            Slots
          </label>
          <input
            id="cargo-slots"
            type="number"
            min={1}
            value={newSlots}
            onChange={(e) => setNewSlots(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button type="button" onClick={addItem} size="sm" aria-label="Add cargo item">
          Add
        </Button>
      </div>
    </div>
  )
}
