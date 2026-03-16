import { useState, useCallback } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { EntitySchemaName } from 'salvageunion-reference'
import { Text } from 'suref-react'
import { Button } from '../ui/button'
import { selectRandomTarget, filterDamageableRefs } from '../../lib/damageUtils'
import type { EntityRefRow } from '../../types/common'

type TargetPickerProps = {
  mechRefs: EntityRefRow[]
  /** Called when the player confirms a target (manual or random) */
  onConfirm: (targetRef: EntityRefRow) => void
  /** Called when the player cancels without selecting a target */
  onCancel: () => void
  isPending?: boolean
}

/**
 * TargetPicker — lets the player select or randomize a Critical Damage target.
 *
 * Shown when SP reaches 0, per the Critical Damage Table flow (ADR-003, ADR-008).
 * The player always makes this choice — never the Mediator, never automated.
 */
export function TargetPicker({ mechRefs, onConfirm, onCancel, isPending }: TargetPickerProps) {
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null)

  const damageableRefs = filterDamageableRefs(mechRefs)

  const handleRandom = useCallback(() => {
    const target = selectRandomTarget(damageableRefs)
    if (target) {
      setSelectedRefId(target.id)
    }
  }, [damageableRefs])

  const handleConfirm = useCallback(() => {
    const target = damageableRefs.find((r) => r.id === selectedRefId)
    if (!target) return
    onConfirm(target)
  }, [damageableRefs, selectedRefId, onConfirm])

  if (damageableRefs.length === 0) {
    return (
      <div className="space-y-3">
        <Text as="p" className="text-sm text-su-black/70">
          No systems or modules available to target.
        </Text>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Text as="p" className="text-sm font-semibold text-su-black">
        SP reached 0 — Critical Damage! Select a target:
      </Text>

      {/* Equipment list */}
      <div className="space-y-1" role="listbox" aria-label="Select damage target">
        {damageableRefs.map((ref) => {
          const entity = SalvageUnionReference.get(
            ref.schema_name as EntitySchemaName,
            ref.schema_ref_id
          )
          const displayName = entity?.name ?? ref.schema_ref_id
          const isSelected = selectedRefId === ref.id

          return (
            <button
              key={ref.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => setSelectedRefId(ref.id)}
              className={`w-full cursor-pointer rounded border px-3 py-2 text-left font-mono text-sm transition-colors ${
                isSelected
                  ? 'border-su-rust bg-su-rust/10 font-semibold text-su-black'
                  : 'border-su-black/20 bg-su-white hover:border-su-black/40 hover:bg-su-black/5 text-su-black'
              }`}
            >
              <span className="block">{displayName}</span>
              <span className="block text-xs text-su-black/50 capitalize">
                {ref.condition} {ref.schema_name === 'systems' ? 'System' : 'Module'}
              </span>
            </button>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRandom}
          disabled={isPending}
        >
          Random
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={!selectedRefId || isPending}
          >
            {isPending ? 'Applying...' : 'Apply Damage'}
          </Button>
        </div>
      </div>
    </div>
  )
}
