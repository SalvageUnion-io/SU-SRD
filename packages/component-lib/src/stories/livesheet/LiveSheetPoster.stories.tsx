import type { Story } from '@ladle/react'
import { SalvageUnionReference, type SURefEntity } from 'salvageunion-reference'

import { LiveSheetPoster, type PosterCollectionItem, type PosterField } from './LiveSheetPoster'

/**
 * Compositions/Live Sheet — the L2 TARGET ("Union Poster"), assembled from
 * existing primitives. Ladle-only (not barrel-exported, no app consumers) while
 * it iterates; compare against `Legacy/Live Sheet` (the before). Pilot first;
 * mech + crawler reuse the same parts. See
 * `docs/design/livesheet-reconciliation.md`.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Live Sheet',
}

/** Named pick with an index fallback (keeps rows distinct under data drift). */
function pick(schema: 'Abilities' | 'Equipment', name: string, index: number): SURefEntity {
  const all = SalvageUnionReference[schema].all() as ReadonlyArray<SURefEntity>
  if (all.length === 0) throw new Error(`Compositions/Live Sheet: ${schema} is empty (data drift)`)
  return (all.find((e) => (e as { name?: string }).name === name) ??
    all[index % all.length]) as SURefEntity
}

/** Self-contained duotone portrait placeholder (data URI — CSP-safe, no network). */
const PORTRAIT = `data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 192'><rect width='150' height='192' fill='#f2d6c4'/><circle cx='75' cy='76' r='33' fill='#a85222'/><path d='M18 192c0-37 26-56 57-56s57 19 57 56z' fill='#a85222'/></svg>"
)}`

const fields: PosterField[] = [
  { label: 'Callsign', value: 'Magpie', accent: true },
  { label: 'Name', value: 'Yara Voss' },
  { label: 'Class', value: 'Fabricator' },
  { label: 'Background', value: 'Union Machinist' },
  { label: 'Appearance', value: 'Grease-streaked overalls, brass goggles' },
  { label: 'Keepsake', value: 'A rivet from her first salvage' },
  { label: 'Motto', value: '“If it sparks, it talks.”', span: 2 },
  {
    label: 'Bio',
    value:
      'Raised in the under-decks of a Union crawler; joined the wrench gangs at twelve, took a cockpit at nineteen.',
    span: 3,
  },
]

const abilities: PosterCollectionItem[] = [
  {
    entity: pick('Abilities', 'Auto-Turret', 0),
    footMeta: [{ label: 'AP Cost', value: 2 }],
    expanded: true,
  },
  { entity: pick('Abilities', 'Overclock', 1), footMeta: [{ label: 'AP Cost', value: 1 }] },
  { entity: pick('Abilities', 'Field Medic', 2), footMeta: [{ label: 'AP Cost', value: 2 }] },
]

const inventory: PosterCollectionItem[] = [
  { entity: pick('Equipment', 'Combat Knife', 0), footMeta: [{ label: 'Slots', value: 2 }] },
  { entity: pick('Equipment', 'Med Kit', 1), footMeta: [{ label: 'Slots', value: 1 }] },
]

const common = {
  name: 'Magpie',
  kind: 'Pilot',
  imageLabel: 'Portrait',
  fields,
  hp: { value: 7, max: 10 },
  ap: { value: 3, max: 5 },
  tp: 2,
  conditions: [
    { label: 'Wounded', state: 'damaged' as const },
    { label: 'Dazed' },
    { label: 'Broken' },
  ],
  abilities,
  inventory,
  genericInventory: [
    { name: 'Rations ×4', slots: 1 },
    { name: 'Rope, 50 m', slots: 1 },
    { name: 'Signal flares ×2', slots: 1 },
  ],
  slotsUsed: 7,
  slotsCap: 10,
  linked: [
    { kind: 'Mech', name: 'Scrapdog' },
    { kind: 'Crawler', name: 'The Long Haul' },
  ],
}

/** Read-only (published snapshot) — image seat FILLED. */
export const Pilot: Story = () => <LiveSheetPoster {...common} imageSrc={PORTRAIT} readOnly />

/** Editable (live play) — image seat EMPTY (the EmptyState dropzone). */
export const PilotEditable: Story = () => <LiveSheetPoster {...common} />

/** Phone width (~390px) — single-column poster order. */
export const PilotMobile: Story = () => (
  <div className="mx-auto w-[390px] overflow-hidden rounded-panel border-2 border-ink/30 shadow-lg">
    <LiveSheetPoster {...common} imageSrc={PORTRAIT} readOnly />
  </div>
)
