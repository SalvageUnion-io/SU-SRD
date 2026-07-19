import type { SURefSystem } from 'salvageunion-reference'
import { MasonryColumns, ReferenceEntityCard } from 'component-lib'

type SystemsListProps = {
  /** Weapons systems available to install, already filtered by the parent. */
  systems: SURefSystem[]
  selectedSystemSlugs: string[]
  /**
   * Hard cap on how many WEAPONS systems may be installed — the crawler
   * type's Armament-Bay allowance, read from its stored `mutations` (1, or 2
   * for a Battle Crawler; Core Book p. 213 / p. 216). Once this many weapons
   * are installed, the remaining cards disable with a reason chip until one
   * is removed. `undefined` lifts the cap entirely (edit mode's soft regime —
   * plan §5.2: budgets undefined, over-cap warns instead).
   */
  maxSelectable?: number
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
 * Step 3 · Arm the Armament Bay (Union Crawler p.213) — the weapons-system
 * Sel grid, every option rendered as the SRD entity card inside a SelCard
 * (the universal entity-card rule). The parent owns the weapons + TL filter
 * (guided create: Tech 1 only); selection is HARD-capped at `maxSelectable`
 * — the type's mutations-derived Armament-Bay allowance — and an at-cap card
 * dims with a reason chip naming the gate (mockup Screen 02), visible, never
 * hidden. Edit mode passes `maxSelectable: undefined` and keeps the soft
 * over-cap warning instead.
 */
export function SystemsList({
  systems,
  selectedSystemSlugs,
  maxSelectable,
  installedWeaponCount,
  onChange,
}: SystemsListProps) {
  const atCap = maxSelectable !== undefined && installedWeaponCount >= maxSelectable

  function toggle(systemId: string) {
    if (selectedSystemSlugs.includes(systemId)) {
      onChange(selectedSystemSlugs.filter((s) => s !== systemId))
    } else if (!atCap) {
      onChange([...selectedSystemSlugs, systemId])
    }
  }

  if (systems.length === 0) {
    return <p className="m-0 font-body text-sm text-current">No weapons systems available.</p>
  }

  return (
    <MasonryColumns maxColumns={2}>
      {systems.map((system) => {
        const selected = selectedSystemSlugs.includes(system.id)
        const disabled = !selected && atCap
        return (
          <ReferenceEntityCard
            key={system.id}
            data={system}
            compact
            selected={selected}
            selectionRole="toggle"
            cardClickLabel={system.name}
            selectable={!disabled}
            onCardClick={disabled ? undefined : () => toggle(system.id)}
            hide={{ actions: true, choices: true }}
            footMeta={
              disabled
                ? [{ label: `Armament Bay full · ${installedWeaponCount} mounted`, value: '' }]
                : undefined
            }
          />
        )
      })}
    </MasonryColumns>
  )
}
