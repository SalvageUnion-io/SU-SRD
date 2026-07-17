/**
 * CrawlerSystemsEditModal — the live sheet's inline weapons-systems editor
 * (build-edit mode). Drives the shared EntitySearcher, scoped to WEAPON systems
 * at the crawler's tech level and below. Per ADR-021 the live sheet is the
 * free/override surface, so the one/two-per-crawler cap (Core Book p. 213 /
 * p. 216) shows as a SOFT budget track (honest over-capacity), not a hard block —
 * matching how mech System/Module slots already behave. Selections write through
 * immediately via the sheet's `patch({ systems })`.
 */

import { useEffect, useMemo, useState } from 'react'

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefCrawler, SURefSystem } from 'salvageunion-reference'
import { ModalShell } from 'component-lib'

import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { computeCrawlerCapacity } from '../../lib/rules/crawlerCapacity'
import { isWeaponSystem } from '../../lib/rules/crawlerSystems'
import type { Crawler } from '../../lib/schemas/crawler'
import { EntitySearcher } from 'component-lib'

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
      subtitle={`Tech ${tl ?? '—'} and below`}
      maxWidth="max-w-5xl"
    >
      <div className="p-4">
        {allSystems.length > 0 && (
          <EntitySearcher
            schema="systems"
            selected={crawler.systems}
            filter={(item) => {
              const s = item as unknown as SURefSystem
              const installed = crawler.systems.some((id) => id === s.id || id === s.name)
              // Keep installed weapons visible/removable even above the current TL.
              if (installed) return isWeaponSystem(s)
              if (typeof s.techLevel !== 'number' || tl === null || s.techLevel > tl) return false
              return isWeaponSystem(s)
            }}
            idOf={(item) => (item as unknown as SURefSystem).id}
            onToggle={(ref) =>
              // Toggle exactly one weapon on the FRESHEST systems array so a rapid
              // second toggle can't overwrite the first. Weapons are unique.
              patch((current) => ({
                systems: current.systems.includes(ref)
                  ? current.systems.filter((s) => s !== ref)
                  : [...current.systems, ref],
              }))
            }
            railName={crawler.name}
            chosenLabel="Armed"
            emptyMessage="No weapons systems at this crawler's tech level."
            budget={{
              label: 'Weapons Systems',
              used: capacity.weaponSystemsUsed,
              max: capacity.weaponSystemsMax,
            }}
          />
        )}
      </div>
    </ModalShell>
  )
}
