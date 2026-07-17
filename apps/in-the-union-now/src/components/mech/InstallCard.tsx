import type { SURefEntity } from 'salvageunion-reference'
import { MiniBtn, ReferenceEntityDisplay } from 'component-lib'
import { cn } from '../../lib/utils'

type InstallCardProps = {
  /** The reference entity to render as a compact card. */
  entity: unknown
  /** Entity name used for the Add button's accessible label. */
  name: string
  /** How many copies of this entity are currently installed. */
  count: number
  /** Append one more copy of this entity to the loadout. */
  onAdd: () => void
}

/**
 * Mech-loadout install cell: a compact entity card with a per-entity "Add"
 * affordance (an entity SELECT — distinct from the tier-filter chips). Unlike
 * the shared Sel-based SelCard, installing the same System/Module twice is
 * rules-legal (Core Book p.94 "Craft your Systems/Modules" + p.96 "System
 * Slots" — nothing restricts a System/Module to a single copy; only slot
 * capacity limits it, and capacity is soft here), so this card is a count-based
 * adder rather than a one-shot toggle:
 *
 * - not installed → an "Add" button (appends one copy)
 * - installed → an "N Installed" label beside an "Add another" button (each
 *   click appends one more copy)
 *
 * Removal happens per-entry in the right-hand Loadout panel.
 */
export function InstallCard({ entity, name, count, onAdd }: InstallCardProps) {
  const installed = count > 0

  return (
    <div
      className={cn(
        'rounded-[5px]',
        // Card-level selected affordance, matching the wizard Sel ring: a
        // non-layout-shifting 3px rust box-shadow when one or more copies are
        // installed (count-based, not a toggle — see component doc above).
        installed && 'shadow-[0_0_0_3px_var(--color-rust)]'
      )}
    >
      <ReferenceEntityDisplay
        data={entity as SURefEntity}
        compact
        hide={{ actions: true, choices: true }}
      />
      <div className="mt-1.5 flex items-center gap-2 px-1">
        {installed && (
          <span
            className="font-cond text-badge font-bold uppercase tracking-caps text-rust"
            data-testid={`install-count-${name}`}
          >
            {count} Installed
          </span>
        )}
        <MiniBtn onClick={onAdd} aria-label={`Add ${name}`}>
          {installed ? '+ Add another' : '+ Add'}
        </MiniBtn>
      </div>
    </div>
  )
}
