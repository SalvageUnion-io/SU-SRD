/**
 * CrawlerSystemsEditModal — the live sheet's inline weapons-systems editor
 * (build-edit mode). Reuses the wizard's SystemsList (the weapons picker) inside
 * a ModalShell, with the SAME hard cap the wizard enforces: one Weapons System
 * per crawler, two for a Battle Crawler (Core Book p. 213 / p. 216). Selections
 * write through immediately via the sheet's `patch({ systems })`.
 */

import { useEffect, useMemo, useState } from 'react'

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefCrawler, SURefSystem } from 'salvageunion-reference'
import { ModalShell } from 'suref-react'

import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { computeCrawlerCapacity } from '../../lib/rules/crawlerCapacity'
import { isWeaponSystem } from '../../lib/rules/crawlerSystems'
import type { Crawler } from '../../lib/schemas/crawler'
import { SystemsList } from './SystemsList'

type CrawlerSystemsEditModalProps = {
  open: boolean
  onClose: () => void
  crawler: Crawler
  /**
   * Persist a partial patch on the crawler. Supports the fresh-read updater
   * form `(current) => fields` so rapid weapon toggles don't race the write.
   */
  patch: (input: Partial<Crawler> | ((current: Crawler) => Partial<Crawler>)) => void
}

/**
 * WEAPONS systems whose numeric techLevel <= the crawler's TL (mirrors the
 * wizard's Armament-Bay filter — weapons only, numeric TL only).
 */
function filterSystemsByTL(allSystems: SURefSystem[], tl: number | null): SURefSystem[] {
  if (tl === null) return []
  return allSystems.filter((s) => {
    if (typeof s.techLevel !== 'number') return false
    if (s.techLevel > tl) return false
    return isWeaponSystem(s)
  })
}

export function CrawlerSystemsEditModal({
  open,
  onClose,
  crawler,
  patch,
}: CrawlerSystemsEditModalProps) {
  const [allSystems, setAllSystems] = useState<SURefSystem[]>([])
  const [types, setTypes] = useState<SURefCrawler[]>([])

  useEffect(() => {
    void SalvageUnionReference.preload(['systems', 'crawlers', 'actions']).then(() => {
      setAllSystems(SalvageUnionReference.Systems.all())
      setTypes(SalvageUnionReference.Crawlers.all())
    })
  }, [])

  const tl = parseCrawlerTechLevel(crawler.techLevel) ?? null
  const selectedType = types.find((t) => t.id === crawler.type || t.name === crawler.type)
  // Battle Crawler mounts two systems (special ability "Improved Armour and
  // Armaments", Core Book p. 216) — gate off the action name, not the label.
  const isBattleCrawler = selectedType?.actions?.includes('Improved Armour and Armaments') ?? false

  // TL-eligible weapons, PLUS any weapon already installed above the current TL
  // (e.g. after a TL drop) so it stays visible and removable — otherwise it
  // counts toward the cap but has no card to deselect, stranding the picker.
  const isInstalled = (s: SURefSystem) => crawler.systems.some((id) => id === s.id || id === s.name)
  const filteredSystems = filterSystemsByTL(allSystems, tl)
  const installedOverTl = allSystems.filter(
    (s) => isInstalled(s) && isWeaponSystem(s) && !filteredSystems.some((f) => f.id === s.id)
  )
  const displaySystems = [...filteredSystems, ...installedOverTl]

  const capacity = useMemo(() => {
    const weaponSystems = crawler.systems.filter((id) => {
      const system = allSystems.find((s) => s.id === id || s.name === id)
      return system ? isWeaponSystem(system) : false
    })
    return computeCrawlerCapacity({
      techLevel: tl ?? 0,
      bays: [],
      weaponSystems,
      isBattleCrawler,
    })
  }, [crawler.systems, allSystems, tl, isBattleCrawler])

  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="Edit Weapons Systems"
      subtitle={`${capacity.weaponSystemsUsed} / ${
        capacity.weaponSystemsMax > 0 ? capacity.weaponSystemsMax : '—'
      } · Tech ${tl ?? '—'} and below`}
    >
      <div className="p-4">
        <SystemsList
          systems={displaySystems}
          selectedSystemSlugs={crawler.systems}
          maxSelectable={capacity.weaponSystemsMax}
          installedWeaponCount={capacity.weaponSystemsUsed}
          onChange={(next) =>
            // Apply the user's delta (vs the displayed selection) onto the
            // FRESHEST systems array so a rapid second toggle can't overwrite
            // the first. Weapons are unique, so set-style add/remove is safe.
            patch((current) => {
              const added = next.filter((s) => !crawler.systems.includes(s))
              const removed = crawler.systems.filter((s) => !next.includes(s))
              const systems = current.systems.filter((s) => !removed.includes(s))
              for (const a of added) if (!systems.includes(a)) systems.push(a)
              return { systems }
            })
          }
        />
      </div>
    </ModalShell>
  )
}
