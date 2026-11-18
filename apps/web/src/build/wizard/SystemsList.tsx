import { useState } from 'react'
import type { RefSystem } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { EmptyState, ReferenceEntityCard, Stat } from '../../components/index'
import { buildWizardCopy } from '../../messages/build-wizard'
import { PickList } from './PickList'
import { weaponColumns } from './pickColumns'
import { WizMeter } from './WizShell'

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
}

const COLUMNS = weaponColumns<RefSystem>()

/**
 * MOCK (Working Manual, wave 2) · Arm the Armament Bay (Union Crawler p.213),
 * as a picker in the Ledger form (`PickList`, its count pick): the Tech 1
 * weapons a line each (timing, range, damage, traits), a mount's stepper at
 * the line's end, the bay's mounts a meter over the list. The line in focus is
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
  const shown = focus ?? selectedSystemSlugs[0] ?? getEntitySlug(systems[0] as RefSystem)
  const focused = systems.find((system) => getEntitySlug(system) === shown)
  const full = buildWizardCopy('armamentBayFullMounted', { installedWeaponCount })
  const card = (system: RefSystem) => (
    <div className="su-wiz-own-rules">
      <ReferenceEntityCard
        data={system}
        size="compact"
        selected={mounted(system)}
        hide={{ actions: true, choices: true }}
      />
    </div>
  )

  return (
    <div className="su-wiz-stack su-wiz-stack--12">
      <div className="su-wiz-budget">
        <WizMeter label="Weapons mounted" value={installedWeaponCount} max={maxSelectable} />
      </div>
      <div className="su-wiz-compare-layout su-wiz-compare-layout--wide">
        <div className="su-wiz-compare-main">
          <div>
            <PickList
              title="Tech 1 Weapons Systems"
              note={
                <Stat
                  label="Mounted"
                  value={installedWeaponCount}
                  max={maxSelectable}
                  size="mini"
                />
              }
              rows={systems}
              rowKey={getEntitySlug}
              rowName={(system) => system.name}
              columns={COLUMNS}
              selected={shown}
              onSelect={setFocus}
              count={{
                label: 'Mount',
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
              foot={{ cite: 'Workshop Manual · p.213 · Systems pp.162–187' }}
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
