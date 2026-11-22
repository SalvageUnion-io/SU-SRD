import { useState } from 'react'
import type { BookCite, RefSystem } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { EmptyState, ReferenceEntityCard } from '../../components/index'
import { buildWizardCopy } from '../../messages/build-wizard'
import { PickList } from './PickList'
import { weaponColumns } from './pickColumns'

type SystemsListProps = {
  /** Weapons systems available to install, already filtered by the parent. */
  systems: RefSystem[]
  selectedSystemSlugs: string[]
  /**
   * Hard cap on how many WEAPONS systems may be installed — the crawler
   * type's Armament-Bay allowance, read from its stored `mutations` (1, or 2
   * for a Battle Crawler; Core Book p. 213 / p. 216).
   */
  maxSelectable: number
  /**
   * How many WEAPONS systems are currently installed. The cap counts weapons
   * only — NOT `selectedSystemSlugs.length` (a crawler may also carry
   * non-weapon systems, which this rule does not limit).
   */
  installedWeaponCount: number
  onChange: (slugs: string[]) => void
  /** Where the book prints the step's rule, on the list's foot. */
  cite: BookCite | undefined
}

// No Traits column: the line's card beside it says them, and the line keeps
// its mount's stepper inside its frame at every width.
const COLUMNS = weaponColumns<RefSystem>().filter((column) => column.key !== 'traits')

/**
 * Arm the Armament Bay (Union Crawler p.213), as a picker in the Ledger form (`PickList`, its count pick): the Tech 1
 * weapons a line each (timing, range, damage), a mount's stepper at
 * the line's end. Pressing a line mounts it (r6 F4), in place of the mount
 * where the bay takes one; the mounts are counted on the action bar. The line in focus is
 * its contentful card beside the list (under its line on a phone). The parent
 * owns the weapons + TL filter; selection is HARD-capped at `maxSelectable`:
 * at the cap every other `+` is off, its line dimmed with the reason.
 */
export function SystemsList({
  systems,
  selectedSystemSlugs,
  maxSelectable,
  installedWeaponCount,
  onChange,
  cite,
}: SystemsListProps) {
  const atCap = installedWeaponCount >= maxSelectable
  const [focus, setFocus] = useState<string | undefined>(undefined)

  if (systems.length === 0) {
    return (
      <EmptyState
        headline={buildWizardCopy('noSystems')}
        body={buildWizardCopy('noWeaponsSystemsAvailable')}
      />
    )
  }
  const mounted = (system: RefSystem) => selectedSystemSlugs.includes(getEntitySlug(system))
  const weaponSlugs = new Set(systems.map(getEntitySlug))
  const shown = focus ?? selectedSystemSlugs[0] ?? getEntitySlug(systems[0] as RefSystem)
  const focused = systems.find((system) => getEntitySlug(system) === shown)
  const full = buildWizardCopy('armamentBayFullMounted', { installedWeaponCount })
  const card = (system: RefSystem) => (
    <ReferenceEntityCard
      data={system}
      size="compact"
      selected={mounted(system)}
      // A pick's card says its own rules: no lead line, no flavour.
      hide={{ lead: true, flavor: true, actions: true, choices: true }}
    />
  )

  return (
    <div className="su-wiz-stack su-wiz-stack--12">
      <div className="su-wiz-compare-layout su-wiz-compare-layout--wide">
        <div className="su-wiz-compare-main">
          <div>
            <PickList
              title={buildWizardCopy('tech1WeaponsSystems')}
              rows={systems}
              rowKey={getEntitySlug}
              rowName={(system) => system.name}
              columns={COLUMNS}
              // Only a row pressed, or the mounted one, is the radio's: a press
              // on the card shown by default still mounts it.
              selected={focus ?? selectedSystemSlugs.find((slug) => weaponSlugs.has(slug))}
              onSelect={(slug) => {
                setFocus(slug)
                // A press mounts the row (r6 F4): it replaces the mount where
                // the bay takes one, and adds while mounts remain.
                if (selectedSystemSlugs.includes(slug)) return
                if (maxSelectable === 1)
                  onChange([...selectedSystemSlugs.filter((s) => !weaponSlugs.has(s)), slug])
                else if (!atCap) onChange([...selectedSystemSlugs, slug])
              }}
              count={{
                label: buildWizardCopy('mount'),
                value: (system) => (mounted(system) ? 1 : 0),
                max: (system) => (mounted(system) || !atCap ? 1 : 0),
                onChange: (system, next) => {
                  const slug = getEntitySlug(system)
                  setFocus(slug)
                  onChange(
                    next > 0
                      ? [...selectedSystemSlugs, slug]
                      : selectedSystemSlugs.filter((s) => s !== slug)
                  )
                },
              }}
              disabled={(system) => (atCap && !mounted(system) ? full : undefined)}
              detail={card}
              {...(cite ? { foot: { cite } } : {})}
            />
          </div>
        </div>
        <div className="su-wiz-compare-detail su-wiz-compare-detail--sticky su-wiz-compare-detail--scroll su-wiz-compare-detail--desk">
          {focused && card(focused)}
        </div>
      </div>
    </div>
  )
}
