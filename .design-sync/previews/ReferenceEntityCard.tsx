/*
 * Ported from
 * packages/component-lib/src/components/referenceEntity/card/ReferenceEntityCard.stories.tsx,
 * which runs to 22 stories. The five cells here are the ones that teach the
 * component: what one card looks like, that it renders every schema, the two
 * reductions (`extent="catalog"` and the badge), and the pattern subject.
 *
 * The story file's write-layer stories (selection, status cycling, stat
 * steppers, multi-select) are deliberately not ported — every one of them is a
 * live `useState` interaction, and a still card cannot show a toggle happening.
 * `Sel` carries the selection ring on its own card.
 */
import { ReferenceEntityCard } from 'component-lib'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../preview-lib/harness'

/** Named lookup with a first-entry fallback, so data drift never blanks a cell. */
function pick<T>(list: T[], predicate: (item: T) => boolean): T | undefined {
  return list.find(predicate) ?? list[0]
}

/**
 * THE renderer for every SRD entity, in both apps. One card, driven entirely by
 * the entity's own schema — the header tone, the stat bar, the nested content
 * and the footer citation all derive from `data`.
 */
export function Anatomy() {
  const chassis = pick(SalvageUnionReference.Chassis.all(), (c) => c.name === 'Little Sestra')
  if (!chassis) return null
  return (
    <div className="flex flex-col gap-4 p-4">
      <ReferenceEntityCard data={chassis} />
    </div>
  )
}

/**
 * One card per schema. The tone and the stat vocabulary change with the
 * entity — a system is not a bio-titan is not a crawler bay — but the shell,
 * the stamp language and the footer citation never do.
 */
export function EverySchema() {
  const entities = [
    pick(SalvageUnionReference.Systems.all(), (s) => s.name === 'Salvaging Drill'),
    pick(SalvageUnionReference.Equipment.all(), (e) => e.name === 'Grenade'),
    pick(SalvageUnionReference.Abilities.all(), (a) => a.name === 'Auto-Turret'),
  ].filter(Boolean) as SURefEntity[]
  return (
    <div className="flex flex-col gap-10 p-4">
      {entities.map((entity) => (
        <ReferenceEntityCard key={entity.id} data={entity} />
      ))}
    </div>
  )
}

/**
 * `extent="catalog"` — the SRD index tile. Artwork and description ONLY: no
 * nested entities, actions, choices, patterns or roll tables, so a listing page
 * reads uniformly whatever each entity happens to carry.
 */
export function CatalogTiles() {
  const entities = [
    pick(SalvageUnionReference.Chassis.all(), (c) => c.name === 'Little Sestra'),
    pick(SalvageUnionReference.BioTitans.all(), (b) => b.name === 'Scylla'),
    pick(SalvageUnionReference.Crawlers.all(), (c) => c.name === 'Engineering'),
    pick(SalvageUnionReference.CrawlerBays.all(), (b) => b.name === 'Command Bay'),
  ].filter(Boolean) as SURefEntity[]
  return (
    <div className="grid gap-4 p-4 md:grid-cols-2">
      {entities.map((entity) => (
        <ReferenceEntityCard key={entity.id} data={entity} size="medium" extent="catalog" />
      ))}
    </div>
  )
}

/**
 * `size="small" extent="head"` — the shortform token. The whole entity collapses
 * to one tone-filled line: type stamp, name, classification tail. Gear and
 * chassis show `TL <n>`; abilities show `<Tree> · L<n>`.
 */
export function BadgeMode() {
  const entities = [
    pick(SalvageUnionReference.Chassis.all(), (c) => c.name === 'Little Sestra'),
    pick(SalvageUnionReference.Systems.all(), (s) => s.name === 'Salvaging Drill'),
    pick(SalvageUnionReference.Abilities.all(), (a) => a.name === 'Auto-Turret'),
    pick(SalvageUnionReference.Equipment.all(), (e) => e.name === 'Grenade'),
  ].filter(Boolean) as SURefEntity[]
  return (
    <div className="flex flex-wrap items-start gap-3 p-4">
      {entities.map((entity) => (
        <ReferenceEntityCard key={entity.id} data={entity} size="small" extent="head" />
      ))}
    </div>
  )
}

/**
 * PATTERN rendering — the pattern is the subject. The chassis name rides the
 * seam as a stampseal and the pattern's systems and modules render as nested
 * compact cards. A `legalStarting` pattern adds its stamp beside the marker.
 */
export function PatternSubject() {
  const mule = pick(SalvageUnionReference.Chassis.all(), (c) => c.name === 'Mule')
  const hauler = mule?.patterns?.find((p) => p.name === 'Hauler') ?? mule?.patterns?.[0]
  if (!mule || !hauler) return null
  return (
    <div className="flex flex-col gap-4 p-4">
      <Caption>
        {mule.name} · {hauler.name} — full card
      </Caption>
      <ReferenceEntityCard data={mule} pattern={hauler} />
      <Caption>the same pattern as a listing row</Caption>
      <ReferenceEntityCard data={mule} pattern={hauler} size="medium" extent="head" />
    </div>
  )
}
