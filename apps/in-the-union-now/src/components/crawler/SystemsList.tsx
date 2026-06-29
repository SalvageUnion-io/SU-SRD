import type { SURefSystem } from 'salvageunion-reference'
import { SelCard } from '../wizard/SelCard'

type SystemsListProps = {
  /** Weapons systems available to install, already filtered by tech level. */
  systems: SURefSystem[]
  selectedSystemSlugs: string[]
  /**
   * Hard cap on how many WEAPONS systems may be installed — the crawler type's
   * Armament-Bay weapons-system allowance (1, or 2 for a Battle Crawler; Core
   * Book p. 213 / p. 216). Once this many weapons are installed, the remaining
   * cards are disabled until one is removed.
   */
  maxSelectable: number
  /**
   * How many WEAPONS systems are currently installed. The cap counts weapons
   * only — NOT `selectedSystemSlugs.length`. A crawler may also carry
   * non-weapon systems (Cargo Pod, Armour Plating, …) which this rule does not
   * limit and which never appear in the weapons-only catalog, so counting all
   * selected slugs would wrongly lock the picker for a legacy crawler that
   * carries any non-weapon system (it could neither add the allowed weapon nor
   * remove the stranded system).
   */
  installedWeaponCount: number
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
  installedWeaponCount,
  onChange,
}: SystemsListProps) {
  const atCap = installedWeaponCount >= maxSelectable

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

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            onToggle={() => toggle(system.id)}
          />
        )
      })}
    </div>
  )
}
