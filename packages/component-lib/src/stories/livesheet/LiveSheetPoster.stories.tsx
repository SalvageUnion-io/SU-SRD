import type { Story } from '@ladle/react'

import { type LegacyPilotContent, LiveSheetLegacyPilot } from '../legacy/LiveSheetLegacyPilot'
import { LiveSheetPoster, type PosterCollectionItem, type PosterField } from './LiveSheetPoster'
import { abilityPicks, equipmentPicks, pilotContent } from './pilotFixture'

/**
 * Compositions/Live Sheet — the L2 TARGET ("Union Poster"), assembled from
 * existing primitives, driven by the shared `pilotFixture`. The `Comparison`
 * story is the L2 Legacy → New three-way (before · new read-only · new editable)
 * on one page, same pilot throughout. Ladle-only (not barrel-exported, no app
 * consumers) while it iterates. See `docs/design/livesheet-reconciliation.md`.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Live Sheet',
}

/** Self-contained duotone portrait placeholder (data URI — CSP-safe, no network). */
const PORTRAIT = `data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 192'><rect width='150' height='192' fill='#f2d6c4'/><circle cx='75' cy='76' r='33' fill='#a85222'/><path d='M18 192c0-37 26-56 57-56s57 19 57 56z' fill='#a85222'/></svg>"
)}`

// --- shared fixture → new poster props -------------------------------------

const fields: PosterField[] = [
  { label: 'Callsign', value: pilotContent.callsign, accent: true },
  { label: 'Name', value: pilotContent.name },
  { label: 'Class', value: pilotContent.className },
  { label: 'Background', value: pilotContent.background },
  { label: 'Appearance', value: pilotContent.appearance },
  { label: 'Keepsake', value: pilotContent.keepsake },
  { label: 'Motto', value: pilotContent.motto, span: 2 },
  { label: 'Bio', value: pilotContent.bio, span: 3 },
]

const abilities: PosterCollectionItem[] = abilityPicks.map((a, i) => ({
  entity: a.entity,
  footMeta: [{ label: 'AP Cost', value: a.apCost }],
  expanded: i === 0,
}))

const inventory: PosterCollectionItem[] = equipmentPicks.map((e) => ({
  entity: e.entity,
  footMeta: [{ label: 'Slots', value: e.slots }],
}))

const posterCommon = {
  name: pilotContent.callsign,
  kind: 'Pilot',
  imageLabel: 'Portrait',
  fields,
  hp: pilotContent.hp,
  ap: pilotContent.ap,
  tp: pilotContent.tp,
  conditions: pilotContent.conditions,
  abilities,
  inventory,
  genericInventory: [
    { name: 'Rations ×4', slots: 1 },
    { name: 'Rope, 50 m', slots: 1 },
    { name: 'Signal flares ×2', slots: 1 },
  ],
  slotsUsed: 7,
  slotsCap: 10,
  linked: pilotContent.linked.map((l) => ({ kind: l.kind, name: l.name })),
}

// --- shared fixture → legacy ("before") props ------------------------------

const legacyPilot: LegacyPilotContent = {
  callsign: pilotContent.callsign,
  name: pilotContent.name,
  className: pilotContent.className,
  background: pilotContent.background,
  appearance: pilotContent.appearance,
  keepsake: pilotContent.keepsake,
  motto: pilotContent.motto,
  bio: pilotContent.bio,
  hp: pilotContent.hp,
  ap: pilotContent.ap,
  tp: pilotContent.tp,
  conditions: pilotContent.conditions.map((c) => ({ label: c.label, warn: c.state === 'damaged' })),
  linked: pilotContent.linked,
}
const legacyAbilities = abilityPicks
const legacyEquipment = equipmentPicks.map((e) => ({ entity: e.entity, slots: e.slots }))

/** Labeled divider between comparison panels. */
function Band({ tag, title, note }: { tag: string; title: string; note: string }) {
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-1 px-6 pb-2 pt-10">
      <div className="flex items-center gap-2">
        <span className="bg-ink px-2 pb-[3px] pt-[2px] font-cond text-badge font-bold uppercase tracking-caps text-paper">
          {tag}
        </span>
        <span className="font-cond text-sm font-bold uppercase tracking-caps text-ink">
          {title}
        </span>
      </div>
      <p className="m-0 font-body text-caption text-wk-muted">{note}</p>
    </div>
  )
}

/**
 * L2 three-way — same pilot, three shells, top to bottom:
 * BEFORE (today) · AFTER read-only · AFTER editable.
 */
export const Comparison: Story = () => (
  <div className="flex flex-col bg-[#efece6]">
    <Band
      tag="Before"
      title="Today's pilot sheet"
      note="The shipped ITUN shell, reproduced from real code (Legacy/Live Sheet). Pre-canon drift kept verbatim."
    />
    <LiveSheetLegacyPilot
      pilot={legacyPilot}
      abilities={legacyAbilities}
      equipment={legacyEquipment}
    />
    <Band
      tag="After"
      title="Union Poster — read-only (image filled)"
      note="Assembled from existing primitives. Accent identity + vitals bands, segmented VitalGauges, Slab-headed entity rows, bottom link rail."
    />
    <LiveSheetPoster {...posterCommon} imageSrc={PORTRAIT} readOnly />
    <Band
      tag="After"
      title="Union Poster — editable (image empty)"
      note="Same shell in live-play: + Add on collections, per-container edit, the reserved image seat as an EmptyState dropzone."
    />
    <LiveSheetPoster {...posterCommon} />
  </div>
)

/** New target, read-only (published snapshot) — image seat FILLED. */
export const NewReadOnly: Story = () => (
  <LiveSheetPoster {...posterCommon} imageSrc={PORTRAIT} readOnly />
)

/** New target, editable (live play) — image seat EMPTY (the EmptyState dropzone). */
export const NewEditable: Story = () => <LiveSheetPoster {...posterCommon} />

/** New target, phone width (~390px) — single-column poster order. */
export const NewMobile: Story = () => (
  <div className="mx-auto w-[390px] overflow-hidden rounded-panel border-2 border-ink/30 shadow-lg">
    <LiveSheetPoster {...posterCommon} imageSrc={PORTRAIT} readOnly />
  </div>
)
