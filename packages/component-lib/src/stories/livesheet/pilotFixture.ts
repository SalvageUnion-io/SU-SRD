/**
 * Shared Pilot fixture for the live-sheet reconciliation L2 comparison — ONE
 * pilot + one set of real ORM abilities/equipment, consumed by BOTH the legacy
 * "before" capture and the new "Union Poster" target so the Ladle three-way
 * compares the SHELL, not the content. Real `SalvageUnionReference.*` data.
 */

import { SalvageUnionReference, type SURefEntity } from 'salvageunion-reference'

/** Named pick with an index fallback (keeps rows distinct under data drift). */
function pick(schema: 'Abilities' | 'Equipment', name: string, index: number): SURefEntity {
  const all = SalvageUnionReference[schema].all() as ReadonlyArray<SURefEntity>
  if (all.length === 0) throw new Error(`pilotFixture: ${schema} is empty (data drift)`)
  return (all.find((e) => (e as { name?: string }).name === name) ??
    all[index % all.length]) as SURefEntity
}

export type PilotFixtureCondition = { label: string; state?: 'intact' | 'damaged' | 'destroyed' }
export type PilotFixtureInjury = { label: string; severity: 'minor' | 'major' }
export type PilotFixtureLink = {
  kind: string
  name: string
  /** Chassis/type label (the EntityRow's toned meta badge). */
  meta: string
  /** At-a-glance stats for the row subheader. */
  stats: { label: string; value: number }[]
}

export const pilotContent = {
  callsign: 'Magpie',
  name: 'Yara Voss',
  className: 'Fabricator',
  background: 'Union Machinist',
  appearance: 'Grease-streaked overalls, brass goggles',
  keepsake: 'A rivet from her first salvage',
  motto: '“If it sparks, it talks.”',
  bio: 'Raised in the under-decks of a Union crawler; joined the wrench gangs at twelve, took a cockpit at nineteen.',
  hp: { value: 7, max: 10 },
  ap: { value: 3, max: 5 },
  tp: 2,
  // Legacy "before" capture kept the shipped freeform pilot conditions.
  conditions: [
    { label: 'Wounded', state: 'damaged' },
    { label: 'Dazed' },
    { label: 'Broken' },
  ] satisfies PilotFixtureCondition[],
  // The new poster uses rules-accurate INJURIES (Critical Injury Table) instead.
  injuries: [{ label: 'Cracked ribs', severity: 'minor' }] satisfies PilotFixtureInjury[],
  linked: [
    {
      kind: 'Mech',
      name: 'Scrapdog',
      meta: 'Goliath',
      stats: [
        { label: 'SP', value: 12 },
        { label: 'EP', value: 6 },
      ],
    },
    {
      kind: 'Crawler',
      name: 'The Long Haul',
      meta: 'Union Crawler',
      stats: [{ label: 'TL', value: 3 }],
    },
  ] satisfies PilotFixtureLink[],
}

export const abilityPicks: { entity: SURefEntity; apCost: number | string; used?: boolean }[] = [
  { entity: pick('Abilities', 'Auto-Turret', 0), apCost: 2 },
  { entity: pick('Abilities', 'Overclock', 1), apCost: 1, used: true },
  { entity: pick('Abilities', 'Field Medic', 2), apCost: '—' },
]

export const equipmentPicks: { entity: SURefEntity; slots: number }[] = [
  { entity: pick('Equipment', 'Combat Knife', 0), slots: 2 },
  { entity: pick('Equipment', 'Med Kit', 1), slots: 1 },
]
