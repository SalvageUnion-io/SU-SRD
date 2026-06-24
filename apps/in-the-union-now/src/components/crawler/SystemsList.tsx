import type { SURefSystem } from 'salvageunion-reference'
import { SelCard } from '../wizard/SelCard'

type SystemsListProps = {
  /** Weapons systems available to install, already filtered by tech level. */
  systems: SURefSystem[]
  selectedSystemSlugs: string[]
  /**
   * Hard cap on how many systems may be installed — the crawler type's
   * Armament-Bay weapons-system allowance (1, or 2 for a Battle Crawler; Core
   * Book p. 213 / p. 216). Once this many are selected, the remaining cards are
   * disabled until one is removed.
   */
  maxSelectable: number
  onChange: (slugs: string[]) => void
}

/**
 * Systems step grid — 3-col Sel-grid WizShell variant (design §3.2). The
 * parent owns the weapons + TL filter (weapons systems at the crawler's tech
 * level and below); selection is HARD-capped at `maxSelectable` — the crawler
 * type's Armament-Bay allowance — so a crawler can never install more weapons
 * systems than its type permits.
 */
export function SystemsList({
  systems,
  selectedSystemSlugs,
  maxSelectable,
  onChange,
}: SystemsListProps) {
  const atCap = selectedSystemSlugs.length >= maxSelectable

  function toggle(systemId: string) {
    if (selectedSystemSlugs.includes(systemId)) {
      onChange(selectedSystemSlugs.filter((s) => s !== systemId))
    } else if (!atCap) {
      onChange([...selectedSystemSlugs, systemId])
    }
  }

  if (systems.length === 0) {
    return (
      <p className="text-sm text-wk-muted">Select a tech level to see available weapons systems.</p>
    )
  }

  const capReason = `Only ${maxSelectable} weapons system${
    maxSelectable === 1 ? '' : 's'
  } for this crawler type — remove one to swap.`

  return (
    <div className="columns-1 gap-3.5 sm:columns-2 [&>*]:mb-3.5 [&>*]:break-inside-avoid">
      {systems.map((system) => {
        const selected = selectedSystemSlugs.includes(system.id)
        const disabled = !selected && atCap
        return (
          <SelCard
            key={system.id}
            entity={system}
            name={system.name}
            selected={selected}
            disabled={disabled}
            disabledReason={disabled ? capReason : undefined}
            onToggle={() => toggle(system.id)}
          />
        )
      })}
    </div>
  )
}
